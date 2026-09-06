// oxfmt has no Svelte parser (verified against the pinned oxfmt: it exits 2 on
// *.svelte), so Svelte components are intentionally excluded here. Their
// <script> blocks are still covered by per-package `lint` via oxlint.
export default {
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts,json,jsonc,css,md}": "oxfmt --write",
};
