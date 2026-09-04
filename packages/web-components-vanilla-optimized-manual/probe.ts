import { Window } from "happy-dom";
const window = new Window();
Object.assign(globalThis, {
  customElements: window.customElements,
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLButtonElement: window.HTMLButtonElement,
  Element: window.Element,
  CustomEvent: window.CustomEvent,
});
// Globals must be installed before the custom-element module evaluates.
await import("./src/index");
document.body.innerHTML = `<manually-optimized-counter default-value="5"><manually-optimized-counter-minus-button class="btn"></manually-optimized-counter-minus-button><manually-optimized-counter-label class="lbl"></manually-optimized-counter-label><manually-optimized-counter-plus-button class="btn"></manually-optimized-counter-plus-button></manually-optimized-counter>`;
const host = document.querySelector("manually-optimized-counter")!;
const buttons = host.querySelectorAll("button");
const label = host.querySelector("span")!;
console.log(
  Array.from(host.children).map((child) => ({
    tag: child.tagName,
    class: child.className,
    html: child.innerHTML,
  })),
);
console.log({
  buttonCount: buttons.length,
  label: label.textContent,
  value: (host as HTMLElement & { value: number }).value,
});
(buttons[1] as HTMLButtonElement).click();
console.log({
  labelAfter: label.textContent,
  valueAfter: (host as HTMLElement & { value: number }).value,
});
