import { LitElement } from "lit";

export const LIT_COUNTER_TAG = "lit-counter";
export const LIT_COUNTER_MINUS_TAG = "lit-counter-minus-button";
export const LIT_COUNTER_LABEL_TAG = "lit-counter-label";
export const LIT_COUNTER_PLUS_TAG = "lit-counter-plus-button";

/** Lenient numeric coercion: anything non-finite becomes 0. */
export function parseCounterValue(raw: unknown): number {
  const value =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

/** Light-DOM state controller for the composed counter children. */
export class LitCounterElement extends LitElement {
  static override properties = {
    count: { state: true },
  };

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "value"];
  }

  onChange: ((value: number) => void) | null = null;

  declare private count: number;
  private controlled = false;
  private assignedValue: number | undefined;
  private assignedDefault: number | undefined;
  private observer: MutationObserver | null = null;

  constructor() {
    super();
    this.count = 0;
  }

  get defaultValue(): number {
    return this.assignedDefault ?? parseCounterValue(this.getAttribute("default-value"));
  }

  set defaultValue(next: number) {
    // Defaults are initial state, so later assignments apply on the next reconnect.
    this.assignedDefault = parseCounterValue(next);
  }

  get value(): number {
    return this.count;
  }

  set value(next: number) {
    this.controlled = true;
    this.assignedValue = parseCounterValue(next);
    this.setAttribute("value", String(this.assignedValue));
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    if (this.hasAttribute("value")) {
      this.controlled = true;
      this.count = parseCounterValue(this.getAttribute("value"));
    } else if (this.assignedValue !== undefined) {
      this.controlled = true;
      this.count = this.assignedValue;
      this.setAttribute("value", String(this.count));
    } else {
      this.count = this.defaultValue;
    }

    super.connectedCallback();
    this.addEventListener("click", this.onClick);
    this.observer = new MutationObserver(() => this.syncLabel());
    this.observer.observe(this, { childList: true, subtree: true });
    this.syncLabel();
  }

  override disconnectedCallback(): void {
    this.removeEventListener("click", this.onClick);
    this.observer?.disconnect();
    this.observer = null;
    super.disconnectedCallback();
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name !== "value" || !this.isConnected) {
      return;
    }

    this.controlled = true;
    const parsed = parseCounterValue(newValue);
    if (parsed !== this.count) {
      this.count = parsed;
    }
  }

  protected override updated(): void {
    this.syncLabel();
  }

  private readonly onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const origin = target?.closest?.(`${LIT_COUNTER_MINUS_TAG},${LIT_COUNTER_PLUS_TAG}`);
    if (!origin || !this.contains(origin)) {
      return;
    }

    const delta = origin.tagName.toLowerCase() === LIT_COUNTER_PLUS_TAG ? 1 : -1;
    this.commit(this.count + delta);
  };

  private commit(next: number): void {
    if (!this.controlled) {
      this.count = next;
    }

    this.onChange?.(next);
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: { value: next },
      }),
    );
  }

  private syncLabel(): void {
    this.querySelector(LIT_COUNTER_LABEL_TAG)?.setAttribute("value", String(this.count));
  }
}

if (!customElements.get(LIT_COUNTER_TAG)) {
  customElements.define(LIT_COUNTER_TAG, LitCounterElement);
}
