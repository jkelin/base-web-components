import "basic-web-components/counter";
import "basic-web-components/accordion";
import "basic-web-components/modal";
import "basic-web-components/popover";
import "basic-web-components/switch";
import "basic-web-components/otp";
import "basic-web-components/tabs";

// Boundary types for runtime-installed custom-element properties.
interface CounterElement extends HTMLElement {
  onChange: ((value: number) => void) | null;
}

interface OtpElement extends HTMLElement {
  value: string;
}
interface SwitchElement extends HTMLElement {
  checked: boolean;
  onCheckedChange: ((value: boolean) => void) | null;
}

const result = document.querySelector<HTMLOutputElement>("#smoke-result");
if (!result) throw new Error("smoke-result output is missing");

// Slow upgrades are allowed, but a missing render must fail with a real error.
async function waitFor(readValue: () => unknown, expected: unknown, description: string) {
  for (let frame = 0; frame < 20; frame += 1) {
    if (readValue() === expected) return;
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => resolve());
    await promise;
  }
  throw new Error(`${description}: expected ${String(expected)}, received ${String(readValue())}`);
}

// Every fixture lookup shares one lockstep contract: a missing fixture throws.
function required<T extends Element = Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`missing fixture ${selector}`);
  return node;
}

async function exerciseCounter() {
  await Promise.all(
    ["bwc-counter", "bwc-counter-minus-button", "bwc-counter-label", "bwc-counter-plus-button"].map(
      (tag) => customElements.whenDefined(tag),
    ),
  );
  document.querySelector("#rail-counter")?.setAttribute("data-state", "ready");

  const minus = required<HTMLButtonElement>("#smoke-minus-button");
  const label = required("#smoke-label");
  const plus = required<HTMLButtonElement>("#smoke-plus-button");

  // Customized built-ins upgrade on their native hosts: no nested controls.
  if (minus.localName !== "button" || plus.localName !== "button") {
    throw new Error("counter buttons are not native button hosts");
  }
  if (label.localName !== "span") throw new Error("counter label is not a native span host");
  if (minus.children.length || label.children.length || plus.children.length) {
    throw new Error("counter controls rendered nested elements");
  }

  await waitFor(() => label.textContent, "3", "counter initial label");
  minus.click();
  await waitFor(() => label.textContent, "2", "counter decrement");
  plus.click();
  await waitFor(() => label.textContent, "3", "counter first increment");
  plus.click();
  await waitFor(() => label.textContent, "4", "counter second increment");
}

