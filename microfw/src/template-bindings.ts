import { isSignal } from "alien-signals";

export const interpolationMarkerPrefix = "microfw:";

export type HtmlPrimitive = string | number | boolean | null | undefined;

export type TemplateBinding = {
  index: number;
  isEventHandler: boolean;
  set: (value: HtmlPrimitive | EventListener) => void;
};

// Boolean attributes use presence semantics; nullish and false values remove them.
function setAttributeValue(node: Element, name: string, value: HtmlPrimitive): void {
  if (value === false || value === null || value === undefined) {
    node.removeAttribute(name);
    return;
  }

  node.setAttribute(name, value === true ? "" : String(value));
}

// Only complete attribute markers are bindings; malformed markers fail at render time.
export function extractAttributeBindings(root: ParentNode, valueCount: number): TemplateBinding[] {
  const bindings: TemplateBinding[] = [];

  for (const node of Array.from(root.querySelectorAll("*"))) {
    for (const attribute of Array.from(node.attributes)) {
      if (!attribute.value.startsWith(interpolationMarkerPrefix)) {
        continue;
      }

      const markerMatch = attribute.value.match(/^microfw:(\d+)$/);
      const index = markerMatch ? Number.parseInt(markerMatch[1]!, 10) : Number.NaN;
      if (!Number.isSafeInteger(index) || index >= valueCount) {
        throw new Error(`Invalid template interpolation marker "${attribute.value}".`);
      }

      node.removeAttribute(attribute.name);
      const isEventHandler = attribute.name.startsWith("on");
      bindings.push({
        index,
        isEventHandler,
        set: isEventHandler
          ? (value) => {
              if (value === null) {
                Object.assign(node, { [attribute.name]: null });
                return;
              }

              if (typeof value !== "function" || isSignal(value as () => void)) {
                throw new TypeError(`Event binding "${attribute.name}" requires a handler.`);
              }

              Object.assign(node, { [attribute.name]: value });
            }
          : (value) => {
              if (typeof value === "function") {
                throw new TypeError(`Attribute binding "${attribute.name}" cannot use a handler.`);
              }

              setAttributeValue(node, attribute.name, value);
            },
      });
    }
  }

  return bindings;
}

// Mixed static text and multiple markers are split into stable, independently updated nodes.
export function extractTextBindings(root: Node, valueCount: number): TemplateBinding[] {
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (textWalker.nextNode()) {
    textNodes.push(textWalker.currentNode as Text);
  }

  const bindings: TemplateBinding[] = [];
  for (const textNode of textNodes) {
    const text = textNode.data;
    const markerPattern = /microfw:(\d+)/g;
    const replacement = document.createDocumentFragment();
    let textOffset = 0;
    let match: RegExpExecArray | null;
    let hasBinding = false;

    while ((match = markerPattern.exec(text))) {
      hasBinding = true;
      replacement.append(text.slice(textOffset, match.index));

      const index = Number.parseInt(match[1]!, 10);
      if (!Number.isSafeInteger(index) || index >= valueCount) {
        throw new Error(`Invalid text interpolation marker "${match[0]}".`);
      }

      const valueNode = document.createTextNode("");
      replacement.append(valueNode);
      bindings.push({
        index,
        isEventHandler: false,
        set: (value) => {
          if (typeof value === "function") {
            throw new TypeError("Text bindings cannot use event handlers.");
          }

          valueNode.data = value === null || value === undefined ? "" : String(value);
        },
      });

      textOffset = match.index + match[0].length;
    }

    // Static text nodes contain no marker and must retain their original identity.
    if (!hasBinding) {
      continue;
    }

    replacement.append(text.slice(textOffset));
    textNode.replaceWith(replacement);
  }

  return bindings;
}
