// Client-side page router: intercepts same-origin docs-page navigations and
// swaps only the content region (header and menu stay mounted, never remount).
// The swapped content fades out/in over ~100ms; `prefers-reduced-motion`
// swaps instantly. Any failure falls back to a full navigation, so links
// always work. After each swap a `bwc:page-swapped` event lets demo islands
// remount onto the fresh markup.
import "basic-web-components/slide-out";

const FADE_MS = 100;

const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Maps a docs URL to its page slug, or null for non-page assets (.md, .txt). */
function slugFromUrl(url: URL): string | null {
  const name = url.pathname.split("/").pop() ?? "";
  if (name === "" || name === "index.html") return "index";
  return name.endsWith(".html") ? name.slice(0, -".html".length) : null;
}

let navigation = 0;

async function navigate(url: URL, push: boolean): Promise<void> {
  const slug = slugFromUrl(url);
  if (slug === null) {
    location.href = url.href;
    return;
  }
  const current = document.getElementById("main");
  if (!current) {
    location.href = url.href;
    return;
  }
  const id = ++navigation;
  const instant = reducedMotion();
  if (!instant) current.style.opacity = "0";

  let response: Response;
  try {
    response = await fetch(url.pathname + url.search, {
      headers: { accept: "text/html" },
    });
  } catch {
    current.style.opacity = "";
    location.href = url.href;
    return;
  }
  if (id !== navigation || !response.ok) {
    if (id === navigation) {
      current.style.opacity = "";
      location.href = url.href;
    }
    return;
  }
  const next = new DOMParser().parseFromString(await response.text(), "text/html");
  const nextMain = next.getElementById("main");
  if (!nextMain) {
    current.style.opacity = "";
    location.href = url.href;
    return;
  }
  if (!instant) await new Promise((resolve) => setTimeout(resolve, FADE_MS));
  if (id !== navigation) return;

  current.innerHTML = nextMain.innerHTML;
  current.dataset.page = slug;
  // Fade back in: the shell `#main` transition animates opacity 0 -> 1 over
  // ~100ms. Without this the page stays transparent after every swap.
  current.style.opacity = "";
  const sidebar = document.getElementById("sidebar");
  const nextSidebar = next.getElementById("sidebar");
  if (sidebar && nextSidebar) sidebar.innerHTML = nextSidebar.innerHTML;
  // The header stays mounted, so sync the menu copy and markdown link too.
  const menuNav = document.querySelector("#menu-panel nav");
  const nextMenuNav = next.querySelector("#menu-panel nav");
  if (menuNav && nextMenuNav) menuNav.innerHTML = nextMenuNav.innerHTML;
  const markdown = document.getElementById("nav-markdown");
  const nextMarkdown = next.getElementById("nav-markdown");
  if (markdown && nextMarkdown) {
    markdown.setAttribute("href", nextMarkdown.getAttribute("href") ?? "./index.md");
    markdown.textContent = nextMarkdown.textContent;
  }
  document.title = next.title;
  // Close the mobile menu when open; a no-op click when already closed.
  document.getElementById("menu-close")?.click();
  if (url.hash) {
    document.getElementById(url.hash.slice(1))?.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
  if (push) history.pushState({ slug }, "", url.pathname + url.search + url.hash);
  document.dispatchEvent(new CustomEvent("bwc:page-swapped", { detail: { slug } }));
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target;
  const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
  const href = anchor.getAttribute("href");
  if (!href) return;
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || slugFromUrl(url) === null) return;
  // Same-page anchors keep native behavior.
  if (url.pathname === location.pathname && url.hash) return;
  event.preventDefault();
  void navigate(url, true);
});

window.addEventListener("popstate", () => {
  void navigate(new URL(location.href), false);
});
