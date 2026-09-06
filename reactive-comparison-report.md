# Reactive comparison — dependency-scoped effects selected

Baseline commit `3100c6d` contains static-template lowering. Its BWC total is
35675 / 14653 / 12989 raw/gzip-9/brotli-11; standalone `microfw.js` is
11257 / 4309 / 3914. Measurements use Bun 1.4.0 and Vite 8.2.2. BWC totals
sum seven entries plus `shared.js`; standalone is excluded.

## Three-way comparison

These candidate figures predate the later generated-HTML requirement.

| strategy | candidate commit | worktree | BWC total | standalone microfw.js | outcome |
| --- | --- | --- | --- | --- | --- |
| baseline | `3100c6d` | MAIN (`webcomponents/`) | 35675 / 14653 / 12989 | 11257 / 4309 / 3914 | reference |
| C: dependency-scoped effects | `ce9cd6c` + cursor delta `7107a8f` | `../webcomponents-reactive-effects-3100c6d` | 38180 / 16012 / 14230 | 11257 / 4309 / 3914 | selected |
| A: imperative bindings | `2839a4c` | `../webcomponents-reactive-imperative-3100c6d` | 39403 / 15980 / 14223 | 12512 / 4672 / 4230 | not selected |
| B: HTML projection | `0335a2b` | `../webcomponents-reactive-html-3100c6d` | 43474 / 17412 / 15517 | 16682 / 6026 / 5445 | not selected |

Delta over baseline: C +2505 / +1359 / +1241 (standalone unchanged); A
+3728 / +1327 / +1234 (standalone +1255 / +363 / +316); B +7799 / +2759 /
+2528 (standalone +5425 / +1717 / +1531).

C does not win every compressed metric: A is 32 gzip and 7 brotli bytes
smaller. C was selected raw-first and on interface/lifetime grounds: 1223 raw
bytes smaller than A, no standalone increase, no public microfw change, and 16
reconnect listeners versus 21 for A and 38 for B. Reconnect traversal is 15
for C versus 30 for B.

B's weight partly reflects `projectLightDom` interpolation losing the static
HTML fast path. Browser proof for B established class retention and geometry
only; it did not prove enlarged CSS. C retained the static compiler and its
class-driven geometry change was directly verified.

MAIN still points at `3100c6d`. C and the cursor correction are applied there
as uncommitted patches; the isolated candidate commits above are evidence, not
a MAIN commit chain. Nothing was pushed.

## C interface and lifetime cost

Public component and microfw interfaces remain unchanged. `shared` adds a
mutation-record callback and guarded DOM-write helpers. Each family retains
stable validated part signals and direct, dependency-scoped effects for its
actual domains: control initialization, content, ARIA/native state, classes,
form identity/submission, or overlay geometry. Structural observers publish
new parts only for owned light-DOM topology changes. There is no generic
binding runtime and no effect per mutation record or constant.

Mount scopes own their effects, observers, form-reset handlers, delegated
listeners, and cleanup. Sixteen listeners are removed and re-added
symmetrically on reconnect. All-seven structural traversals fell from 66 to 15
per mount.

## C verification before the follow-up

Frozen H6 script SHA-256:
`a82a4f67f1aa4e79002e303685c23dc9e3ea7f12336ce85234318dbd5f2c543f`.
Full JSON evidence: `F:/Projects/test/webcomponents-dist-verify/h6-main-c.json`.

Ordinary-update attribute/setter counts: accordion selection 12/2, counter
value 1/1, modal class 2/1, OTP input 3/1, popover open 13/2 plus five required
geometry style writes, switch disabled 11/3, switch name 2/0, and tabs
selection 18/4. Value-only updates perform no structural target-discovery
traversal.

Initial Chrome proof found stale modal/popover disabled cursors. Cursor delta
`7107a8f` moved guarded cursor refreshes into their disabled effects (+160 /
+82 / +60). Modal is 3580/1664/1470 and popover 4311/1938/1705. Focused tests
pass 24/24; Chrome confirms `not-allowed` while disabled, `pointer` after
re-enable, and working overlays.

## Mandatory generated-HTML follow-up

After the comparison, the user required generated native switch and OTP parts
to use the existing `html` template interface. The other candidates were not
extended, so this row is not a fourth candidate.

| final MAIN working tree | BWC total | switch.js | otp.js | standalone microfw.js |
| --- | --- | --- | --- | --- |
| C + cursor + generated HTML | 38888 / 16303 / 14489 | 3437 / 1521 / 1313 | 5290 / 2292 / 2035 | 11257 / 4309 / 3914 |

The follow-up costs +708 / +291 / +259 over the selected C + cursor build. It
reduces imperative construction code and centralizes structural markup; it
does not reduce bytes or mount allocations.

Switch uses one static literal for button, thumb, and checkbox. OTP uses one
static hidden-input literal and one static field literal for each appended
tail field. All use the existing `{ fragment, bind }` lifetime: bind per mount
or field; dispose on disconnect or tail removal; reconnect rebinds surviving
nodes. Dynamic length changes add or remove only the required tail. Static
slots, native types, roles, test IDs, and `maxlength` remain compiler-lowered;
dynamic IDs, state, classes, form data, and geometry stay in narrow effects.
No HTML DSL, dependency, public interface, innerHTML injection, or wholesale
rerender was added.

Focused switch+OTP tests pass 28/28. The post-format OTP-only run passes 16/16.
Typecheck, lint, build, frozen H6, and the all-seven dist-aliased Chrome smoke
pass. Chrome at `http://127.0.0.1:5275/` verified native parts, 4→6→3 tail-only
identity, surviving focus/selection, native focus fallback when a focused tail
is removed, reconnect identity, exactly-once events, form submit/reset, and
disabled cursors. Static-template fast-path lowering is present in the built
switch and OTP entries.

The honest mount cost is visible in H6: all-seven construction records 16
creates plus four fragment queries; OTP setup records six creates. Ordinary
update counts remain unchanged.

## Measurement limits

H6 uses Happy DOM 20.12.0 under Bun with instrumented DOM shims, fixed small
fixtures, and built entry modules. Sizes are single-build gzip-9/brotli-11
points. Chrome proof covers the named smoke and generated-part interactions,
not every possible consumer composition.
