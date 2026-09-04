import { c } from "atomico";
import { ATOMICO_COUNTER_PLUS_TAG } from "./counter";

// Inline render callbacks let Atomico infer declared prop types.
export const AtomicoCounterPlusElement = c(
  ({ class: forwardedClass = "" }) => {
    const className = forwardedClass
      ? `counter-plus-button ${forwardedClass}`
      : "counter-plus-button";

    return (
      <host>
        <button
          class={className}
          data-testid={ATOMICO_COUNTER_PLUS_TAG}
          type="button"
          aria-label="Increment count"
          style="cursor:pointer;user-select:none"
        >
          +
        </button>
      </host>
    );
  },
  { props: { class: String } },
);
