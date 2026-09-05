# Advisory resolution — microfw hardening audit (final, verified)

Final checks run by this workstream on main (`F:/Projects/test/webcomponents`),
2026-09-05, after source freeze:

- `bun run test` → 4 files, 85/85 pass (24 main + 60 props/template + 1 integration)
- `bun run typecheck` → clean
- `bun run build` → `dist/microfw.js` raw 8976, gzip-9 3654, brotli-11 3303
  (Bun `gzipSync` level 9; `node:zlib` brotli quality 11; Bun 1.4.0 / Vite 8.2.2)
- `bun run build:showcase` → pass (main `html` path affected, rebuilt once)
- `bun run lint` (oxlint) → clean, then `bun run format` (oxfmt) once;
  no test rerun after formatting-only changes per handoff

Stale premise (do not restore): old `~index` / `hasUniqueSupportedMarkers`
Map + second traversal are gone. The Chromium detached-property scare was an
isolated-world automation artifact (page-world remove/write/reinsert showed
property/attribute/text correct).

Trusted invariant: internal matching regexes are safe — public `html`
generates numeric `<template-id>:` markers only; no external pattern input.
`signal` stays bundled (Decision A), nothing externalized.

Native proof (row 16, post-fix, real Chromium `dist` runtime): malformed
template `html` rejects instead of binding. Observed native parse shapes —
raw `<p><b><i title="0:0;" data-kept="static" data-kept="0:1;">x</b>y</i></p>`
serializes as
`<p><b><i title="0:0;" data-kept="static">x</i></b><i title="0:0;" data-kept="static">y</i></p>`
(interpolation 0 cloned, interpolation 1 discarded with its duplicate
attribute); the built runtime throws `Error` on this template.

| # | Concern | Evidence (test/function names) | Status |
|---|---------|-------------------------------|--------|
| 1 | Tuple constants/docs, zero index, rollback, empty classes, double disconnect | Tuples + slot docs in `component-props` / `template-bindings`; index-zero paths covered by `installs and removes event handlers` and `stops signal-driven attribute updates after unbind`, plus the >2³¹ index test; empty-class path covered by `keeps host attributes over reserved slot defaults` (slot carries no class); rollback tests (`removes installed handlers when a later value is missing`, `rolls back subscriptions when initial property reflection throws`, `rolls back prop effects when template bind fails on connect`); reconnect test invokes `disconnectedCallback` twice with no duplicate handlers | Closed |
| 2 | Exclusive ownership, main paths | Writer `advisory-remediation` owned `microfw/src/**`; this workstream owns this report + README sizes only | Closed |
| 3 | Entity fail repro + regex safety | `keeps entity-decoded marker text and attributes literal`, `retries a marker decoded inside a static mixed attribute`, `retries a decoded collision before an incomplete interpolated attribute`, `renders decoded marker-like text when there are no substitutions`; `markerIndex` allowlist; attribute path uses string ops | Closed |
| 4 | Proxy `isSignal` + registry + overhead; spoofing rejected | `isSignal` name guard + module-local `activeSub` grounded in `node_modules/alien-signals/esm/index.mjs`; Proxy preserves identity (asserted in `rejects direct signal writes before connect and while detached`). Same-dist imports share one registry; a separate source-tree copy does not — hence same-bundle README rule. Cost: each prop call crosses the `apply` trap + `Reflect.apply`; no explicit copy in code | Closed |
| 5 | Per-attribute regex / context tightening | Removed dynamic per-attribute regex/Map validator stays removed; `bind:` directive literal is loop-local (no claim of zero regex allocation). Count + residue + uniqueness checks reject mixed attributes, comments, dynamic tags, parser clones (`rejects an interpolation outside supported text or whole-attribute contexts`) | Closed |
| 6 | Bundled setter `this` + invalid no-mutation; static mixed entity | `thisArgument` forwarded via `Reflect.apply`. Integration test asserts bundled `defineComponent`/`useProp` invalid setters throw connected AND detached with state unchanged, then detached valid write recovers on reconnect | Closed |
| 7 | Initial prop reflection / leak / later write / precedence | `start` reflects before subscribing; `rolls back subscriptions when initial property reflection throws` ties the initial-leak concern directly, plus `leaves no live subscriptions when render fails`; `rejects direct signal writes while connected without poisoning later updates`; `prefers detached attribute edits on reconnect`, `reflects detached signal and property writes on reconnect` | Closed |
| 8 | Initial signal validation before owned disposer | `disposes a signal effect when its initial DOM write throws`, `disposes a signal effect when its initial value is invalid` | Closed |
| 9 | Final integrated validation (was: concurrent worker edits / partial results) | Single-checkout full run on main after source freeze: 85/85, typecheck, build, showcase — commands + results above, not partial per-file runs | Closed |
| 10 | Extraction-count parser vs true dynamic mixed | Count alone is NOT sufficient (proven by row 16): uniqueness is required. Closed by the unique-index validation — equal count plus each decoded index seen exactly once; static marker-like text stays literal (`leaves static microfw-like text alone`, `keeps numeric suffixes outside interpolations`) | Closed by fix (row 16) |
| 11 | Early "no signal export" vs Decision A | Additive bundled `signal` re-export kept; example imports from `./main`; README same-bundle rule; deps unchanged | Closed |
| 12 | Verification on main, not experiment worktree | All commands above run on `F:/Projects/test/webcomponents` main checkout | Closed |
| 13 | Signal export / example / config-backed build test | `ships one signal runtime for standalone reactive bindings` builds via `vite.config` lib entry, exercises attribute + text + field binding + unbind + bundled prop component against the production chunk | Closed |
| 14 | README/exports/code consistency | README sizes updated to 8976/3654/3303, matching measured build output; exports, usage, contracts match code | Closed |
 | 15 | Exact metrics; publication state | Measured 8976/3654/3303. Deltas: +135 raw vs 8841 prior hardening (unique-index validation), +647 raw vs 8329 original optimized. Audit-time change set: 8 modified + 2 untracked (`build.integration.test.ts`, this report); published as the hardening commit (see git log for `fix(microfw)`) | Closed |
| 16 | Real `html` parser clone/discard gap (late, reopened) | Chromium adoption-agency repair clones interpolation 0 (misnested formatting) and discards interpolation 1 (duplicate attribute): count stays equal with no residue. Failing-first regression `rejects a parser-cloned interpolation that masks a discarded one` emulates the observed native clone/discard shape (happy-dom omits adoption-agency cloning); native-Chrome proof above confirms the built runtime rejects the actual malformed template. Fix: `Uint8Array` unique-decoded-binding-index check after count/residue in `html`, sharing the single `SETUP_INDEX_OFFSET` with `template-bindings` (no alias); named capture/index constants compile away. Caveats: small per-template `seen` allocation only when values > 1 (none for values ≤ 1); malformed parser-clone shapes are rejected, not bound; contract asserts the error type, not diagnostic wording | Closed |

 No blocking concerns. No TODOs. Publication commit pushed to `origin/main`; see git log.
