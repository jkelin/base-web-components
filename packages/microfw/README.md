# microfw

Small reactive Web Component runtime.

## Exports

`src/main.ts` exports:

- `defineComponent(name, render, elementName?)` — defines the element and
  returns its constructor (`{ new (): Element }`)
- `html`
- `useHost()` — the render-context host element
- `onMount(setup)` — per-connect setup; return a cleanup for disconnect
- `useProp(name)` — untyped `Signal<string | null>` prop
- `useProp(name, options)` — typed `Signal<Value>` prop (codecs + `get`/`onSet`)
- `signal`, `effect` (bundled alien-signals re-exports; import them from here)
- types `Signal`, `PropOptions` (`PropSignal` stays internal to `component-props`)

## Build output

`bun run build` emits one ES2022 module, `dist/microfw.js` (raw 11,257 B;
gzip-9 4,309 B; Brotli-11 3,914 B; Bun `gzipSync` level 9, `node:zlib`
quality 11 via `BROTLI_PARAM_QUALITY`; Bun 1.4.0 / Vite 8.2.2). It bundles
the required Alien Signals runtime, uses native Rolldown full minification,
and excludes `src/example.ts`. Nothing is externalized or split into chunks.

Size notes: template bindings are fixed tuples; template markers are short
numeric ids with a collision scan; reserved-slot
classes copy with one variadic `classList.add`. Disconnect clears template
bindings explicitly (`#unbind = undefined`) before disposing prop effects.

## Usage

```ts
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "./dist/microfw.js";
```

Always import `signal` from `microfw`, never from a separate `alien-signals`
copy: each copy keeps an independent reactive registry, so outside signals are
invisible to bundle bindings.

## Properties

`useProp(name)` declares an attribute-backed `string | null` prop. Typed
props pass codecs in `options` (`PropOptions`: reflected or property-only
variants):

- Reflected: `attribute`, `defaultValue`, `fromAttribute`, `fromProperty`,
  `toAttribute`, plus optional `get`/`onSet`.
- Property-only (`attribute: null`), e.g. callbacks — no observed
  attribute, no reflection.

`get(stored)` derives public reads from the stored signal; the host getter
never exposes the stored signal itself. `onSet(value, commit)` intercepts
host property writes: call `commit` to store, or withhold it for externally
controlled state. Direct writes to the returned signal validate through
`fromProperty` but bypass `onSet`. Repeating a name returns the existing
signal (identity retained).

Absent attributes stay absent: on initial connect and after external
removal, defaults live in the typed signal and public getter. Only signal
writes mark a prop dirty, and only dirty props reflect — on reconnect as
on write. Attribute-origin reconciliation never marks dirty, so it never
reflects a parsed default back and absent controlled props remain
uncontrolled, including across detach/reconnect transients.

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
- Invalid writes to the raw `string | null` prop throw synchronously before
  any state mutation, including explicit `undefined` (typed-prop validity
  follows its `fromProperty` codec); failed DOM reflections leave snapshots
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

Mount setups registered with `onMount` run on every connect; their returned
cleanups — plus prop effects, template bindings, and observers — dispose on
disconnect and are re-created on reconnect. A throwing mount rolls back via
dispose, discarding effects its setup created.
