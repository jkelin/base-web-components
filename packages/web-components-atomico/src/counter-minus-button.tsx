import { c } from "atomico";
import { ATOMICO_COUNTER_MINUS_TAG } from "./counter";

// Inline render callbacks let Atomico infer declared prop types.
export const AtomicoCounterMinusElement = c(
  ({ class: forwardedClass = "" }) => {
    const className = forwardedClass
      ? `counter-minus-button ${forwardedClass}`
      : "counter-minus-button";

    return (
      <host>
        <button
          class={className}
          data-testid={ATOMICO_COUNTER_MINUS_TAG}
          type="button"
          aria-label="Decrement count"
          style="cursor:pointer;user-select:none"
        >
          −
        </button>
      </host>
    );
  },
  { props: { class: String } },
);
