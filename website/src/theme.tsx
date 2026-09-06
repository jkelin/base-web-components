import { createSignal } from "solid-js";

const STORAGE_KEY = "bwc-theme";

/** Class-based dark-mode toggle, persisted in localStorage. The inline
 *  head script in each prerendered page sets the initial `.dark` class
 *  before first paint, so this island only handles user toggles. */
export function ThemeToggle() {
  const [dark, setDark] = createSignal(document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private-mode storage failure must not break the toggle.
    }
  };

  return (
    <button
      type="button"
      id="theme-toggle"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-pressed={dark() ? "true" : "false"}
      aria-label={dark() ? "Switch to light mode" : "Switch to dark mode"}
      title={dark() ? "Switch to light mode" : "Switch to dark mode"}
      class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-base transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
    >
      {dark() ? "☾" : "☀"}
    </button>
  );
}
