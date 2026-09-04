import { accordionDefinitions } from "./accordion";
import { modalDefinitions } from "./modal";
import { popoverDefinitions } from "./popover";
import { toggleCheckboxDefinitions } from "./toggle-checkbox";
import { otpFieldDefinitions } from "./otp-field";
import { tabsDefinitions } from "./tabs";

export const componentDefinitions: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  ...accordionDefinitions,
  ...modalDefinitions,
  ...popoverDefinitions,
  ...toggleCheckboxDefinitions,
  ...otpFieldDefinitions,
  ...tabsDefinitions,
];

export * from "./accordion";
export * from "./modal";
export * from "./popover";
export * from "./toggle-checkbox";
export * from "./otp-field";
export * from "./tabs";