async function exerciseControlled() {
  const counter = required<CounterElement>("#controlled-counter");
  const label = required("#controlled-label");
  const plus = required<HTMLButtonElement>("#controlled-plus-button");
  const output = required<HTMLOutputElement>("#controlled-value");

  await waitFor(() => label.textContent, "5", "controlled initial label");

  const seen: Array<number> = [];
  counter.onChange = (value) => {
    seen.push(value);
    counter.setAttribute("value", String(value));
    output.value = String(value);
  };

  plus.click();
  await waitFor(() => seen.join(","), "6", "controlled notification");
  // Controlled rendering only follows the external `value` set above.
  await waitFor(() => label.textContent, "6", "controlled external update");
  if (output.value !== "6") throw new Error("controlled consumer value did not sync");
}
async function exerciseSuites() {
  await Promise.all(
    [
      "bwc-accordion",
      "bwc-accordion-trigger",
      "bwc-modal",
      "bwc-modal-trigger",
      "bwc-modal-popup",
      "bwc-modal-close",
      "bwc-popover",
      "bwc-popover-trigger",
      "bwc-popover-popup",
      "bwc-popover-close",
      "bwc-switch",
      "bwc-otp",
      "bwc-tabs",
      "bwc-tab",
    ].map((tag) => customElements.whenDefined(tag)),
  );
  for (const entry of ["accordion", "modal", "popover", "switch", "otp", "tabs"]) {
    document.querySelector(`#rail-${entry}`)?.setAttribute("data-state", "ready");
  }
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());
  await promise;

  // Accordion toggles open, then closes again.
  const accordionTrigger = required<HTMLButtonElement>("#smoke-accordion-trigger");
  const accordionPanel = required<HTMLElement>("#smoke-accordion-panel");
  accordionTrigger.click();
  if (accordionPanel.hidden) throw new Error("accordion did not open");
  accordionTrigger.click();
  await waitFor(() => accordionPanel.hidden, true, "accordion close");

  // Switch toggles its generated button, thumb, and native form input.
  const switchLabel = required<HTMLLabelElement>("#smoke-switch-label");
  const switchRoot = required<SwitchElement>("#smoke-switch");
  if (
    switchRoot.getAttribute("button-class") === null ||
    switchRoot.getAttribute("thumb-class") === null ||
    switchRoot.getAttribute("input-class") === null
  ) {
    throw new Error("switch part-class inputs are missing");
  }
  const switchButton = switchRoot.querySelector<HTMLButtonElement>(
    '[data-testid="bwc-switch-button"]',
  );
  const switchThumb = switchRoot.querySelector('[data-testid="bwc-switch-thumb"]');
  const switchInput = switchRoot.querySelector<HTMLInputElement>(
    '[data-testid="bwc-switch-input"]',
  );
  if (!switchButton || !switchThumb || !switchInput) {
    throw new Error("switch generated parts are missing");
  }
  if (switchButton.id !== "smoke-switch-button") {
    throw new Error("switch button id is not derived from root id");
  }
  if (switchLabel.getAttribute("for") !== switchButton.id) {
    throw new Error("switch label does not target the generated button");
  }
  if (switchButton.getAttribute("role") !== "switch") {
    throw new Error("switch button lacks switch role");
  }
  if (switchButton.getAttribute("aria-checked") !== "false") {
    throw new Error("switch starts checked");
  }
  let switchNotifications = 0;
  switchRoot.onCheckedChange = () => {
    switchNotifications += 1;
  };
  switchLabel.click();
  await waitFor(() => switchInput.checked, true, "switch native input");
  if (switchNotifications !== 1) throw new Error("switch label did not notify exactly once");
  if (switchButton.getAttribute("aria-checked") !== "true") {
    throw new Error("switch did not report checked");
  }
  if (!switchRoot.hasAttribute("data-checked") || !switchThumb.hasAttribute("data-checked")) {
    throw new Error("switch checked state did not propagate");
  }
  if (switchInput.value !== "on") throw new Error("switch form value is not on");

  // Tabs switch panels on click.
  const tabOne = required<HTMLButtonElement>("#smoke-tab-one");
  const tabTwo = required<HTMLButtonElement>("#smoke-tab-two");
  const panelOne = required<HTMLElement>("#smoke-tab-panel-one");
  const panelTwo = required<HTMLElement>("#smoke-tab-panel-two");
  tabTwo.click();
  if (!panelOne.hidden || panelTwo.hidden) throw new Error("tabs did not select");

  // Modal opens its native dialog host and closes it.
  const modalRoot = required("#smoke-modal");
  if (
    modalRoot.getAttribute("trigger-class") === null ||
    modalRoot.getAttribute("popup-class") === null ||
    modalRoot.getAttribute("close-class") === null
  ) {
    throw new Error("modal part-class inputs are missing");
  }
  const modalTrigger = required<HTMLButtonElement>("#smoke-modal-trigger");
  const modalPopup = required("#smoke-modal-popup");
  const modalClose = required<HTMLButtonElement>("#smoke-modal-close");
  if (!(modalPopup instanceof HTMLDialogElement)) {
    throw new Error("modal popup is not a native dialog host");
  }
  modalTrigger.click();
  await waitFor(() => modalPopup.open, true, "modal open");
  await waitFor(
    () => document.documentElement.style.overflow,
    "hidden",
    "modal background scroll lock",
  );
  modalClose.click();
  await waitFor(() => modalPopup.open, false, "modal close");
  await waitFor(() => document.documentElement.style.overflow, "", "modal scroll restore");

  // Popover reports open state and closes.
  const popoverTrigger = required<HTMLButtonElement>("#smoke-popover-trigger");
  const popoverPopup = required<HTMLElement>("#smoke-popover-popup");
  const popoverClose = required<HTMLButtonElement>("#smoke-popover-close");
  if (popoverPopup.localName !== "div") {
    throw new Error("popover popup is not a native div host");
  }
  popoverTrigger.click();
  await waitFor(() => popoverTrigger.getAttribute("aria-expanded"), "true", "popover open");
  if (!popoverPopup.hasAttribute("data-open")) {
    throw new Error("popover popup did not report open state");
  }
  if (popoverPopup.style.position !== "fixed") {
    throw new Error("popover popup is not fixed-positioned");
  }
  if (popoverPopup.style.inset !== "0px auto auto 0px") {
    throw new Error("popover popup lacks the static zero-origin inset");
  }
  if (popoverPopup.style.margin !== "0px") {
    throw new Error("popover popup margin is not zero");
  }
  for (const [edge, value] of [
    ["top", popoverPopup.style.top],
    ["left", popoverPopup.style.left],
  ] as const) {
    if (value !== "" && value !== "0px") {
      throw new Error(`popover popup uses dynamic ${edge} instead of transform`);
    }
  }
  if (!popoverPopup.style.transform.includes("translate3d")) {
    throw new Error("popover popup is not transform-positioned");
  }
  popoverClose.click();
  await waitFor(() => popoverTrigger.getAttribute("aria-expanded"), "false", "popover close");

  // Length-generated OTP fields settle in one task; paste through the first field syncs value and hidden input.
  const otp = required<OtpElement>("#smoke-otp");
  if (otp.getAttribute("length") !== "4") throw new Error("otp root length is not 4");
  if (otp.getAttribute("field-class") === null || otp.getAttribute("hidden-input-class") === null) {
    throw new Error("otp part-class inputs are missing");
  }
  if (otp.querySelector("[is]") !== null) {
    throw new Error("otp fields must be generated, not customized built-ins");
  }
  await waitFor(
    () => otp.querySelectorAll('input[data-testid="bwc-otp-input"]').length,
    4,
    "otp generated fields",
  );
  const otpFields = [
    ...otp.querySelectorAll<HTMLInputElement>('input[data-testid="bwc-otp-input"]'),
  ];
  const otpInput = otpFields[0];
  if (!otpInput) throw new Error("otp has no editable field");
  const clipboard = new DataTransfer();
  clipboard.setData("text", "12a34");
  otpInput.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: clipboard }));
  await waitFor(() => otp.value, "1234", "otp paste filtering");
  if (otpInput.getAttribute("aria-label") !== "Character 1 of 4") {
    throw new Error("otp field labeling is wrong");
  }
  const otpHidden = otp.querySelector<HTMLInputElement>('[data-testid="bwc-otp-hidden-input"]');
  if (otpHidden?.value !== "1234") throw new Error("otp hidden input did not sync");

  // Tabs move keyboard focus without breaking selection.
  tabTwo.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await waitFor(() => document.activeElement, tabOne, "tabs keyboard focus");
}

try {
  await exerciseCounter();
  await exerciseControlled();
  await exerciseSuites();

  result.value = "PASS: counter and all six suites work";
  result.dataset.status = "pass";
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  result.value = `FAIL: ${message}`;
  result.dataset.status = "fail";
  throw error;
}
