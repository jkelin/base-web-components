import { componentDefinitions } from "./components";

import {
  ATOMICO_COUNTER_LABEL_TAG,
  ATOMICO_COUNTER_MINUS_TAG,
  ATOMICO_COUNTER_PLUS_TAG,
  ATOMICO_COUNTER_TAG,
  AtomicoCounterElement,
} from "./counter";
import { AtomicoCounterLabelElement } from "./counter-label";
import { AtomicoCounterMinusElement } from "./counter-minus-button";
import { AtomicoCounterPlusElement } from "./counter-plus-button";

if (!customElements.get(ATOMICO_COUNTER_TAG)) {
  customElements.define(ATOMICO_COUNTER_TAG, AtomicoCounterElement);
}
if (!customElements.get(ATOMICO_COUNTER_MINUS_TAG)) {
  customElements.define(ATOMICO_COUNTER_MINUS_TAG, AtomicoCounterMinusElement);
}
if (!customElements.get(ATOMICO_COUNTER_LABEL_TAG)) {
  customElements.define(ATOMICO_COUNTER_LABEL_TAG, AtomicoCounterLabelElement);
}
if (!customElements.get(ATOMICO_COUNTER_PLUS_TAG)) {
  customElements.define(ATOMICO_COUNTER_PLUS_TAG, AtomicoCounterPlusElement);
}
for (const [tag, constructor] of componentDefinitions) {
  if (!customElements.get(tag)) customElements.define(tag, constructor);
}

export {
  ATOMICO_COUNTER_LABEL_TAG,
  ATOMICO_COUNTER_MINUS_TAG,
  ATOMICO_COUNTER_PLUS_TAG,
  ATOMICO_COUNTER_TAG,
  AtomicoCounterElement,
  parseCounterValue,
} from "./counter";
export { AtomicoCounterLabelElement } from "./counter-label";
export { AtomicoCounterMinusElement } from "./counter-minus-button";
export { AtomicoCounterPlusElement } from "./counter-plus-button";
export { componentDefinitions } from "./components";
export * from "./accordion";
export * from "./modal";
export * from "./popover";
export * from "./toggle-checkbox";
export * from "./otp-field";
export * from "./tabs";
