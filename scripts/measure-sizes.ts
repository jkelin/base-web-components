import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

function isSourceFile(entry: string): boolean {
  return entry.endsWith(".ts") || entry.endsWith(".tsx") || entry.endsWith(".svelte");
}

// Raw authored bytes: every source file under the package's src/ directory.
async function sourceBytes(dir: string): Promise<number> {
  let total = 0;

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      total += await sourceBytes(path);
    } else if (isSourceFile(entry)) {
      total += new Uint8Array(await Bun.file(path).arrayBuffer()).byteLength;
    }
  }

  return total;
}

const bundles: Array<readonly [string, string, readonly string[]]> = [
  [
    "Vanilla",
    "packages/web-components-vanilla/src",
    ["packages/web-components-vanilla/dist/vanilla-counter.js"],
  ],
  [
    "Vanilla optimized",
    "packages/web-components-vanilla-optimized/src",
    ["packages/web-components-vanilla-optimized/dist/optimized-counter.js"],
  ],
  [
    "Vanilla optimized manual",
    "packages/web-components-vanilla-optimized-manual/src",
    ["packages/web-components-vanilla-optimized-manual/dist/optimized-counter.js"],
  ],
  [
    "SolidJS",
    "packages/web-components-solidjs/src",
    ["packages/web-components-solidjs/dist/solid-counter.js"],
  ],
  [
    "Atomico",
    "packages/web-components-atomico/src",
    ["packages/web-components-atomico/dist/atomico-counter.js"],
  ],
  [
    "Preact",
    "packages/web-components-preact/src",
    ["packages/web-components-preact/dist/preact-counter.js"],
  ],
  ["Lit", "packages/web-components-lit/src", ["packages/web-components-lit/dist/lit-counter.js"]],
  [
    "Svelte",
    "packages/web-components-svelte/src",
    ["packages/web-components-svelte/dist/svelte-counter.js"],
  ],
];

console.log("| Bundle | Source (bytes) | Raw (bytes) | gzip -9 (bytes) | Brotli 11 (bytes) |");
console.log("| --- | ---: | ---: | ---: | ---: |");

for (const [name, srcDir, paths] of bundles) {
  // Missing outputs fail through Bun.file rather than producing a misleading zero-byte row.
  let raw = 0;
  let gzip = 0;
  let brotli = 0;

  for (const path of paths) {
    const source = new Uint8Array(await Bun.file(path).arrayBuffer());
    raw += source.byteLength;
    gzip += Bun.gzipSync(source, { level: 9 }).byteLength;
    brotli += brotliCompressSync(source, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11,
      },
    }).byteLength;
  }

  const suffix = paths.length > 1 ? ` (${paths.length} files)` : "";
  console.log(`| ${name}${suffix} | ${await sourceBytes(srcDir)} | ${raw} | ${gzip} | ${brotli} |`);
}
