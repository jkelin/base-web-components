// Router repro: same-origin navigation must swap #main content in and leave
// it visible. Regression: the fade-out set `opacity = "0"` and the success
// path never cleared it, so every navigation ended on a blank page.
// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";

const OLD_TITLE = "Overview · basic-web-components";
const NEW_TITLE = "Counter · basic-web-components";

const OLD_MAIN = `<h1>Overview</h1><p>old content</p>`;
const NEW_MAIN = `<h1>Counter</h1><p>new content</p>`;

function page(title: string, main: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body><aside id="sidebar"><nav>side</nav></aside><main id="main" data-page="x">${main}</main><div id="menu-panel"><nav>menu</nav></div><a id="nav-markdown" href="./counter.md">Markdown</a></body></html>`;
}

const window = new Window({ url: "http://localhost/" });
const globals = globalThis as unknown as Record<string, unknown>;
const scope = window as unknown as Record<string, unknown>;
// Mirror the DOM into the Node global scope (bun has no DOM): only fill
// gaps so Node natives (URL, Response, …) keep precedence.
for (const key of Object.getOwnPropertyNames(scope)) {
  if (!(key in globals)) {
    try {
      globals[key] = scope[key];
    } catch {
      // Read-only globals (e.g. `undefined`) stay untouched.
    }
  }
}
scope["matchMedia"] = () => ({
  matches: false,
  addEventListener: () => {},
  removeEventListener: () => {},
});
scope["scrollTo"] = () => {};
globals["fetch"] = (async (input: string | URL | Request) => {
  const url = String(input);
  const isCounter = url.includes("counter.html");
  return new Response(page(isCounter ? NEW_TITLE : OLD_TITLE, isCounter ? NEW_MAIN : OLD_MAIN), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}) as unknown as typeof fetch;
// Event classes must be happy-dom's: its dispatchEvent rejects cross-realm
// (Node-native) events, and nav.ts constructs CustomEvent at dispatch time.
globals["Event"] = scope["Event"];
globals["CustomEvent"] = scope["CustomEvent"];
globals["MouseEvent"] = scope["MouseEvent"];
document.title = OLD_TITLE;
document.body.innerHTML =
  `<aside id="sidebar"><nav>side</nav></aside>` +
  `<main id="main" data-page="index">${OLD_MAIN}</main>` +
  `<div id="menu-panel"><nav>menu</nav></div>` +
  `<a id="nav-markdown" href="./index.md">Markdown</a>` +
  `<button id="menu-close" type="button">x</button>` +
  `<a id="go-counter" href="./counter.html">Counter</a>` +
  `<a id="go-index" href="./index.html">Overview</a>`;

const swapped: Array<string> = [];
document.addEventListener("bwc:page-swapped", (event) => {
  swapped.push((event as CustomEvent).detail.slug as string);
});

await import("./nav.ts");

function click(id: string): void {
  const anchor = document.getElementById(id);
  if (!anchor) throw new Error(`missing anchor #${id}`);
  anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 350));

describe("website SPA router", () => {
  it("swaps in the new page content and leaves it visible (index -> counter)", async () => {
    click("go-counter");
    await settle();

    const main = document.getElementById("main");
    expect(main?.innerHTML).toContain("new content");
    expect(main?.style.opacity).toBe("");
    expect(document.title).toBe(NEW_TITLE);
    expect(swapped.at(-1)).toBe("counter");
  });

  it("swaps back (counter -> index) with the new title and main", async () => {
    click("go-index");
    await settle();

    const main = document.getElementById("main");
    expect(main?.innerHTML).toContain("old content");
    expect(main?.style.opacity).toBe("");
    expect(document.title).toBe(OLD_TITLE);
    expect(swapped.at(-1)).toBe("index");
  });
});
