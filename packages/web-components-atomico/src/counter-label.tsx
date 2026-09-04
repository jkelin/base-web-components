import { c, useHost } from "atomico";
import {
  ATOMICO_COUNTER_LABEL_TAG,
  ATOMICO_COUNTER_TAG,
  AtomicoCounterElement,
  parseCounterValue,
} from "./counter";

/**
 * Light-DOM label: renders `<span>` as a direct child so page stylesheets
 * apply. The host `class` is forwarded after a stable `counter-label` marker.
 * The `value` prop syncs from the attribute the parent sets; an upgraded
 * parent owns the count at first render.
 */
export const AtomicoCounterLabelElement = c(
  ({ class: forwardedClass = "", value: valueProp }) => {
    const host = useHost();
    const owner = host.current.closest(ATOMICO_COUNTER_TAG);
    const value = parseCounterValue(
      owner instanceof AtomicoCounterElement
        ? owner.value
        : (valueProp ?? host.current.getAttribute("value")),
    );
    const className = forwardedClass ? `counter-label ${forwardedClass}` : "counter-label";

    return (
      <host>
        <span class={className} data-testid={ATOMICO_COUNTER_LABEL_TAG} aria-live="polite">
          {String(value)}
        </span>
      </host>
    );
  },
  { props: { class: String, value: Number } },
);
