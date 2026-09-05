import {
  booleanValue,
  callbackValue,
  decorateButton,
  createPartClassController,
  defineComponent,
  emit,
  nextId,
  observeChildren,
  useEffects,
  type ChangeCallback,
} from "../shared";

export const BWC_MODAL_TAG = "bwc-modal";
export const BWC_MODAL_TRIGGER_TAG = `${BWC_MODAL_TAG}-trigger`;
export const BWC_MODAL_POPUP_TAG = `${BWC_MODAL_TAG}-popup`;
export const BWC_MODAL_CLOSE_TAG = `${BWC_MODAL_TAG}-close`;

type DocumentScrollLock = {
  owners: Set<HTMLElement>;
  overflow: string;
};

const documentScrollLocks = new WeakMap<Document, DocumentScrollLock>();

function acquireDocumentScrollLock(document: Document, owner: HTMLElement): void {
  let lock = documentScrollLocks.get(document);
  if (!lock) {
    lock = {
      overflow: document.documentElement.style.overflow,
      owners: new Set(),
    };
    documentScrollLocks.set(document, lock);
  }
  if (lock.owners.size === 0) document.documentElement.style.overflow = "hidden";
  lock.owners.add(owner);
}

function releaseDocumentScrollLock(document: Document, owner: HTMLElement): void {
  const lock = documentScrollLocks.get(document);
  if (!lock || !lock.owners.delete(owner) || lock.owners.size > 0) return;
  document.documentElement.style.overflow = lock.overflow;
  documentScrollLocks.delete(document);
}

type ModalApi = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  triggerClass: string;
  popupClass: string;
  closeClass: string;
  onOpenChange: ChangeCallback<boolean>;
};

type ModalState = {
  classControllers: WeakMap<HTMLElement, (partClass?: string | null) => void>;
  controlled: boolean;
  initialized: boolean;
  onOpenChange: ChangeCallback<boolean>;
  open: boolean;
};

const modalProperties = {
  open: "open",
  defaultOpen: "default-open",
  disabled: "disabled",
  onOpenChange: null,
  triggerClass: "trigger-class",
  popupClass: "popup-class",
  closeClass: "close-class",
} as const;

