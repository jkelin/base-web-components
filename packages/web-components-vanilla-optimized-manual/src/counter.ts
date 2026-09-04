import { effect, signal } from "alien-signals";
import { defineComponent, Signal } from "./shared";

interface Context {
  count: Signal<number>;
}

defineComponent(
  "manually-optimized-counter",
  HTMLElement,
  [],
  (_element, _props, context) => {
    context({
      count: signal(0),
    } satisfies Context);
  },
  () => {
    defineComponent("plus-button", HTMLButtonElement, [], (element, _props, context) => {
      element.type = "button";
      element.setAttribute("aria-label", "Add count");
      element.textContent = "+";

      element.addEventListener("click", () => {
        (context as Signal<Context>)().count((context as Signal<Context>)().count() + 1);
        console.log("click plus");
      });
    });

    defineComponent("minus-button", HTMLButtonElement, [], (element, _props, context) => {
      element.type = "button";
      element.setAttribute("aria-label", "Remove count");
      element.textContent = "-";
      console.log("minus");

      element.addEventListener("click", () => {
        (context as Signal<Context>)().count((context as Signal<Context>)().count() - 1);
      });
    });

    defineComponent("label", HTMLElement, [], (element, _props, context) => {
      element.setAttribute("aria-live", "polite");
      element.textContent = "0";

      console.log("l;abel");

      effect(() => {
        console.log("change");
        element.textContent = "" + (context as Signal<Context>)().count();
      });
    });
  },
);
