# microfw

Small reactive Web Component runtime.

## Exports

`src/main.ts` exports:

- `defineComponent(name, render, elementName?)`
- `html`
- `useProp`

## Build output

`bun run build` emits one ES2022 module, `dist/microfw.js` (raw 8,329 B;
gzip-9 3,361 B; Brotli-11 3,043 B; measured with Bun 1.4.0 / Vite 8.2.2). It bundles the required Alien Signals
runtime, uses native Rolldown full minification, and excludes
`src/example.ts`. Public exports stay `defineComponent`, `html`, `useProp`;
nothing is externalized or split into chunks.

Size notes: prop/context records and template bindings are fixed tuples;
template markers are short numeric ids with a collision scan; reserved-slot
classes copy with one variadic `classList.add`. Disconnect clears template
bindings explicitly (`#unbind = undefined`) before disposing prop effects.

## Commands

- `bun run build` — build the library.
- `bun run build:showcase` — build the example to `dist/showcase`.
- `bun run dev` — run the example.
- `bun run size` — rebuild, then print raw and level-9 gzip bytes using Bun only.

## Lifecycle

Reserved-slot classes and default attributes apply when the host connects, not during construction.

Disconnecting pauses template listeners, reactive bindings, prop effects, and prop observers. On reconnect, detached attribute edits take precedence. Otherwise, detached property or prop-signal writes reflect to the attribute. Prop signals retain their identity.
