import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decorateButton,
  partClassName,
  defineComponent,
  enumValue,
  finiteNumber,
  parseJsonStrings,
  useEffects,
} from "./index";

type HydratedProperties = {
  defaultValue: number;
  onChange: ((value: number) => void) | null;
  value: number;
};
const hydrationProperties = {
  value: "value",
  defaultValue: "default-value",
  onChange: null,
} as const;

let tagSequence = 0;

function uniqueTag(label: string): string {
  return `bwc-runtime-${label}-${++tagSequence}`;
}

// Upgrade candidates may shadow accessors with own properties; hydration must delete them before restoring in declaration order.
describe("component property runtime", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("hydrates attribute-backed and callback-only properties assigned before upgrade", () => {
    const tag = uniqueTag("hydrate");
    const element = document.createElement(tag) as HTMLElement & HydratedProperties;
    const callback = vi.fn();
    element.value = 7;
    element.defaultValue = 3;
    element.onChange = callback;
    document.body.append(element);

    const assignments: string[] = [];
    defineComponent<unknown, HTMLElement, typeof hydrationProperties>(
      tag,
      HTMLElement,
      hydrationProperties,
      (host, props, _context, properties) => {
        let value = 0;
        let defaultValue = 0;
        let onChange: HydratedProperties["onChange"] = null;
        properties.install({
          value: {
            get: () => value,
            set: (next) => {
              assignments.push(`value:${next}`);
              value = Number(next);
              host.setAttribute("value", String(next));
            },
          },
          defaultValue: {
            get: () => defaultValue,
            set: (next) => {
              assignments.push(`defaultValue:${next}`);
              defaultValue = Number(next);
              host.setAttribute("default-value", String(next));
            },
          },
          onChange: {
            get: () => onChange,
            set: (next) => {
              assignments.push("onChange");
              onChange = next as HydratedProperties["onChange"];
            },
          },
        });

        expect(props.value()).toBe("7");
        expect(props.defaultValue()).toBe("3");
      },
    );

    expect(assignments).toEqual(["value:7", "defaultValue:3", "onChange"]);
    expect(element.value).toBe(7);
    expect(element.defaultValue).toBe(3);
    expect(element.onChange).toBe(callback);
    expect(Object.hasOwn(element, "value")).toBe(true);
    expect(
      (customElements.get(tag) as CustomElementConstructor & { observedAttributes: string[] })
        .observedAttributes,
    ).toEqual(["class", "value", "default-value"]);
  });

  it("runs reactive synchronization once initially and disposes every effect", () => {
    const reads = vi.fn();
    const dispose = useEffects(reads, reads);
    expect(reads).toHaveBeenCalledTimes(2);

    dispose();
  });
});

describe("button decoration", () => {
  it("settles class synchronization and preserves author class updates", async () => {
    const button = document.createElement("button");
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver((records) => mutations.push(...records));
    observer.observe(button, { attributes: true, attributeFilter: ["class"] });

    decorateButton(button, "control", "bwc-control", "author");
    await Promise.resolve();
    expect(button.className).toBe("control author");
    expect(mutations).toHaveLength(1);

    decorateButton(button, "control", "bwc-control", button.className);
    await Promise.resolve();
    expect(mutations).toHaveLength(1);

    button.className = "updated";
    decorateButton(button, "control", "bwc-control", button.className);
    await Promise.resolve();
    expect(button.className).toBe("control updated");
    expect(mutations).toHaveLength(3);
    observer.disconnect();
  });
});

describe("part class composition", () => {
  it.each([
    ["marker", "", "", "marker"],
    ["marker", "author marker author", "special marker", "marker author special"],
    ["marker", "  author\tother  ", " other special ", "marker author other special"],
  ])("composes stable marker, author, and part classes", (marker, author, part, expected) => {
    expect(partClassName(marker, author, part)).toBe(expected);
  });
});

describe("shared input validation", () => {
  it("validates JSON string arrays", () => {
    expect(parseJsonStrings('["a","b"]', "value")).toEqual(["a", "b"]);
    expect(() => parseJsonStrings('["a",""]', "value")).toThrow(/JSON string array/);
    expect(() => parseJsonStrings("not-json", "value")).toThrow(/JSON string array/);
  });

  it("rejects non-finite numbers and unknown enum values", () => {
    expect(() => finiteNumber("Infinity", "offset")).toThrow(/finite/);
    expect(() => enumValue("diagonal", ["top", "bottom"] as const, "bottom", "side")).toThrow(
      /side must be one of/,
    );
  });
});
