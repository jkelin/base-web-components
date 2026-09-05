# Migration size report — microfw workspace + native slots

Method (Bun 1.4.0, Vite 8.2.2; all future measurements use these):

- raw: `(await Bun.file(path).bytes()).length`
- gzip-9: `Bun.gzipSync(bytes, { level: 9 }).length`
- brotli-11: `brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length`
  (`import { brotliCompressSync, constants } from "node:zlib"`; quality key is 1)

Columns below: raw / gzip-9 / brotli-11, in bytes.

## Baseline (298e687, pre-move; bytes archived outside the repo)

| asset | raw | gzip-9 | brotli-11 |
| --- | --- | --- | --- |
| microfw.js | 8976 | 3654 | 3303 |
| counter.js | 1892 | 869 | 765 |
| accordion.js | 3348 | 1309 | 1134 |
| modal.js | 3910 | 1499 | 1321 |
| popover.js | 3970 | 1493 | 1310 |
| switch.js | 4369 | 1521 | 1289 |
| otp.js | 6112 | 2124 | 1882 |
| tabs.js | 6133 | 2138 | 1914 |
| shared.js | 8187 | 3116 | 2842 |
| BWC total | 37921 | 14069 | 12457 |

Measurement note: an interim 3305 brotli reading for microfw.js came from a
wrong hardcoded param key (`{6: 11}` instead of the named quality constant)
and is discarded; the named-constant re-measurement reproduces 3303. Raw and
gzip were never affected.

## Final (slot migration complete, all sources frozen)

| asset | raw | gzip-9 | brotli-11 |
| --- | --- | --- | --- |
| microfw.js | 11257 | 4309 | 3914 |
| counter.js | 1962 | 897 | 785 |
| accordion.js | 3018 | 1330 | 1159 |
| switch.js | 3020 | 1308 | 1152 |
| modal.js | 3209 | 1458 | 1292 |
| popover.js | 3709 | 1620 | 1420 |
| tabs.js | 4379 | 1792 | 1581 |
| otp.js | 4446 | 1891 | 1673 |
| shared.js | 14586 | 5377 | 4855 |
| BWC total | 38329 | 15673 | 13917 |

Routing: `vite.config.ts` `manualChunks` sends `/src/shared/`,
`packages/microfw/`, and `node_modules` into one `shared.js`; with
`source`-first resolve conditions the microfw/alien runtime bundles from
TypeScript source exactly once there — `dist` holds 7 entries that each
import exclusively from `./shared.js` plus that single chunk.
BWC total = 7 entries + shared (38329 / 15673 / 13917); the standalone
`dist/microfw.js` (11257 / 4309 / 3914) ships separately and is excluded
from the sum.
Verification: 188 tests total (94 microfw + 94 BWC), all typechecks clean,
smoke typecheck/build clean, headless-Chromium reload PASS
(`PASS: counter and all six suites work`), showcase build clean.
BWC deltas vs baseline: raw +408 (+1.1%), gzip-9 +1604 (+11.4%),
brotli-11 +1460 (+11.7%). Entries shrank (custom-tag machinery replaced by
slots) while shared.js absorbed the full microfw runtime.
