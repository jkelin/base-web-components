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
