# Optimization size report — build-only static templates

Candidate `dd3288e` (`perf(build): lower static component templates`),
cherry-picked `--no-commit` onto baseline `928f61a` on MAIN (no commit,
no push). Method matches `migration-size-report.md` (Bun 1.4.0, Vite 8.2.2;
raw `Bun.file` bytes, gzip-9 `Bun.gzipSync` level 9, brotli-11 named
`BROTLI_PARAM_QUALITY` constant). Columns: raw / gzip-9 / brotli-11, bytes.

Mechanism (build only, no public behavior/API change — the compiled runtime
output does change): `build/static-html.ts`
(`staticHtmlPlugin`, `apply: "build"`, `enforce: "pre"`) lowers static
`html` no-substitution templates to a `staticHtml("...")` helper served
from `virtual:bwc-static-html`. Anything else — dynamic interpolations,
non-tag uses, re-exports, `eval` modules, helper-name collisions,
invalid cooked escapes — leaves the module unchanged on the full runtime
path. Wiring is config-only: plugin registration in `vite.config.ts`
(plus the virtual module routed to `shared.js`), `build/` added to
`tsconfig.json`/`vitest.config.ts` includes and `oxlint`/`oxfmt` scopes.
No new dependencies (reuses the workspace `typescript` + `vite`).

## Candidates (isolated worktrees)

Ordered raw-first; the winner also cleared the functionality gate (BWC
tests incl. compiler skip-path coverage, typechecks, builds, focused
integration, smoke, dist-aliased harness). BWC totals are raw / gzip-9 /
brotli-11; standalone `microfw.js` is excluded from every sum.

| strategy | commit | worktree | BWC total | standalone microfw.js | outcome |
| --- | --- | --- | --- | --- | --- |
| baseline | `928f61a` | MAIN (`webcomponents/`) | 38340 / 15680 / 13917 | 11257 / 4309 / 3914 | reference |
| framework | `2293fd95` | `../webcomponents-opt-framework-928f61a` | 38080 / 15660 / 13881 | 10997 / 4276 / 3859 | not selected |
| components | `c6803f85` | `../webcomponents-opt-components-928f61a` | 37522 / 15456 / 13735 | 11257 / 4309 / 3914 | not selected |
| build (static templates) | `dd3288e` | `../webcomponents-opt-build-928f61a` | 35675 / 14653 / 12989 | 11257 / 4309 / 3914, measured sizes unchanged | selected |

## Baseline (928f61a, committed)

| asset | raw | gzip-9 | brotli-11 |
| --- | --- | --- | --- |
| counter.js | 1973 | 904 | 785 |
| accordion.js | 3018 | 1330 | 1159 |
| modal.js | 3209 | 1458 | 1292 |
| popover.js | 3709 | 1620 | 1420 |
| switch.js | 3020 | 1308 | 1152 |
| otp.js | 4446 | 1891 | 1673 |
| tabs.js | 4379 | 1792 | 1581 |
| shared.js | 14586 | 5377 | 4855 |
| BWC total | 38340 | 15680 | 13917 |
| microfw.js (standalone, excluded) | 11257 | 4309 | 3914 |

## Optimized (dd3288e, uncommitted)

| asset | raw | gzip-9 | brotli-11 |
| --- | --- | --- | --- |
| counter.js | 1975 | 901 | 792 |
| accordion.js | 3020 | 1330 | 1161 |
| modal.js | 3211 | 1460 | 1294 |
| popover.js | 3711 | 1621 | 1428 |
| switch.js | 3022 | 1311 | 1145 |
| otp.js | 4448 | 1893 | 1668 |
| tabs.js | 4381 | 1797 | 1576 |
| shared.js | 11907 | 4340 | 3925 |
| BWC total | 35675 | 14653 | 12989 |
| microfw.js (standalone, excluded) | 11257 | 4309 | 3914 |

Entries each gain 2 bytes (the static helper import); `shared.js`
absorbs the win (raw −2679). Totals: raw −2665 (−7.0%), gzip-9 −1027
(−6.5%), brotli-11 −928 (−6.7%). Standalone `microfw.js` measured sizes
unchanged (11257 / 4309 / 3914 before and after; hashes not compared).

## Validation

- BWC: 102/102 tests (9 files, incl. 7 compiler tests covering
  dynamic/non-tag/shorthand/re-export/collision/invalid-escape/`eval`
  skip paths), typecheck clean, build clean.
- microfw: build clean, focused `build.integration` 1/1 (full 94-suite
  unchanged and not re-run).
- smoke: typecheck clean, source build clean, dist-aliased harness build
  clean (42.49 kB js vs 45.16 kB source) and dist-aliased dev server served
  for styling verification (markup/CSS unchanged).
- Lint inherited from the candidate worker (clean at amend); no repeated
  lint/format on MAIN (nothing to format beyond the staged candidate).

## Maintenance cost

- Build-only: BWC build 33 ms → ~366 ms (one TS program per inspected
  module); no public behavior/API change, no new dependencies.
