import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  type ChangeCallback,
  booleanProp,
  classProp,
  createControl,
  emit,
  initializeBooleanProps,
  nextId,
  preserveChildren,
  type SolidElementHost,
  useLightDom,
  watchChildren,
} from "./shared";

export const SOLID_MODAL_TAG = "solid-modal";
export const SOLID_MODAL_TRIGGER_TAG = "solid-modal-trigger";
export const SOLID_MODAL_POPUP_TAG = "solid-modal-popup";
export const SOLID_MODAL_CLOSE_TAG = "solid-modal-close";

interface ControlProps {
  hostClass: string;
  disabled: boolean;
}

const controlProps = { hostClass: classProp, disabled: booleanProp("disabled") };

export const SolidModalTriggerElement = customElement<ControlProps>(
  SOLID_MODAL_TRIGGER_TAG,
  controlProps,
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "button", "modal-trigger"),
);

export const SolidModalCloseElement = customElement<ControlProps>(
  SOLID_MODAL_CLOSE_TAG,
  controlProps,
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "button", "modal-close"),
);

interface PopupProps extends ControlProps {
  ariaLabel: string;
  ariaLabelledby: string;
  ariaDescribedby: string;
}

const stringAttribute = (attribute: string) => ({
  value: "",
  attribute,
  notify: false,
  reflect: false,
  parse: false,
});

export const SolidModalPopupElement = customElement<PopupProps>(
  SOLID_MODAL_POPUP_TAG,
  {
    ...controlProps,
    ariaLabel: stringAttribute("aria-label"),
    ariaLabelledby: stringAttribute("aria-labelledby"),
    ariaDescribedby: stringAttribute("aria-describedby"),
  },
  (props, { element }) => {
    const dialog = createControl(
      element as unknown as SolidElementHost,
      props,
      "dialog",
      "modal-popup",
    );
    createEffect(() => {
      for (const [name, value] of [
        ["aria-label", props.ariaLabel],
        ["aria-labelledby", props.ariaLabelledby],
        ["aria-describedby", props.ariaDescribedby],
      ] as const) {
        if (value) dialog.setAttribute(name, value);
        else dialog.removeAttribute(name);
      }
    });
    return dialog;
  },
);

interface ModalProps {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  onOpenChange: ChangeCallback<boolean>;
}

export const SolidModalElement = customElement<ModalProps>(
  SOLID_MODAL_TAG,
  {
    open: booleanProp("open", false),
    defaultOpen: booleanProp("default-open"),
    disabled: booleanProp("disabled"),
    onOpenChange: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & ModalProps;
    preserveChildren(host);
    initializeBooleanProps(host, {
      open: "open",
      defaultOpen: "default-open",
      disabled: "disabled",
    });

    let controlled = host.hasAttribute("open");
    let internalWrite = false;
    let restore: HTMLElement | null = null;
    let currentDialog: HTMLDialogElement | null = null;
    host.addPropertyChangedCallback((name) => {
      if (name === "open" && !internalWrite) controlled = true;
    });
    const setOpen = (open: boolean): void => {
      internalWrite = true;
      host.open = open;
      internalWrite = false;
    };
    setOpen(controlled ? host.hasAttribute("open") : host.hasAttribute("default-open"));

    const requestOpen = (open: boolean): void => {
      if (host.hasAttribute("disabled") || open === Boolean(props.open)) return;
      emit(host, props.onOpenChange, "open-change", "open", open);
      if (!controlled) setOpen(open);
    };
    const sync = (): void => {
      const open = Boolean(props.open);
      const trigger = host.querySelector<HTMLButtonElement>(`${SOLID_MODAL_TRIGGER_TAG} > button`);
      const popup = host.querySelector<HTMLElement>(SOLID_MODAL_POPUP_TAG);
      const dialog = popup?.querySelector<HTMLDialogElement>("dialog") ?? null;
      if (!trigger || !popup || !dialog) return;
      currentDialog = dialog;
      const disabled = host.hasAttribute("disabled");
      trigger.id ||= nextId(`${SOLID_MODAL_TRIGGER_TAG}-button`);
      popup.id ||= nextId(SOLID_MODAL_POPUP_TAG);
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", String(open));
      trigger.setAttribute("aria-controls", popup.id);
      trigger.toggleAttribute("disabled", disabled);
      trigger.style.cursor = disabled ? "not-allowed" : "pointer";
      for (const node of [trigger.parentElement!, popup, dialog]) {
        node.toggleAttribute("data-open", open);
        node.toggleAttribute("data-closed", !open);
        node.toggleAttribute("data-disabled", disabled);
      }
      if (open && !dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      if (!open && dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
        restore?.focus();
      }
    };
    createEffect(sync);
    watchChildren(host, sync);

    const onClick = (event: MouseEvent): void => {
      const target = event.target as Element;
      if (target.closest(`${SOLID_MODAL_TRIGGER_TAG} > button`)) {
        restore = target as HTMLElement;
        requestOpen(true);
      }
      if (target.closest(`${SOLID_MODAL_CLOSE_TAG} > button`)) requestOpen(false);
      if (target === currentDialog && currentDialog) {
        const rect = currentDialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          requestOpen(false);
      }
    };
    const onCancel = (event: Event): void => {
      event.preventDefault();
      requestOpen(false);
    };
    host.addEventListener("click", onClick);
    host.addEventListener("cancel", onCancel);
    onCleanup(() => {
      host.removeEventListener("click", onClick);
      host.removeEventListener("cancel", onCancel);
    });
  },
);
