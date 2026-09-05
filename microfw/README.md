# microfw

Small reactive Web Component runtime.

## Exports

`src/main.ts` exports:

- `defineComponent(name, render, elementName?)`
- `html`
- `useProp`
- `signal` (bundled alien-signals re-export; import it from here, see Usage)

## Build output

`bun run build` emits one ES2022 module, `dist/microfw.js` (raw 8,976 B;
gzip-9 3,654 B; Brotli-11 3,303 B; measured with Bun 1.4.0 / Vite 8.2.2). It bundles the required Alien Signals
runtime, uses native Rolldown full minification, and excludes
`src/example.ts`. Public exports stay `defineComponent`, `html`, `useProp`, `signal`;
nothing is externalized or split into chunks.

Size notes: prop/context records and template bindings are fixed tuples;
template markers are short numeric ids with a collision scan; reserved-slot
classes copy with one variadic `classList.add`. Disconnect clears template
bindings explicitly (`#unbind = undefined`) before disposing prop effects.

## Usage

```ts
import { defineComponent, html, signal, useProp } from "./dist/microfw.js";
```

Always import `signal` from `microfw`, never from a separate `alien-signals`
copy: each copy keeps an independent reactive registry, so outside signals are
invisible to bundle bindings.

## Runtime contracts

- Text and whole-attribute interpolations only: markers may mix with static
  text, but an attribute value must be exactly one marker.
- Interpolated values must be primitives; functions are accepted only as event
  handlers or writable signals, and every other object is rejected.
- Unsupported contexts throw at render time: markers in comments, dynamic tag
  names, and mixed static/marker attributes, as do malformed field directives
  and unknown bound fields.
- Decoded entities are collision-scanned: parsed text containing the marker
  forces a fresh marker id.
- Invalid prop signal writes throw synchronously before any state mutation,
  including explicit `undefined`; failed DOM reflections leave snapshots
  unchanged so setup or reconnect can retry.
- Named tuple-slot constants inline at build time and cost no bytes.

## Commands

- `bun run build` — build the library.
- `bun run build:showcase` — build the example to `dist/showcase`.
- `bun run dev` — run the example.
- `bun run size` — rebuild, then print raw and level-9 gzip bytes using Bun only.

## Lifecycle

Reserved-slot classes and default attributes apply when the host connects, not during construction.

Disconnecting pauses template listeners, reactive bindings, prop effects, and prop observers. On reconnect, detached attribute edits take precedence. Otherwise, detached property or prop-signal writes reflect to the attribute. Prop signals retain their identity.
