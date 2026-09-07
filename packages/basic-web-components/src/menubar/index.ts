import menubarCSS from "./menubar.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  booleanPropDefaultTrue,
  enumProp,
  numberProp,
  observeSlotSubtree,
  setAttributeValue,
  toggleState,
} from "../shared";
import type { BwcMenuElement } from "../menu";

if (typeof document !== "undefined" && !document.getElementById("bwc-menubar-style")) {
  const style = document.createElement("style");
  style.id = "bwc-menubar-style";
  style.textContent = menubarCSS;
  document.head.append(style);
}

const orientations = ["horizontal", "vertical"] as const;
type Orientation = (typeof orientations)[number];

export type BwcMenubarElement = HTMLElement & {
  /** Disable the whole bar: hover/keyboard switching and `openMenu` are ignored. */
  disabled: boolean;
  /** Wrap focus past the first/last trigger. Default true. */
  loopFocus: boolean;
  /** Roving direction. Default "horizontal". Invalid values throw. */
  orientation: Orientation;
  /** Hover-switch delay in ms once a menu is open. Default 100. */
  delay: number;
  /** Delay in ms before leaving the bar closes everything; 0 disables. Default 0. */
  closeDelay: number;
  /**
   * Open one menu by index (among `bwc-menu` children) or by its `id`,
   * closing the others. Pass `{ focus: true }` to move focus to its trigger.
   * Throws `RangeError` for an unknown index/id, `TypeError` for other types.
   */
  openMenu: (target: number | string, options?: { focus?: boolean }) => void;
  /** Close every child menu. */
  closeAll: () => void;
};

type MenubarParts = {
  menus: BwcMenuElement[];
  triggers: Array<HTMLButtonElement | null>;
};

