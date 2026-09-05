import { effect, isSignal } from "alien-signals";

export type HtmlPrimitive = string | number | boolean | null | undefined;

export type HtmlValue = HtmlPrimitive | EventListener | (() => HtmlPrimitive);

export const SETUP_INDEX_OFFSET = 1;
const MARKER_INDEX_GROUP = 1;
const DIRECTIVE_EVENT_GROUP = 1;
const DIRECTIVE_FIELD_GROUP = 2;
const MATCH_TEXT_GROUP = 0;
export const MARKER_TERMINATOR = ";";

// Tuple slots are [encoded value index, updater]. Listeners use `-(index + 1)`,
// so value index zero encodes as -1 without bitwise 32-bit truncation.
export type TemplateBinding = [
  encodedIndex: number,
  apply: (value: HtmlValue) => void | (() => void),
];

function markerIndex(text: string, valueCount: number): number {
  const index = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(index) || index >= valueCount) {
    throw new Error("Invalid interpolation marker.");
  }
  return index;
}
function assertPrimitive(value: unknown): asserts value is HtmlPrimitive {
  if (
    value !== null &&
    value !== undefined &&
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new TypeError("Interpolation must be primitive.");
  }
}

// Only complete attribute markers are bindings; malformed markers fail at render time.
export function extractAttributeBindings(
  root: ParentNode,
  valueCount: number,
  marker: string,
): TemplateBinding[] {
  const bindings: TemplateBinding[] = [];

  for (const node of root.querySelectorAll("*")) {
    for (
      let attributeIndex = node.attributes.length - 1;
      attributeIndex >= 0;
      attributeIndex -= 1
    ) {
      const attribute = node.attributes[attributeIndex]!;
      if (!attribute.value.startsWith(marker) || !attribute.value.endsWith(MARKER_TERMINATOR)) {
        continue;
      }
      const indexText = attribute.value.slice(marker.length, -MARKER_TERMINATOR.length);
      const index = markerIndex(indexText, valueCount);
      const attributeName = attribute.name;
      node.removeAttribute(attributeName);
      if (attributeName.startsWith("bind:")) {
        const directive = /^bind:on([^:]+):([^:]+)$/.exec(attributeName);
        if (!directive) {
          throw new Error("Invalid field binding.");
        }
        const eventName = directive[DIRECTIVE_EVENT_GROUP]!;
        const fieldName = directive[DIRECTIVE_FIELD_GROUP]!;
        if (!(fieldName in node)) {
          throw new Error("Unknown bound field.");
        }

        bindings.push([
          -index - SETUP_INDEX_OFFSET,
          (value) => {
            if (typeof value !== "function" || !isSignal(value as () => void)) {
              throw new TypeError("Expected writable signal.");
            }

            // Read the bound node, not a bubbling event's potentially different target.
            const updateSignal = () => {
              const fieldValue: unknown = (node as unknown as Record<string, unknown>)[fieldName];
              assertPrimitive(fieldValue);
              (value as (next: HtmlPrimitive) => void)(fieldValue);
            };

            // Capture precedes normal on-event handlers regardless of registration order.
            node.addEventListener(eventName, updateSignal, true);
            return () => node.removeEventListener(eventName, updateSignal, true);
          },
        ]);
        continue;
      }

      if (attributeName.startsWith("on")) {
        bindings.push([
          -index - SETUP_INDEX_OFFSET,
          (value) => {
            if (value !== null && (typeof value !== "function" || isSignal(value as () => void))) {
              throw new TypeError("Expected event handler.");
            }
            const handler = value;
            const eventProperty = node as unknown as Record<string, unknown>;
            eventProperty[attributeName] = handler;
            return () => {
              // Preserve a handler assigned directly after this binding took ownership.
              if (eventProperty[attributeName] === handler) {
                eventProperty[attributeName] = null;
              }
            };
          },
        ]);
      } else {
        bindings.push([
          index,
          (value) => {
            if (value === false || value === null || value === undefined) {
              node.removeAttribute(attributeName);
            } else {
              node.setAttribute(attributeName, value === true ? "" : String(value));
            }
          },
        ]);
      }
    }
  }

  return bindings;
}

// Mixed static text and multiple markers are split into stable, independently updated nodes.
export function extractTextBindings(
  root: Node,
  valueCount: number,
  marker: string,
  bindings: TemplateBinding[] = [],
): TemplateBinding[] {
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  // Internal callers must supply a regex-safe marker; html() guarantees digits plus ":".
  const markerPattern = new RegExp(`${marker}(\\d+)${MARKER_TERMINATOR}`, "g");
  let textNode = textWalker.nextNode() as Text | null;
  while (textNode) {
    const nextTextNode = textWalker.nextNode() as Text | null;
    const text = textNode.data;
    let match = markerPattern.exec(text);
    if (!match) {
      textNode = nextTextNode;
      continue;
    }

    const replacement = document.createDocumentFragment();
    let textOffset = 0;
    do {
      replacement.append(text.slice(textOffset, match.index));
      const valueNode = document.createTextNode("");
      replacement.append(valueNode);
      bindings.push([
        markerIndex(match[MARKER_INDEX_GROUP]!, valueCount),
        (value) => {
          valueNode.data = String(value ?? "");
        },
      ]);
      textOffset = match.index + match[MATCH_TEXT_GROUP]!.length;
    } while ((match = markerPattern.exec(text)));

    replacement.append(text.slice(textOffset));
    textNode.replaceWith(replacement);
    textNode = nextTextNode;
  }

  return bindings;
}
// Failed setup rolls back listeners and effects; disposal is safe before reconnecting.
export function bindTemplateBindings(bindings: TemplateBinding[], values: HtmlValue[]): () => void {
  const cleanup: (() => void)[] = [];
  const unbind = () => {
    for (const dispose of cleanup) {
      dispose();
    }
    cleanup.length = 0;
  };

  try {
    for (let [index, apply] of bindings) {
      const install = index < 0;
      if (install) {
        index = -index - SETUP_INDEX_OFFSET;
      }
      if (!(index in values)) {
        throw new Error("Missing interpolation.");
      }

      const value = values[index];
      if (install) {
        cleanup.push(apply(value) as () => void);
      } else if (typeof value === "function" && isSignal(value as () => void)) {
        let initialValue: unknown;
        let initialRun = true;
        const dispose = effect(() => {
          const next = (value as () => unknown)();
          if (initialRun) {
            // Defer validation and DOM writes until the disposer is owned.
            initialValue = next;
          } else {
            assertPrimitive(next);
            apply(next);
          }
        });
        cleanup.push(dispose);
        initialRun = false;
        assertPrimitive(initialValue);
        apply(initialValue);
      } else {
        assertPrimitive(value);
        apply(value);
      }
    }
  } catch (error) {
    unbind();
    throw error;
  }

  return unbind;
}