- One TS-internal AST dependency: the `templateFlags` invalid-escape bit
  (`1 << 11` in TS 6.0.3, see the source comment in `build/static-html.ts`).
  It is pinned by the "keeps invalid cooked escapes on the full runtime
  error path" consumer regression — re-check the numeric value on every
  TypeScript upgrade.
- The single-file `noResolve` binder (host serves only the compiled source)
  keeps cross-file/lib lookups out; isolated-module behavior is covered by
  the skip-path tests above.

## Browser proof (PASS — styling worker, parent-read)

Dist-aliased smoke served at `http://127.0.0.1:5274` from the rebuilt
candidate entries (markup/CSS unchanged). Network: all 7 dist entries plus
`shared.js` loaded, no TS source; desktop and mobile reload PASS.
Evidence: `%TEMP%` `webcomponents-winner-dist-*.png` (`desktop`,
`disabled-desktop`, `mobile-states`, `modal-mobile`, `modal-open`,
`popover-mobile`, `popover-open`, `states-desktop`).
`desktop` matches the default baseline pixel-identical; other state shots
show negligible transient differences only (max RMS .034). Verified surfaces: hover,
focus, disabled states, glyphs, accordion, switch, OTP, tabs, modal,
popover. The temporary server is kept running for the user and the
evidence PNGs are retained in TEMP.

## Dependency-scoped effects follow-up

The next runtime revision keeps the static compiler and every public interface,
but replaces whole-component synchronization with topology-owned target signals
and dependency-specific effects. Mutation observers invalidate topology only
for actual light-DOM target changes. Mount scopes own effects, observers, form
reset handlers, and delegated listeners.

Final assets (raw / gzip-9 / brotli-11):

| asset | bytes |
| --- | --- |
| counter.js | 2268 / 1062 / 953 |
| accordion.js | 3244 / 1460 / 1291 |
| modal.js | 3580 / 1664 / 1470 |
| popover.js | 4311 / 1938 / 1705 |
| switch.js | 3437 / 1521 / 1313 |
| otp.js | 5290 / 2292 / 2035 |
| tabs.js | 4704 / 2013 / 1790 |
| shared.js | 12054 / 4353 / 3932 |
| BWC total | 38888 / 16303 / 14489 |
| standalone microfw.js | 11257 / 4309 / 3914 |

Cost over the static-template baseline is 3213 / 1650 / 1500 bytes (cursor
delta included: +160 / +82 / +60; final oxfmt pass shaved 14 raw bytes off
otp.js, OTP 16/16 re-run post-format). Generated native parts (switch
OTP fields) reuse existing `html` templates with per-mount bind/dispose and
retained per-field records (tail-only grow/shrink; reconnect rebinds
survivors). Frozen H6 DOM instrumentation (`a82a4f67…`) confirmed zero
topology traversal for every ordinary update. New mount cost: all-seven
construct 16 plus 4 fragment-query traversals; OTP setup construct 6
(template parse/create); ordinary update counts unchanged. Attribute
attempts fell from 188 to 12 for accordion selection, 11 to 1 for counter
value, 34 to 2 for modal classes, 29 to 13 for popover opening, 32 to 11
for switch disabled, 29 to 2 for switch name, 94 to 3 for OTP input, and
156 to 18 for tabs selection (targeted 28/28 incl. an OTP tail-shrink
native-fallback-to-body regression). All-seven reconnect traversals fell
from 66 to 15 per mount; 16 listeners are removed and re-added
symmetrically. Popover opening retains five geometry style writes.

Browser re-proof (dist-aliased smoke, styling worker): switch/OTP PASS on
actual dist (network-confirmed switch/otp/shared, no library TS) —
identity, grow/shrink, focus/selection, reconnect, event dedupe, form
submit+reset, and disabled cursors green with clean smoke PASS. Evidence:
`%TEMP%/webcomponents-generated-html-switch-otp.png`. The earlier
modal/popover disabled-cursor regression is fixed and re-verified
(cursor delta `7107a8f`).

Post-format OTP-only re-verification PASS on current `dist/otp.js`
(5290/2292/2035, no library TS): retained prefix/focus/selection across
4→6 grow and 6→3 shrink, reconnect retention with exactly one event per
input, disabled `not-allowed` cursors, and form submit/change/reset values
green. Switch proof carries unchanged (byte-identical dist).

## Generated-html follow-up vs the 3-way winner (mandatory scope)

The 3-way winner (C + cursor delta) stands at 38180 / 16012 / 14230. The
mandatory generated-html follow-up (native switch/OTP parts from existing
`html` templates) is 38902 / 16304 / 14490 pre-format (+722 / +292 / +260),
38888 / 16303 / 14489 as finally built and formatted. Other candidates were
not extended for this scope, so cross-candidate deltas stop at the winner.
The static-compiler fast path is preserved; readability and structural
markup improved while bytes and mount allocations grow — no size-reduction
claim for the follow-up.

As built, the follow-up costs +708 / +291 / +259 over the 38180 winner
(total 38888 / 16303 / 14489). Honest framing: reduced imperative code and
centralized structure, not bytes. OTP post-format re-proof PASS received;
docs closed with no commit/push.