export const BwcMenubarElement = defineComponent<BwcMenubarElement>("bwc-menubar", () => {
  const host = useHost<BwcMenubarElement>();
  const parts = signal<MenubarParts | null>(null);
  const revision = signal(0);
  const syncTick = signal(0);
  let version = 0;

  const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
  const loopFocus = useProp<boolean>("loopFocus", booleanPropDefaultTrue("loop-focus"));
  const orientation = useProp<Orientation>(
    "orientation",
    enumProp("orientation", orientations, "horizontal"),
  );
  const delay = useProp<number>("delay", numberProp("delay", 100));
  const closeDelay = useProp<number>("closeDelay", numberProp("close-delay"));

  let switchTimer = 0;
  let leaveTimer = 0;
  let typeBuffer = "";
  let typeTimer = 0;
  const clearSwitch = () => window.clearTimeout(switchTimer);
  const clearLeave = () => window.clearTimeout(leaveTimer);

  const menusOf = (): BwcMenuElement[] => parts()?.menus ?? [];
  const isMenuOpen = (menu: BwcMenuElement): boolean => menu.open === true;
  const anyOpen = (): boolean => menusOf().some(isMenuOpen);
  const triggerDisabled = (trigger: HTMLButtonElement | null): boolean =>
    trigger === null || trigger.disabled;

  const enabledIndexes = (): number[] => {
    const current = parts();
    if (!current) return [];
    return current.menus
      .map((_, index) => index)
      .filter((index) => !triggerDisabled(current.triggers[index] ?? null));
  };

  // Roving tabindex: the preferred trigger (focused, else current 0-holder,
  // else first enabled) gets 0, every other trigger gets -1.
  const syncRoving = () => {
    const current = parts();
    if (!current) return;
    const active = document.activeElement;
    let preferred = current.triggers.findIndex((trigger) => trigger !== null && trigger === active);
    if (preferred === -1) {
      preferred = current.triggers.findIndex(
        (trigger) => trigger !== null && trigger.tabIndex === 0 && !trigger.disabled,
      );
    }
    if (preferred === -1) {
      preferred = current.triggers.findIndex((trigger) => trigger !== null && !trigger.disabled);
    }
    for (const [index, trigger] of current.triggers.entries()) {
      if (trigger && trigger.tabIndex !== (index === preferred ? 0 : -1)) {
        trigger.tabIndex = index === preferred ? 0 : -1;
      }
    }
  };

  const focusTrigger = (index: number) => {
    const trigger = parts()?.triggers[index] ?? null;
    if (!triggerDisabled(trigger)) {
      trigger!.focus();
      syncRoving();
    }
  };

  const activateMenu = (index: number, focus: boolean) => {
    const current = parts();
    if (!current || disabled()) return;
    const menu = current.menus[index];
    if (!menu || menu.disabled) return;
    for (const [otherIndex, other] of current.menus.entries()) {
      if (otherIndex !== index && isMenuOpen(other)) other.close();
    }
    menu.show();
    if (focus) focusTrigger(index);
    syncTick(syncTick() + 1);
  };

  const resolveIndex = (target: number | string): number => {
    const current = parts();
    if (!current) throw new RangeError("bwc-menubar has no menus");
    if (typeof target === "number") {
      if (!Number.isInteger(target) || target < 0 || target >= current.menus.length) {
        throw new RangeError(`bwc-menubar has no menu at index ${String(target)}`);
      }
      return target;
    }
    const index = current.menus.findIndex((menu) => menu.id === target);
    if (index === -1) throw new RangeError(`bwc-menubar has no menu with id "${target}"`);
    return index;
  };

  // `open` is not a state property here (the bar owns no open state; each
  // child bwc-menu owns its own), so there is no show()/close()/toggle() —
  // just the coordinator methods below.
  host.openMenu = (target: number | string, options?: { focus?: boolean }) => {
    if (typeof target !== "number" && typeof target !== "string") {
      throw new TypeError("openMenu() requires a menu index or id");
    }
    activateMenu(resolveIndex(target), options?.focus ?? false);
  };
  host.closeAll = () => {
    for (const menu of menusOf()) {
      if (isMenuOpen(menu)) menu.close();
    }
    clearSwitch();
    clearLeave();
    syncTick(syncTick() + 1);
  };

  onMount(() => {
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopSync: (() => void) | undefined;

    const topMenuOf = (target: EventTarget | null): number => {
      const current = parts();
      if (!(target instanceof Element) || !current) return -1;
      const holder = target.closest("bwc-menu");
      if (!(holder instanceof Element)) return -1;
      return current.menus.indexOf(holder as BwcMenuElement);
    };

    const stepFocus = (from: number, direction: 1 | -1): number => {
      const order = enabledIndexes();
      if (order.length === 0) return -1;
      const at = order.indexOf(from);
      let next: number;
      if (at === -1) {
        next = direction === 1 ? order[0]! : order[order.length - 1]!;
      } else if (loopFocus()) {
        next = order[(at + direction + order.length) % order.length]!;
      } else {
        next = order[Math.min(order.length - 1, Math.max(0, at + direction))]!;
      }
      return next;
    };

    const matchTypeahead = (char: string, from: number): number => {
      const current = parts();
      if (!current || char.length !== 1 || char === " ") return -1;
      window.clearTimeout(typeTimer);
      typeTimer = window.setTimeout(() => {
        typeBuffer = "";
      }, 500);
      const lower = char.toLowerCase();
      const repeated =
        typeBuffer.length > 0 && (typeBuffer + lower).split("").every((c) => c === lower);
      typeBuffer = (repeated ? lower : typeBuffer + lower).slice(-32);
      const labels = current.triggers.map((trigger) =>
        (trigger?.textContent ?? "").trim().toLowerCase(),
      );
      const order = enabledIndexes();
      if (order.length === 0) return -1;
      const startAt = order.indexOf(from);
      for (let step = 0; step < order.length; step++) {
        const index = order[(startAt + 1 + step) % order.length]!;
        if (labels[index]!.startsWith(typeBuffer)) return index;
      }
      return -1;
    };

    const keydown = (event: KeyboardEvent) => {
      const current = parts();
      if (!current || disabled()) return;
      const index = topMenuOf(event.target);
      if (index === -1) return;
      const horizontal = orientation() === "horizontal";
      const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
      const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";
      const trigger = current.triggers[index] ?? null;
      const inTrigger =
        trigger !== null && event.target instanceof Element && trigger.contains(event.target);

      if (inTrigger) {
        if (event.key === nextKey || event.key === prevKey) {
          event.preventDefault();
          const next = stepFocus(index, event.key === nextKey ? 1 : -1);
          if (next === -1) return;
          focusTrigger(next);
          if (anyOpen()) activateMenu(next, false);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const order = enabledIndexes();
          if (order.length === 0) return;
          const next = event.key === "Home" ? order[0]! : order[order.length - 1]!;
          focusTrigger(next);
          if (anyOpen()) activateMenu(next, false);
        } else if (
          event.key.length === 1 &&
          event.key !== " " &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          // Opening (Enter/Down/...) is the child menu's own job — its
          // keydown listener runs first and toggles itself; the
          // `open-change` handler below closes the other menus.
          const match = matchTypeahead(event.key, index);
          if (match !== -1 && match !== index) {
            event.preventDefault();
            focusTrigger(match);
            if (anyOpen()) activateMenu(match, false);
          }
        }
        return;
      }

      // Focus is inside the open menu's popup (a nested bwc-menu resolves
      // to -1 above, so submenus keep their own keys): rove across menus.
      if (event.key === nextKey || event.key === prevKey) {
        event.preventDefault();
        const next = stepFocus(index, event.key === nextKey ? 1 : -1);
        if (next !== -1) activateMenu(next, true);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const order = enabledIndexes();
        if (order.length === 0) return;
        activateMenu(event.key === "Home" ? order[0]! : order[order.length - 1]!, true);
      }
    };
    const focusin = (event: FocusEvent) => {
      if (disabled()) return;
      syncRoving();
      const index = topMenuOf(event.target);
      if (index === -1 || !anyOpen()) return;
      if (!isMenuOpen(menusOf()[index]!)) activateMenu(index, false);
    };
    const pointerover = (event: MouseEvent) => {
      if (disabled()) return;
      const current = parts();
      if (!current || !anyOpen()) return;
      const index = topMenuOf(event.target);
      if (index === -1) return;
      const trigger = current.triggers[index] ?? null;
      if (
        trigger === null ||
        !(event.target instanceof Element) ||
        !trigger.contains(event.target)
      ) {
        return;
      }
      if (isMenuOpen(current.menus[index]!)) {
        clearSwitch();
        return;
      }
      if (triggerDisabled(trigger) || current.menus[index]!.disabled) return;
      clearSwitch();
      const wait = delay();
      if (wait <= 0) {
        activateMenu(index, false);
      } else {
        switchTimer = window.setTimeout(() => activateMenu(index, false), wait);
      }
    };

    const pointerleave = () => {
      const wait = closeDelay();
      if (wait <= 0 || !anyOpen()) return;
      clearLeave();
      leaveTimer = window.setTimeout(() => host.closeAll(), wait);
    };

    const pointerenter = () => clearLeave();

    // Single-open invariant: however a menu opened (click, its own keys,
    // show()), the others close. `event.target` is the menu that changed;
    // nested submenus resolve to -1 and are ignored.
    const menuOpenChange = (event: Event) => {
      const current = parts();
      if (!current) return;
      const index = current.menus.indexOf(event.target as BwcMenuElement);
      if (index === -1) return;
      if ((event as CustomEvent).detail?.open === true) {
        for (const [otherIndex, other] of current.menus.entries()) {
          if (otherIndex !== index && isMenuOpen(other)) other.close();
        }
      }
      syncRoving();
      syncTick(syncTick() + 1);
    };

    const cleanup = () => {
      window.clearTimeout(switchTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(typeTimer);
      host.removeEventListener("keydown", keydown);
      host.removeEventListener("pointerover", pointerover);
      host.removeEventListener("pointerleave", pointerleave);
      host.removeEventListener("pointerenter", pointerenter);
      host.removeEventListener("focusin", focusin);
      host.removeEventListener("open-change", menuOpenChange);
      stopObserver?.();
      stopSync?.();
      stopTopology?.();
      parts(null);
    };

    try {
      stopObserver = observeSlotSubtree(
        host,
        (records) => {
          if (
            records.length === 0 ||
            records.some((record) => record.type === "childList" || record.attributeName === "slot")
          ) {
            revision(++version);
          }
        },
        ["slot", "id"],
      );
      stopTopology = effect(() => {
        revision();
        parts(null);
        const menus = [...host.children].filter(
          (element) => element.localName === "bwc-menu",
        ) as BwcMenuElement[];
        if (menus.length === 0) {
          throw new TypeError("bwc-menubar requires at least one bwc-menu child");
        }
        const triggers = menus.map(
          (menu) => menu.querySelector(":scope > [slot='trigger']") as HTMLButtonElement | null,
        );
        host.dataset.testid ||= "bwc-menubar";
        setAttributeValue(host, "role", "menubar");
        parts({ menus, triggers });
      });
      stopSync = effect(() => {
        syncTick();
        const current = parts();
        if (!current) return;
        const isDisabled = disabled();
        setAttributeValue(host, "aria-orientation", orientation());
        toggleState(host, "data-open", anyOpen());
        toggleState(host, "data-closed", !anyOpen());
        toggleState(host, "data-disabled", isDisabled);
        if (isDisabled) setAttributeValue(host, "aria-disabled", "true");
        else host.removeAttribute("aria-disabled");
        host.style.cursor = isDisabled ? "not-allowed" : "";
        syncRoving();
      });
      host.addEventListener("keydown", keydown);
      host.addEventListener("pointerover", pointerover);
      host.addEventListener("pointerleave", pointerleave);
      host.addEventListener("pointerenter", pointerenter);
      host.addEventListener("focusin", focusin);
      host.addEventListener("open-change", menuOpenChange);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot></slot>`;
});
