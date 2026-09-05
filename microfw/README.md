# microfw

Small reactive Web Component runtime.

## Exports

`src/main.ts` exports:

- `defineComponent(name, render, elementName?)`
- `html`
- `useProp`

`bun run build` writes the importable runtime to `dist/microfw.js`. The file includes the required Alien Signals runtime and excludes `src/example.ts`.

## Commands

- `bun run build` — build the library.
- `bun run build:showcase` — build the example to `dist/showcase`.
- `bun run dev` — run the example.
- `bun run size` — rebuild, then print raw and level-9 gzip bytes using Bun only.

## Lifecycle

Reserved-slot classes and default attributes apply when the host connects, not during construction.

Disconnecting pauses template listeners, reactive bindings, prop effects, and prop observers. On reconnect, detached attribute edits take precedence. Otherwise, detached property or prop-signal writes reflect to the attribute. Prop signals retain their identity.
