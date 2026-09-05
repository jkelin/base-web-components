import { effect, isSignal } from "alien-signals";

export type HtmlPrimitive = string | number | boolean | null | undefined;

export type HtmlValue = HtmlPrimitive | EventListener | (() => HtmlPrimitive);

// Setup bindings encode the interpolation index as its bitwise complement.
export type TemplateBinding = [index: number, apply: (value: HtmlValue) => void | (() => void)];

function markerIndex(text: string, valueCount: number): number {
  const index = Number(text);
  if (!/^\d+$/.test(text) || index >= valueCount) {
    throw new Error("Invalid interpolation marker.");
  }
  return index;
}
function rejectHandler(value: unknown): asserts value is HtmlPrimitive {
  if (typeof value === "function") {
    throw new TypeError("Interpolation cannot be a handler.");
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
      if (!attribute.value.startsWith(marker) || !attribute.value.endsWith(";")) {
        continue;
      }
      const indexText = attribute.value.slice(marker.length, -1);
      const index = markerIndex(indexText, valueCount);
      const attributeName = attribute.name;
      node.removeAttribute(attributeName);
      if (attributeName.startsWith("bind:")) {
        const directive = /^bind:on([^:]+):([^:]+)$/.exec(attributeName);
        if (!directive) {
          throw new Error("Invalid field binding.");
        }
        const eventName = directive[1]!;
        const fieldName = directive[2]!;
        if (!(fieldName in node)) {
          throw new Error("Unknown bound field.");
        }

        bindings.push([
          ~index,
          (value) => {
            if (typeof value !== "function" || !isSignal(value as () => void)) {
              throw new TypeError("Expected writable signal.");
            }

            // Read the bound node, not a bubbling event's potentially different target.
            const updateSignal = () => {
              const fieldValue: unknown = (node as unknown as Record<string, unknown>)[fieldName];
              if (
                fieldValue !== null &&
                fieldValue !== undefined &&
                !"string number boolean".includes(typeof fieldValue)
              ) {
                throw new TypeError("Bound field must be primitive.");
              }
              (value as (next: HtmlPrimitive) => void)(fieldValue as HtmlPrimitive);
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
          ~index,
          (value) => {
            if (value !== null && (typeof value !== "function" || isSignal(value as () => void))) {
              throw new TypeError("Expected event handler.");
            }
            (node as unknown as Record<string, unknown>)[attributeName] = value;
            return () => {
              (node as unknown as Record<string, unknown>)[attributeName] = null;
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
  const markerPattern = new RegExp(`${marker}(\\d+);`, "g");
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
        markerIndex(match[1]!, valueCount),
        (value) => {
          valueNode.data = String(value ?? "");
        },
      ]);
      textOffset = match.index + match[0].length;
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
        index = ~index;
      }
      if (!(index in values)) {
        throw new Error("Missing interpolation.");
      }

      const value = values[index];
      if (install) {
        cleanup.push(apply(value) as () => void);
      } else if (typeof value === "function" && isSignal(value as () => void)) {
        rejectHandler((value as () => unknown)());
        cleanup.push(
          effect(() => {
            const next = (value as () => unknown)();
            rejectHandler(next);
            apply(next);
          }),
        );
      } else {
        rejectHandler(value);
        apply(value);
      }
    }
  } catch (error) {
    unbind();
    throw error;
  }

  return unbind;
}
