import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
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
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";

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

export const BwcModalElement = defineComponent<BwcModalElement>("bwc-modal", () => {
  const host = useHost<BwcModalElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const parts = signal<{
    closeButtons: HTMLButtonElement[];
    dialog: HTMLDialogElement;
    trigger: HTMLButtonElement;
  } | null>(null);
  const topologyRevision = signal(0);
  const classRevision = signal(0);
  const nativeRevision = signal(0);
  let topologyVersion = 0;
  let classVersion = 0;
  let nativeVersion = 0;
  let initialized = false;
  let activeDialog: HTMLDialogElement | null = null;
  let restoreFocus: HTMLElement | null = null;
  let lockedDocument: Document | null = null;
  const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

  const open = useProp<boolean>("open", {
    ...booleanProp("open"),
    get: () => openState(),
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
  openState(controlled ? open() : defaultOpen());

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

  const requestOpen = (next: boolean) => {
    if (disabled() || next === openState()) return;
    emit(host, onOpenChange(), "open-change", "open", next);
    if (controlled) return;

    try {
      openState(next);
    } catch (error) {
      openState(!next);
      syncScrollLock(null);
      throw error;
    }
  };

  onMount(() => {
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopClasses: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    const click = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;
      if (currentParts.trigger.contains(target)) {
        restoreFocus = currentParts.trigger;
        requestOpen(true);
        return;
      }
      const close = target.closest<HTMLButtonElement>("button[data-close]");
      if (close && currentParts.closeButtons.includes(close)) {
        requestOpen(false);
        return;
      }
      if (target === currentParts.dialog) {
        const rect = currentParts.dialog.getBoundingClientRect();
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
      if (event.target !== parts()?.dialog) return;
      event.preventDefault();
      requestOpen(false);
    };
    const close = (event: Event) => {
      const currentParts = parts();
      if (!currentParts || event.target !== currentParts.dialog || !openState()) return;
      syncScrollLock(null);
      emit(host, onOpenChange(), "open-change", "open", false);
      if (controlled) {
        queueMicrotask(() => {
          if (host.isConnected && openState()) nativeRevision(++nativeVersion);
        });
      } else {
        openState(false);
        restoreFocus?.focus();
      }
    };
    const cleanup = () => {
      host.removeEventListener("click", click);
      host.removeEventListener("cancel", cancel, true);
      host.removeEventListener("close", close, true);
      stopObserver?.();
      stopState?.();
      stopClasses?.();
      stopControl?.();
      stopTopology?.();
      parts(null);
      try {
        if (activeDialog?.open) activeDialog.close();
      } finally {
        activeDialog = null;
        syncScrollLock(null);
      }
    };

    try {
      stopObserver = observeSlotSubtree(
        host,
        (records) => {
          if (
            records.length === 0 ||
            records.some(
              (record) =>
                record.type === "childList" ||
                record.attributeName === "slot" ||
                record.attributeName === "data-close",
            )
          ) {
            topologyRevision(++topologyVersion);
          } else {
            classRevision(++classVersion);
          }
        },
        ["class", "data-close", "slot"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        parts(null);
        if (activeDialog?.open) activeDialog.close();
        activeDialog = null;
        syncScrollLock(null);

        const dialog = requireSlottedElement(host, "popup", HTMLDialogElement);
        const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
        const closeButtons = [
          ...dialog.querySelectorAll<HTMLButtonElement>("button[data-close]"),
        ].filter((button) => belongsToHost(button, host));
        activeDialog = dialog;
        trigger.id ||= nextId("bwc-modal-trigger-button");
        dialog.id ||= nextId("bwc-modal-popup");
        dialog.dataset.testid ||= "bwc-modal-popup";
        setAttributeValue(trigger, "aria-haspopup", "dialog");
        setAttributeValue(trigger, "aria-controls", dialog.id);
        for (const button of closeButtons) {
          button.id ||= nextId("bwc-modal-close");
        }
        parts({ closeButtons, dialog, trigger });
      });
      stopControl = effect(() => {
        const next = open();
        if (next) controlled = true;
        if (!initialized) {
          initialized = true;
          openState(controlled ? next : defaultOpen());
        } else if (next) {
          openState(true);
        } else if (controlled) {
          openState(false);
        }
      });
      stopClasses = effect(() => {
        classRevision();
        const currentParts = parts();
        if (!currentParts) return;
        decorateButton(
          currentParts.trigger,
          "modal-trigger",
          "bwc-modal-trigger",
          currentParts.trigger.className,
        );
        applyPartClass(currentParts.trigger, "modal-trigger", triggerClass());
        applyPartClass(currentParts.dialog, "modal-popup", popupClass());
        for (const button of currentParts.closeButtons) {
          decorateButton(button, "modal-close", "bwc-modal-close", button.className);
          applyPartClass(button, "modal-close", closeClass());
        }
      });
      stopState = effect(() => {
        nativeRevision();
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const isDisabled = disabled();
        const { dialog, trigger } = currentParts;
        if (trigger.disabled !== isDisabled) trigger.disabled = isDisabled;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
        setAttributeValue(trigger, "aria-expanded", String(isOpen));
        for (const node of [trigger, dialog]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
        }

        if (isOpen && !dialog.open) {
          try {
            dialog.showModal();
          } catch (error) {
            openState(false);
            syncScrollLock(null);
            throw error;
          }
        } else if (!isOpen && dialog.open) {
          dialog.close();
          restoreFocus?.focus();
        }
        syncScrollLock(dialog);
      });
      host.addEventListener("click", click);
      host.addEventListener("cancel", cancel, true);
      host.addEventListener("close", close, true);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
});