export const BwcModalElement = defineComponent<ModalState, HTMLElement, typeof modalProperties>(
  BWC_MODAL_TAG,
  HTMLElement,
  modalProperties,
  (element, props, context, properties) => {
    const previous = context();
    // Defaults initialize once; reconnects retain the last uncontrolled open state.
    const state: ModalState =
      "open" in previous
        ? previous
        : {
            classControllers: new WeakMap(),
            controlled: props.open() !== null,
            initialized: false,
            onOpenChange: null,
            open: props.open() !== null,
          };
    context(state);
    let restore: HTMLElement | null = null;
    let lockedDocument: Document | null = null;
    const syncScrollLock = (dialog: HTMLDialogElement | null) => {
      const nextDocument = dialog?.open && element.isConnected ? element.ownerDocument : null;
      if (lockedDocument === nextDocument) return;
      if (lockedDocument) releaseDocumentScrollLock(lockedDocument, element);
      if (nextDocument) acquireDocumentScrollLock(nextDocument, element);
      lockedDocument = nextDocument;
    };
    const classControllers = state.classControllers;
    const applyPartClass = (part: HTMLElement, marker: string, partClass: string | null) => {
      // Controllers persist across reconnects so old part-prop tokens never become author classes.
      let apply = classControllers.get(part);
      if (!apply) {
        apply = createPartClassController(part, marker, partClass);
        classControllers.set(part, apply);
      }
      apply(partClass);
    };

    const sync = () => {
      if (!state.initialized) {
        state.initialized = true;
        if (!state.controlled) state.open = props.defaultOpen() !== null;
      }
      const trigger = element.querySelector<HTMLButtonElement>(
        `button[is="${BWC_MODAL_TRIGGER_TAG}"]`,
      );
      const dialog = element.querySelector<HTMLDialogElement>(
        `dialog[is="${BWC_MODAL_POPUP_TAG}"]`,
      );
      const close = element.querySelector<HTMLButtonElement>(`button[is="${BWC_MODAL_CLOSE_TAG}"]`);
      if (!trigger || !dialog) {
        syncScrollLock(null);
        return;
      }
      trigger.id ||= nextId(`${BWC_MODAL_TRIGGER_TAG}-button`);
      dialog.id ||= nextId(BWC_MODAL_POPUP_TAG);
      if (close) close.id ||= nextId(BWC_MODAL_CLOSE_TAG);
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", String(state.open));
      trigger.setAttribute("aria-controls", dialog.id);
      trigger.disabled = props.disabled() !== null;
      decorateButton(
        trigger,
        "modal-trigger",
        BWC_MODAL_TRIGGER_TAG,
        trigger.className.replace(/(?:^| )modal-trigger(?: |$)/g, " ").trim(),
      );
      applyPartClass(trigger, "modal-trigger", props.triggerClass());
      applyPartClass(dialog, "modal-popup", props.popupClass());
      if (close) applyPartClass(close, "modal-close", props.closeClass());
      for (const node of [trigger, dialog]) {
        node.toggleAttribute("data-open", state.open);
        node.toggleAttribute("data-closed", !state.open);
        node.toggleAttribute("data-disabled", props.disabled() !== null);
      }
      if (state.open && !dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      if (!state.open && dialog.open) {
        if (typeof dialog.close === "function") dialog.close();
        else dialog.removeAttribute("open");
        restore?.focus();
      }
      syncScrollLock(dialog);
    };

    properties.install({
      open: {
        get: () => state.open,
        set: (next) => {
          state.controlled = true;
          element.toggleAttribute("open", booleanValue(next, "open"));
        },
      },
      defaultOpen: {
        get: () => props.defaultOpen() !== null,
        set: (next) => element.toggleAttribute("default-open", booleanValue(next, "defaultOpen")),
      },
      disabled: {
        get: () => props.disabled() !== null,
        set: (next) => element.toggleAttribute("disabled", booleanValue(next, "disabled")),
      },
      triggerClass: {
        get: () => props.triggerClass() ?? "",
        set: (next) => element.setAttribute("trigger-class", String(next)),
      },
      popupClass: {
        get: () => props.popupClass() ?? "",
        set: (next) => element.setAttribute("popup-class", String(next)),
      },
      closeClass: {
        get: () => props.closeClass() ?? "",
        set: (next) => element.setAttribute("close-class", String(next)),
      },
      onOpenChange: {
        get: () => state.onOpenChange,
        set: (next) => {
          state.onOpenChange = callbackValue<boolean>(next, "onOpenChange");
        },
      },
    });

    const requestOpen = (next: boolean) => {
      if (props.disabled() !== null || next === state.open) return;
      emit(element, state.onOpenChange, "open-change", "open", next);
      if (!state.controlled) {
        state.open = next;
        sync();
      }
    };
    const click = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(`button[is="${BWC_MODAL_TRIGGER_TAG}"]`)) {
        restore = target instanceof HTMLElement ? target : null;
        requestOpen(true);
      }
      if (target.closest(`button[is="${BWC_MODAL_CLOSE_TAG}"]`)) requestOpen(false);
      const dialog = element.querySelector<HTMLDialogElement>(
        `dialog[is="${BWC_MODAL_POPUP_TAG}"]`,
      );
      if (target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          requestOpen(false);
        }
      }
    };
    const close = (event: Event) => {
      const dialog = element.querySelector<HTMLDialogElement>(
        `dialog[is="${BWC_MODAL_POPUP_TAG}"]`,
      );
      // Programmatic closes happen after uncontrolled state changes; ignore their close event.
      if (event.target === dialog) syncScrollLock(null);
      if (event.target !== dialog || !state.open) return;
      emit(element, state.onOpenChange, "open-change", "open", false);
      if (state.controlled) {
        sync();
      } else {
        state.open = false;
        sync();
      }
    };
    element.addEventListener("click", click);
    element.addEventListener("close", close, true);
    const observer = observeChildren(element, sync);
    const dispose = useEffects(() => {
      const controlledOpen = props.open();
      if (controlledOpen !== null) {
        state.controlled = true;
        state.open = true;
      } else if (state.controlled) {
        state.open = false;
      }
      sync();
    });

    return {
      disconnect() {
        dispose();
        element.removeEventListener("click", click);
        element.removeEventListener("close", close, true);
        observer.disconnect();
        syncScrollLock(null);
      },
    };
  },
  () => {
    const emptyProperties = {} as const;
    defineComponent<unknown, HTMLButtonElement, typeof emptyProperties>(
      "trigger",
      HTMLButtonElement,
      emptyProperties,
      (element) => {
        decorateButton(element, "modal-trigger", BWC_MODAL_TRIGGER_TAG, element.className);
      },
    );
    defineComponent<unknown, HTMLDialogElement, typeof emptyProperties>(
      "popup",
      HTMLDialogElement,
      emptyProperties,
      (element) => {
        element.classList.add("modal-popup");
        element.dataset.testid ||= BWC_MODAL_POPUP_TAG;
      },
    );
    defineComponent<unknown, HTMLButtonElement, typeof emptyProperties>(
      "close",
      HTMLButtonElement,
      emptyProperties,
      (element) => {
        decorateButton(element, "modal-close", BWC_MODAL_CLOSE_TAG, element.className);
      },
    );
  },
) as unknown as { new (): ModalApi };
