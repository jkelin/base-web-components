import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
import "microlighter/themes/github.css";
import { highlightAll } from "microlighter";
import "basic-web-components/theme.css";
import "./styles.css";

// Real custom elements by package subpath (never dist paths); importing
// registers them so the prerendered demo markup upgrades on load.
import "basic-web-components/accordion";
import "basic-web-components/modal";
import "basic-web-components/popover";
import "basic-web-components/switch";
import "basic-web-components/otp";
import "basic-web-components/tabs";

import { COMPONENTS } from "./site";
import { mountStylingIslands } from "./styling";
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
// Client-side syntax highlighting (microlighter over the CSS Custom Highlight
// API): prerendered pages carry raw escaped code, highlighted here on load and
// after each SPA swap. `diff` has no bundled grammar under that name, so alias
// it to git-diff; unknown languages (e.g. `text`) and browsers without the
// Highlights API keep the plain readable source.
// Tables carry inline `<code>` with no language class (marked codespans), so
// tag untagged `.doc table code` per column: in tables whose header has an
// "Attribute" column (API properties tables, matched case-insensitively at
// any position), code in that body column holds HTML attribute names
// (`value`, `default-value`, `data-close`), so tag it `language-html`; every
// other untagged table code cell (types, literals, event names, element
// names) stays `language-ts`. Tables without an Attribute header (events,
// slots) are all-ts as before. Already-tagged code keeps its language.
async function highlightCodeBlocks(): Promise<void> {
  try {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
    for (const table of document.querySelectorAll(".doc table")) {
      const headerCells = table.querySelectorAll("thead tr th");
      const headers =
        headerCells.length > 0
          ? [...headerCells]
          : [...table.querySelectorAll("tr:first-child th, tr:first-child td")];
      const attrIndex = headers.findIndex(
        (th) => th.textContent?.trim().toLowerCase() === "attribute",
      );
      const rows = table.querySelectorAll("tbody tr");
      const bodyRows = rows.length > 0 ? [...rows] : [...table.querySelectorAll("tr")].slice(1);
      for (const row of bodyRows) {
        const cells = row.querySelectorAll("td, th");
        cells.forEach((cell, index) => {
          const lang = index === attrIndex ? "language-html" : "language-ts";
          for (const el of cell.querySelectorAll('code:not([class*="language-"])')) {
            el.classList.add(lang);
          }
        });
      }
      // Headerless/layout tables: fall back to all-ts tagging.
      if (bodyRows.length === 0) {
        for (const el of table.querySelectorAll('code:not([class*="language-"])')) {
          el.classList.add("language-ts");
        }
      }
    }
    await highlightAll({
      selector: "pre > code, .doc table code",
      languageAliases: { diff: "git-diff" },
    });
  } catch {
    // Plain-text fallback: the escaped source stays readable.
  }
}

mountDemoToggles();
mountReadouts();
mountStylingIslands();
void highlightCodeBlocks();
// SPA router contract (see src/nav.ts): after each content swap the router
// dispatches `bwc:page-swapped`; remount islands onto the fresh nodes.
// The header stays mounted, so the popover configurator binds once while the
// page configurator remounts onto each fresh `#main`.
document.addEventListener("bwc:page-swapped", () => {
  mountDemoToggles();
  mountReadouts();
  mountStylingIslands();
  void highlightCodeBlocks();
});
