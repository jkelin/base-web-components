import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
import "./styles.css";

// Real custom elements by package subpath (never dist paths); importing
// registers them so the prerendered demo markup upgrades on load.
import "basic-web-components/counter";
import "basic-web-components/accordion";
import "basic-web-components/modal";
import "basic-web-components/popover";
import "basic-web-components/switch";
import "basic-web-components/otp";
import "basic-web-components/tabs";

import { COMPONENTS } from "./site";
import { ThemeToggle } from "./theme";

const toggleMount = document.getElementById("theme-toggle-mount");
if (toggleMount) {
  render(() => <ThemeToggle />, toggleMount);
}

// Preview/Code toggle per live demo: flips `hidden` on the prerendered panes
// (demo DOM stays mounted, so component state survives the switch) and mirrors
// the pressed state for assistive tech. Native buttons: keyboard accessible.
// Idempotent (WeakSet): safe to re-run after the SPA router swaps content.
const boundToggles = new WeakSet<HTMLButtonElement>();
function mountDemoToggles(): void {
  for (const component of COMPONENTS) {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(`[data-demo-toggle="${component.slug}"]`),
    );
    const panes = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-demo-pane="${component.slug}"]`),
    );
    if (buttons.length === 0 || panes.length === 0) {
      continue;
    }
    const setView = (view: string): void => {
      for (const button of buttons) {
        button.setAttribute("aria-pressed", String(button.dataset.demoView === view));
      }
      for (const pane of panes) {
        pane.hidden = pane.dataset.demoPaneView !== view;
      }
    };
    for (const button of buttons) {
      if (boundToggles.has(button)) {
        continue;
      }
      boundToggles.add(button);
      button.addEventListener("click", () => setView(button.dataset.demoView ?? "preview"));
    }
  }
}

// One readout island per live demo: shows the component's latest event value.
// Mounts and demo hosts are prerendered; pages without a demo simply skip.
// Idempotent (WeakSet): safe to re-run after the SPA router swaps content.
const boundReadouts = new WeakSet<Element>();
function mountReadouts(): void {
  for (const component of COMPONENTS) {
    const mount = document.querySelector(`[data-readout="${component.slug}"]`);
    const demo = document.getElementById(`demo-${component.slug}`);
    if (!mount || !demo || boundReadouts.has(mount)) {
      continue;
    }
    boundReadouts.add(mount);
    const [text, setText] = createSignal(component.readoutInitial);
    demo.addEventListener(component.readoutEvent, (event) => {
      const detail = (event as CustomEvent).detail as Record<string, unknown> | undefined;
      setText(component.formatReadout(detail?.[component.readoutKey]));
    });
    // `render` appends: drop the prerendered fallback text first so the island
    // owns the node (no-JS readers still see the prerendered value).
    mount.textContent = "";
    render(() => <>{text()}</>, mount);
  }
}

mountDemoToggles();
mountReadouts();
// SPA router contract (see src/nav.ts): after each content swap the router
// dispatches `bwc:page-swapped`; remount islands onto the fresh nodes.
document.addEventListener("bwc:page-swapped", () => {
  mountDemoToggles();
  mountReadouts();
});
