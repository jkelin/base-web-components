import { defineComponent, effect, html, onMount, useHost, useProp } from "microfw";
import {
  booleanProp,
  belongsToHost,
  callbackProp,
  createPartClassController,
  decorateButton,
  emit,
  nextId,
  observeSlotSubtree,
  requireSlottedElement,
  stringProp,
  type ChangeCallback,
} from "../shared";

export const BWC_MODAL_TAG = "bwc-modal";

export type BwcModalElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  triggerClass: string;
  popupClass: string;
  closeClass: string;
  onOpenChange: ChangeCallback<boolean>;
};

type DocumentScrollLock = {
  owners: Set<HTMLElement>;
  overflow: string;
};

const documentScrollLocks = new WeakMap<Document, DocumentScrollLock>();

function acquireDocumentScrollLock(document: Document, owner: HTMLElement): void {
  let lock = documentScrollLocks.get(document);
  if (!lock) {
    lock = { owners: new Set(), overflow: document.documentElement.style.overflow };
    document.documentElement.style.overflow = "hidden";
    documentScrollLocks.set(document, lock);
  }
  lock.owners.add(owner);
}

function releaseDocumentScrollLock(document: Document, owner: HTMLElement): void {
  const lock = documentScrollLocks.get(document);
  if (!lock || !lock.owners.delete(owner) || lock.owners.size > 0) return;

  try {
    document.documentElement.style.overflow = lock.overflow;
  } finally {
    documentScrollLocks.delete(document);
  }
}

export const BwcModalElement = defineComponent<BwcModalElement>(BWC_MODAL_TAG, () => {
  const host = useHost<BwcModalElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  let openState = false;
  let initialized = false;
  let activeDialog: HTMLDialogElement | null = null;
  let restoreFocus: HTMLElement | null = null;
  let lockedDocument: Document | null = null;
  const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

  const open = useProp<boolean>("open", {
    ...booleanProp("open"),
    get: () => openState,
    onSet: (value, commit) => {
      controlled = true;
      commit(value);
    },
  });
  const defaultOpen = useProp<boolean>("defaultOpen", booleanProp("default-open"));
  const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
  const triggerClass = useProp<string>("triggerClass", stringProp("trigger-class"));
  const popupClass = useProp<string>("popupClass", stringProp("popup-class"));
  const closeClass = useProp<string>("closeClass", stringProp("close-class"));
  const onOpenChange = useProp<ChangeCallback<boolean>>(
    "onOpenChange",
    callbackProp<boolean>("onOpenChange"),
  );
  openState = controlled ? open() : defaultOpen();

  const applyPartClass = (part: HTMLElement, marker: string, value: string) => {
    let apply = classControllers.get(part);
    if (!apply) {
      apply = createPartClassController(part, marker, value);
      classControllers.set(part, apply);
    }
    apply(value);
  };

  const syncScrollLock = (dialog: HTMLDialogElement | null) => {
    const nextDocument = dialog?.open && host.isConnected ? dialog.ownerDocument : null;
    if (lockedDocument === nextDocument) return;
    if (lockedDocument) releaseDocumentScrollLock(lockedDocument, host);
    if (nextDocument) acquireDocumentScrollLock(nextDocument, host);
    lockedDocument = nextDocument;
  };

  const parts = () => ({
    dialog: requireSlottedElement(host, "popup", HTMLDialogElement),
    trigger: requireSlottedElement(host, "trigger", HTMLButtonElement),
  });

  const sync = () => {
    let dialog: HTMLDialogElement;
    let trigger: HTMLButtonElement;
    try {
      ({ dialog, trigger } = parts());
    } catch (error) {
      syncScrollLock(null);
      throw error;
    }
    if (!initialized) {
      initialized = true;
      if (!controlled) openState = defaultOpen();
    }
    if (activeDialog && activeDialog !== dialog) {
      try {
        if (activeDialog.open) activeDialog.close();
      } finally {
        syncScrollLock(null);
      }
    }
    activeDialog = dialog;

    trigger.id ||= nextId("bwc-modal-trigger-button");
    dialog.id ||= nextId("bwc-modal-popup");
    dialog.dataset.testid ||= "bwc-modal-popup";
    trigger.disabled = disabled();
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", dialog.id);
    decorateButton(trigger, "modal-trigger", "bwc-modal-trigger", trigger.className);
    applyPartClass(trigger, "modal-trigger", triggerClass());
    applyPartClass(dialog, "modal-popup", popupClass());

    const closeButtons = [
      ...dialog.querySelectorAll<HTMLButtonElement>("button[data-close]"),
    ].filter((button) => belongsToHost(button, host));
    for (const button of closeButtons) {
      button.id ||= nextId("bwc-modal-close");
      decorateButton(button, "modal-close", "bwc-modal-close", button.className);
      applyPartClass(button, "modal-close", closeClass());
    }

    const reflectState = () => {
      trigger.setAttribute("aria-expanded", String(openState));
      for (const node of [trigger, dialog]) {
        node.toggleAttribute("data-open", openState);
        node.toggleAttribute("data-closed", !openState);
        node.toggleAttribute("data-disabled", disabled());
      }
    };
    reflectState();

    if (openState && !dialog.open) {
      try {
        dialog.showModal();
      } catch (error) {
        openState = false;
        reflectState();
        syncScrollLock(null);
        throw error;
      }
    } else if (!openState && dialog.open) {
      dialog.close();
      restoreFocus?.focus();
    }
    syncScrollLock(dialog);
  };

  const requestOpen = (next: boolean) => {
    if (disabled() || next === openState) return;
    emit(host, onOpenChange(), "open-change", "open", next);
    if (controlled) return;

    openState = next;
    try {
      sync();
    } catch (error) {
      openState = !next;
      syncScrollLock(null);
      throw error;
    }
  };

  onMount(() => {
    // Validate cardinality and native host types before creating effects or listeners.
    parts();
    let stopObserver: (() => void) | undefined;
    let stopEffect: (() => void) | undefined;

    const click = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const { dialog, trigger } = parts();
      if (trigger.contains(target)) {
        restoreFocus = trigger;
        requestOpen(true);
        return;
      }

      const close = target.closest<HTMLButtonElement>("button[data-close]");
      if (close && belongsToHost(close, host)) {
        requestOpen(false);
        return;
      }

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
    const cancel = (event: Event) => {
      const { dialog } = parts();
      if (event.target !== dialog) return;
      event.preventDefault();
      requestOpen(false);
    };
    const close = (event: Event) => {
      const { dialog } = parts();
      if (event.target !== dialog || !openState) return;
      syncScrollLock(null);
      emit(host, onOpenChange(), "open-change", "open", false);
      if (controlled) {
        queueMicrotask(() => {
          if (host.isConnected && openState) sync();
        });
      } else {
        openState = false;
        restoreFocus?.focus();
        sync();
      }
    };
    const cleanup = () => {
      stopObserver?.();
      stopEffect?.();
      host.removeEventListener("click", click);
      host.removeEventListener("cancel", cancel, true);
      host.removeEventListener("close", close, true);
      try {
        if (activeDialog?.open) activeDialog.close();
      } finally {
        activeDialog = null;
        syncScrollLock(null);
      }
    };

    try {
      sync();
      host.addEventListener("click", click);
      host.addEventListener("cancel", cancel, true);
      host.addEventListener("close", close, true);
      stopEffect = effect(() => {
        const next = open();
        if (next) {
          controlled = true;
          openState = true;
        } else if (controlled) {
          openState = false;
        }
        sync();
      });
      stopObserver = observeSlotSubtree(host, sync, ["class", "data-close"]);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
});
