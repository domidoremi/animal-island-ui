# RN-PORT.md — porting animal-island-ui to React Native

The `rn` branch of this fork ports the library from React DOM to React Native.
This file records the decisions, the **deliberate divergences from upstream**, and the
parts that are **not covered by tests** — so the next person doesn't have to re-derive them.

中文镜像：[`docs/RN-PORT.zh-CN.md`](docs/RN-PORT.zh-CN.md). This English file is authoritative.

Upstream `main` is untouched: the Web library (34 components, Less Modules, Vitest, Vite)
still lives on disk. The RN port is **additive** — it is fenced off by explicit include
lists in `tsconfig.json`, `tsconfig.build.json` and `jest.config.js`, so the un-ported Web
components never enter the RN typecheck or test run.

## Status

**All 34 components ported.** `npm run ci` = `format:check` + `lint` + `typecheck` +
`test` + `build`. Currently **919 tests / 40 suites**.

Test counts below come from `npx jest --json` (reproducible), not from any document.

| Component     | Tests | Notes                                                                |
| ------------- | ----- | -------------------------------------------------------------------- |
| design tokens | 52    | `src/theme/tokens.ts`, 1:1 with `src/styles/variables.less`          |
| BackTop       | 18    | `duration` dropped; new `scrollY` prop (see divergences)             |
| Background    | 11    | CSS tiling → SVG `<Pattern>`; scene images → `src/assets/image/rn/`  |
| Button        | 21    | plus a self-built RN icon set (`src/icons/`)                         |
| Card          | 22    | CSS `radial-gradient` dots → SVG `<Pattern>`                         |
| Carousel      | 23    | `ScrollView` + `pagingEnabled`; index arithmetic in `geometry.ts`    |
| Checkbox      | 27    | `Pressable` + `accessibilityRole="checkbox"`                         |
| CodeBlock     | 15    | highlighting tokeniser kept, rendered as `<Text>` runs               |
| Collapse      | 14    | CSS Grid `0fr → 1fr` → measured height + `Animated`                  |
| Countdown     | 15+26 | +26 in `format.test.ts` (extracted time formatting)                  |
| Cursor        | 7     | **documented no-op** — see divergences                               |
| DatePicker    | 37+46 | calendar arithmetic in `calendar.ts`; `focusedDate` state dropped    |
| Divider       | 12    | wave / squiggle tiling rebuilt on `react-native-svg`                 |
| Drawer        | 22    | `createPortal` → RN `Modal`; `pushBackground` is a documented no-op  |
| Footer        | 9     | `<footer>` → `Text` (RN has no `contentinfo` role)                   |
| Form          | 57    | no `FormHTMLAttributes`; `onSubmit`/`onReset` removed — see below    |
| Image         | 29    | `react-dom` portal → `Modal`; `naive-icons` image → `src/icons/`     |
| Input         | 28    | `TextInput`; focus styling from `onFocus`/`onBlur`                   |
| Loading       | 19    | absolute positioning kept (not `Modal`) so `zIndex` stays meaningful |
| Modal         | 16    | `createPortal` → RN `Modal`; `game` `clip-path` → SVG backdrop       |
| Notification  | 23    | module-level store + `<NotificationHost />` (see divergences)        |
| Pagination    | 47    | page-ellipsis collapsing preserved                                   |
| Progress      | 28    | `prefers-reduced-motion` → `AccessibilityInfo.isReduceMotionEnabled` |
| Radio         | 25    | `Pressable` + `accessibilityRole="radio"`                            |
| Select        | 21+16 | `Modal` panel; +16 in `geometry.test.ts`                             |
| Skeleton      | 29    | `@keyframes` → `Animated.loop`                                       |
| Switch        | 24    | `Pressable` + `accessibilityRole="switch"`                           |
| Table         | 16    | `table`/`rowgroup`/`row`/`columnheader`/`cell` roles all exist in RN |
| Tabs          | 19    |                                                                      |
| Tag           | 28    | `:hover` dropped                                                     |
| Time          | 11    |                                                                      |
| TimePicker    | 22+15 | panel in a `Modal`; +15 in `geometry.test.ts`                        |
| Title         | 18    | `clip-path` / 135° corners → `react-native-svg`; default `ribbon`    |
| Tooltip       | 18+20 | hover → press-and-hold; placement in `geometry.ts`                   |
| Typewriter    | 13    |                                                                      |

Nothing is left unported. The Web sources remain on disk (they are the reference and they
still build on `main`), but they are outside every include list on this branch.

### ⚠️ What this branch gives up

Rewriting `package.json` for RN **removed the Web toolchain** (vite, vitest, less,
`@testing-library/react`). eslint was re-added, but on RN's terms — see "Linting". So on `rn`:

- `npm run ci` is the **RN** pipeline. Upstream's `ci` also ran `check:docs` and
  `test:a11y`; neither has an RN equivalent here.
- The Web sources still on disk are **no longer verified by anything** on this branch —
  every component has an RN twin now, but only the RN side is in the include lists. Their
  pipeline lives on `main`. If you edit a Web component here, you are on your own.
- `.githooks/pre-commit` is **not active** (`core.hooksPath` is unset), so nothing runs `ci`
  automatically — run it yourself before committing.

## ⚠️ This fork's default branch is `rn`

The fork `domidoremi/animal-island-ui` has `rn` as its **default branch** (the upstream
web library stays untouched on `main`). Two consequences worth knowing:

1. **`gh repo sync` now targets `rn`, not `main`.** `--branch` defaults to the destination's
   default branch, so a bare

    ```bash
    gh repo sync domidoremi/animal-island-ui
    ```

    tries to fast-forward **`rn`** to upstream's `main`. That fails (the histories diverged),
    which is harmless — but **`--force` would hard-reset `rn` and destroy the entire port.**
    To sync the upstream mirror, always name the branch explicitly:

    ```bash
    gh repo sync domidoremi/animal-island-ui -b main
    ```

2. **`README.md` here is upstream's web README** with an added notice at the top. The
   install command and the `animal-island-ui/style` import it documents do **not** apply to
   this branch. Do not "fix" the rest of it — keeping it byte-identical to upstream is what
   makes the fork diffable against it.

## Toolchain decisions

| Decision                                      | Why                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-native@0.87.1`, `react@19.2.x`         | Latest stable at the time; RN 0.87 peers on `react@^19.2.3`.                                                                                                 |
| `preset: '@react-native/jest-preset'`         | **RN 0.87 moved the jest preset out of the `react-native` package.** `preset: 'react-native'` fails with `Module react-native should have "jest-preset.js"`. |
| `jest@29` (not 30)                            | Matches the official template `@react-native-community/template@0.87.1`; jest 30 breaks the preset.                                                          |
| `module: "node16"` in `tsconfig.build.json`   | RN 0.87's types live at `react-native/types_generated/index.d.ts` and are only reachable through `package.json#exports`. node10 resolution → `TS7016`.       |
| `prettier` pinned to `3.8.4`                  | The upstream lockfile pins 3.8.4; `^3.4.0` resolves to 3.9.x, which reformats union types and makes `format:check` fail on **unmodified upstream files**.    |
| eslint 9 + `@react-native/eslint-config/flat` | RN's own config; see "Linting" for the two things it needed.                                                                                                 |
| `react-native-svg` as a peer dependency       | The library renders real SVG; the host app must install it.                                                                                                  |

## Linting

Upstream's `eslint.config.js` was ESM and imported vite/react-refresh plugins — both
meaningless on this branch — so it was **replaced**, not extended. The replacement is CJS
because this branch's `package.json` has no `"type": "module"` (upstream's does).

It is built on `@react-native/eslint-config/flat`, which needed two fixes:

1. **`eslint-plugin-ft-flow@2.0.1` crashes on eslint 9** —
   `TypeError: context.getAllComments is not a function` while linting any `.js` file. RN's
   config depends on `^2.0.1`, so `package.json` pins an override to `^3.0.11`.
   (My earlier note that RN's config "still wants eslint 8" was wrong: 0.87.1 declares
   `eslint: ^8.0.0 || ^9.0.0` and ships a `./flat` entry point.)
2. **`eqeqeq` is `['error', 'always', { null: 'ignore' }]`**, not plain `'always'`. Upstream's
   plain `'always'` would flag `x != null` in nine of its own components; the `null: 'ignore'`
   exception is the idiomatic form of "neither null nor undefined", so the code is left alone
   rather than rewritten.

**Un-ported components are ignored dynamically.** `eslint.config.js` scans
`src/components/*/` and ignores any directory whose `<Name>.tsx` does not contain
`from 'react-native'`. That predicate is self-maintaining: porting a component moves it into
lint scope automatically, so lint needs **no** per-component registration (unlike the three
include lists).

## The porting contract (Web → RN)

| Web                                                                                      | RN                                                             | Notes                                                                  |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `className` + `*.module.less`                                                            | `style` (`StyleSheet.create` in the component file) + `testID` | RN has no class system; the Less files stay on disk for the Web build. |
| `onClick`                                                                                | `onPress` on `Pressable`                                       |                                                                        |
| `:hover`                                                                                 | —                                                              | dropped: no hover on touch                                             |
| `:active`                                                                                | `pressed` from `Pressable`'s style callback                    |                                                                        |
| `onMouseDown={e => e.preventDefault()}` (keep focus)                                     | —                                                              | dropped: `View` has no focus semantics                                 |
| `ResizeObserver` / `clientWidth`                                                         | `onLayout`                                                     |                                                                        |
| CSS `repeating-linear-gradient`                                                          | SVG `strokeDasharray`                                          | Divider                                                                |
| CSS data-URI SVG tiling                                                                  | `<Path transform="translate(...)">` in a loop                  | Divider                                                                |
| CSS Grid `grid-template-rows: 0fr → 1fr`                                                 | `onLayout` to measure, then `Animated.Value` driving `height`  | Collapse                                                               |
| `@keyframes`                                                                             | `Animated.loop` + `Easing.linear`                              | Button's loading spinner                                               |
| `box-shadow: <string>`                                                                   | `boxShadow: <string>` (RN 0.76+, CSS syntax)                   | **Requires the New Architecture on Android.**                          |
| `@font-face` + woff2                                                                     | —                                                              | woff2 is Web-only; the host app must supply ttf/otf (see below).       |
| `position: absolute` popover inside a `position: relative` wrapper                       | `Modal` + `measureInWindow` anchoring                          | TimePicker — see "Structural divergences"                              |
| `document.addEventListener('mousedown')` (outside click)                                 | transparent full-screen `Pressable` inside the `Modal`         | same behaviour, no visual scrim                                        |
| `window.innerHeight` / `innerWidth`                                                      | `useWindowDimensions()`                                        |                                                                        |
| `list.scrollTop` / `list.clientHeight`                                                   | `ScrollView` + `onLayout` + `scrollTo({ y })`                  | TimePicker columns                                                     |
| `onKeyDown` (Enter / Escape / Arrow keys)                                                | —                                                              | `Modal.onRequestClose` covers the Android back button                  |
| `role`, `aria-label`, `aria-labelledby`, `aria-expanded`, `aria-disabled`, `aria-hidden` | same prop names                                                | RN 0.87 supports ARIA-style props                                      |
| `aria-controls`, `aria-haspopup`                                                         | —                                                              | **no RN equivalent**                                                   |
| `tabIndex={0}` / `{-1}`                                                                  | `tabIndex` → `focusable`                                       |                                                                        |
| SVG `stroke="currentColor"`                                                              | thread an explicit colour through the icon                     | RN has no `currentColor`                                               |

## Structural divergences (not just renames)

### 1. TimePicker's panel lives in a `Modal`

On the Web the panel is an absolutely positioned child of the trigger's wrapper, so
`top: 100%` / `bottom: 100%` resolve against the trigger for free. In RN that approach
gets **clipped by any ancestor with `overflow: hidden`** — which includes every
`ScrollView` — and `zIndex` only orders siblings. So the panel moved into a transparent
`Modal`, and the component measures the trigger itself:

```tsx
trigger.measureInWindow((x, y, width, height) =>
    setPanelPosition(computePanelPosition({ x, y, width, height }, windowSize))
);
```

`computePanelPosition` (in `geometry.ts`) is a pure function that reproduces upstream's
flip-down / flip-up / right-align logic in screen coordinates, and is unit-tested.

### 2. Collapse's panel does **not** set `accessible`

Restoring `role="region"` + `aria-labelledby` was possible (RN 0.87 supports both), but
`accessible={true}` on the panel is deliberately **not** set: RN merges a container's
children into a single accessibility node, which would flatten a rich or interactive
`answer` into one blob. The Web `region` is a non-merging landmark, so leaving it off is
the closer match. Trade-off: on iOS the landmark may therefore not be announced.

### 3. `Cursor` is a documented no-op

Upstream's `Cursor` is nothing but a `<div>` that applies a **custom mouse cursor** through
CSS (`cursor.css`). RN has no mouse cursor — and RN's `cursor` style accepts only
`'auto' | 'pointer'`, never a `url()` image. So the RN version renders a plain `View` that
passes `children` / `style` / `testID` through, and accepts `type` and `forceAll` **without
using them**. This was chosen over deleting the component because `Drawer` and `Modal` wrap
their content in `<Cursor>` and must keep working. The test suite asserts the four prop
combinations produce a byte-identical host tree, which is what "no-op" has to mean here.

### 4. Scene SVGs became components

Upstream imports `.svg` files as **modules** (bundler svg loader → a URL string) and feeds
them to `background-image: url(...)`. RN has neither. The four scene images actually
referenced by `Background` and `Progress` were converted to `react-native-svg` components in
`src/assets/image/rn/`; the 30 wallpapers under `assets/image/svg/desktop/` are referenced by
nothing in the RN subset and were left unconverted.

### 5. `BackTop` takes `scrollY` instead of watching the window

Upstream reads `window` scroll position. RN has no window scroll, so a new optional
`scrollY?: number` prop lets the host pass `onScroll`'s `contentOffset.y` through, and the
`visibilityHeight` comparison stays inside the component. `duration` was **dropped**:
`ScrollView.scrollTo` only has animated / not-animated, so the prop would be dead.

## Deliberate divergences from upstream behaviour

These are the places where the RN port does **not** do what upstream does. Each one is
also commented at the point of change.

1. **TimePicker column centring: stride `38` → `30`. Fixed a real upstream bug.**
   Upstream computes `list.scrollTop = index * 38 - clientHeight / 2 + 19`, with the
   comment "条目高 28px + 间距 10px". But `time-picker.module.less` has
   `.option { height: 28px }` and `.columnList { gap: 2px; padding: 2px }` — the real
   stride is **30**, and the comment contradicts the stylesheet.
   At index 10 upstream scrolls 80px too far, and the error grows with the index.
   `centerOffset()` recomputes it from the real values and clamps at 0.
   See `geometry.ts` and the arithmetic in `geometry.test.ts`.

2. **TimePicker options expose `accessibilityState.selected`. Added, not upstream.**
   Upstream marks the selected option only with a visual class (`.optionSelected`), so a
   screen-reader user gets no confirmation after picking. Additive and revertible;
   no visual or behavioural change.

3. **TimePicker right-align threshold: upstream's hardcoded `260` is kept. Not changed.**
   `260` is wider than both panel variants (248 / 172), so the panel right-aligns earlier
   than strictly necessary. Unlike (1) this never puts the panel in the wrong place — it is
   a preference, not a defect — so it was left alone deliberately. **Flagged for a decision.**

4. **TimePicker panel gets no `nativeID`.** Upstream sets `id={panelId}` so the trigger's
   `aria-controls` can point at it. Since RN has no `aria-controls`, nothing would ever
   reference that id, so it was dropped rather than left as dead code.

5. **`aria-haspopup` / `aria-controls` dropped** on the trigger, and the Web keyboard
   cases (Tab-focus, Enter, Escape) dropped from the test suite — RN has no DOM keyboard
   events. Replaced by a test of `Modal.onRequestClose` (Android back button).

6. **Tooltip: hover → press-and-hold.** RN has no hover. The bubble shows while the
   trigger is pressed and hides on release, keeping upstream's 100ms hide debounce.
   Upstream's `aria-describedby` has **no RN equivalent** (zero hits across the whole
   package), so instead of linking trigger → bubble, the bubble is itself an accessible
   node with `role="tooltip"`.

7. **Drawer: `pushBackground` is a documented no-op.** Upstream pushes `body`'s children
   down/sideways when the drawer opens. RN has no `body` and no such transform, so it is
   accepted and ignored. Focus trapping, focus restore and scroll-locking were dropped for
   the same reason. Upstream keeps the node mounted and plays a CSS transition both ways;
   RN must hold `mounted` itself until the exit animation finishes.

8. **Modal: `game` variant's `clip-path` cannot clip a `View`.** Replaced with a
   full-bleed SVG backdrop whose outline matches upstream's shape — the shape is right,
   but content is no longer clipped by it. `aria-describedby` dropped, as in (6).

9. **Table: `text-align` moved to `alignItems`.** RN's `textAlign` belongs to `TextStyle`,
   not `ViewStyle`, so a cell container cannot carry it. Containers use flex
   `alignItems`, and plain string/number children get a `textAlign` of their own. A custom
   `render` that returns its own node does **not** get the `textAlign` — that is a real
   fidelity loss, not an oversight.

10. **Notification needs an explicit host.** Upstream's `notification.info()` creates and
    appends its own container to `document.body`. RN has no such entry point, so the port
    uses a module-level store plus a `<NotificationHost />` the app must mount once at the
    root. This is the largest API change in the whole port.

11. **Form: `onSubmit` and `onReset` removed, not renamed.** Both are native form events
    (`<form onsubmit>`, `<button type=reset>`); RN has neither `FormHTMLAttributes` nor
    native form events. Submit via `form.submit()`, reset via `form.resetFields()`.
    `scrollToField()` is a documented no-op: upstream does
    `document.querySelector(...)?.scrollIntoView(...)`, and RN has no document and no
    scroll container to reach — the host's `ScrollView` owns that. Upstream already called
    it a placeholder. `aria-invalid` and `aria-errormessage` do not exist in RN 0.87
    (only 13 `aria-*` are rewritten), so error state is signalled by passing
    `status="error"` to the child control.

12. **DatePicker: `focusedDate` state deleted.** Upstream's `focusedDate` is the
    keyboard-navigation cursor, and its only reader is `handleKeyDown`. With keyboard
    navigation gone it would be write-only dead state. The range-hover preview became a
    press preview, for the same reason as (6).

## Untested surface — verified by construction only

Be honest about this before trusting the green build:

| Area                                                             | Why it can't be tested here                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TimePicker panel anchoring                                       | jest preset mocks `measureInWindow` as a bare `jest.fn()` (`@react-native/jest-preset/jest/MockNativeMethods.js`) — it **never invokes the callback**. The panel therefore renders at the fallback `{ top: 0, left: 0 }`.                                                 |
| TimePicker column centring                                       | `ScrollView.scrollTo` needs a native scroll node; there is none in the test renderer. **The arithmetic is unit-tested instead.**                                                                                                                                          |
| `boxShadow` actually rendering                                   | No visual assertions anywhere. Also requires the New Architecture on Android; on the old architecture the shadows are silently dropped.                                                                                                                                   |
| Fonts                                                            | `fontFamily` defaults to `undefined`. woff2 is unusable in RN; a host app wanting the island look must ship Nunito + Noto Sans SC as ttf/otf and override via the theme.                                                                                                  |
| `onStartShouldSetResponder` actually blocking touch pass-through | RNTL fires events by walking **up** the tree for a handler; the Modal's backdrop is a **sibling**, so a naive `fireEvent.press(panel)` would pass whether or not the guard exists. The test asserts the mechanism (`onStartShouldSetResponder()` returns `true`) instead. |

### Fallback anchoring, and why it doesn't flicker

`measureInWindow` is callback-based, so the panel first mounts at the fallback position and
is corrected on the next frame. It does not flicker because the panel is simultaneously
fading in from `opacity: 0` over 200 ms — a one-frame position correction at the start of a
fade-in is not perceptible.

## Testing notes (RNTL v14 + RN 0.87 gotchas)

- **`render` and `fireEvent` are async** — React 19's async `act`. Always `await`.
- **Get the node type as `import type { TestInstance } from 'test-renderer';`.** That is the
  canonical form (RNTL v14 re-exports it from that package). Do **not** hand-roll a narrower
  structural type, and do **not** add a `with { 'resolution-mode': 'import' }` attribute.
  Both look necessary only under a standalone `tsc` invoked with `--module node16`; this
  repo's `tsconfig.json` uses `module: ESNext` + `moduleResolution: bundler`, under which the
  plain import is clean. If you verify a single component outside the project, **match the
  repo's module settings** or you will chase a `TS1541` that does not exist.
- **`fireEvent(node, 'pressIn')` does not work on `Pressable`.** Pressability attaches
  `onResponderGrant` / `onResponderRelease` to the host view and never exposes `onPressIn`.
  Button's tests fire the responder sequence directly with a full synthetic event shape,
  including `currentTarget: { measure: () => {} }` (Pressability calls
  `this._responderID.measure(...)`).
- **Pressability waits 130 ms** (`DEFAULT_MIN_PRESS_DURATION`) before emitting `pressOut`,
  so press-out assertions need `await waitFor(...)`.
- **`getByRole` is gated by `isAccessibilityElement`**, which returns `true` for non-Text
  hosts **only when `accessible` is explicitly set**. `Pressable` sets it automatically, so
  `getByRole('button')` / `('combobox')` work; a bare `<View role="region">` is invisible to
  `getByRole` even with `includeHiddenElements: true`. Assert its props instead.
- **`computeAccessibleName` ignores `aria-hidden` and `accessible={false}`** — it walks all
  children. So "the button is named after its question text" cannot be asserted when a
  decorative `+`/`−` glyph is also inside; assert `accessibilityState` / the glyph instead.
- **JS-driven `Animated` needs _some_ timer control** — `useNativeDriver: false` updates
  React every frame, and without control those frames land outside `act`. `Collapse.test.tsx`
  uses fake timers. **But fake timers do not work everywhere** — see the next bullet.
- **`getByTestId` returns the host element**, so you see the props _after_ RN's `View.js`
  rewrote `aria-*` into `accessibility*` — **except that the jest preset mocks `View`
  entirely** (`setup.js` → `mocks/View.js` → `mockComponent`), and the mock passes props
  through **untouched**. Consequences:

    | Written as               | Host props in tests     | Host props on a real device (`View.js`)                             |
    | ------------------------ | ----------------------- | ------------------------------------------------------------------- |
    | `<Pressable aria-label>` | `accessibilityLabel`    | same — `Pressable` does the conversion in JS, and is **not** mocked |
    | `<View aria-label>`      | `aria-label` (raw)      | `accessibilityLabel`                                                |
    | `<View aria-labelledby>` | `aria-labelledby` (raw) | `accessibilityLabelledBy` (array)                                   |
    | `<View aria-hidden>`     | `aria-hidden` (raw)     | `accessibilityElementsHidden` + `importantForAccessibility`         |
    | `<View role>`            | `role` (raw)            | `role` — **not** in the rewrite list                                |

    So: assertions on **`Pressable`** props (trigger, options) match production; assertions on
    **`View` / `Animated.View`** props only prove the component forwarded the prop.

- ⚠️ **Fake timers are unusable on components that animate on mount** (Drawer, DatePicker).
  Two independent failures, both confirmed by probing:

    | Approach                                                | Symptom                                                                                                                                                                                         |
    | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `jest.useFakeTimers()`                                  | fakes `queueMicrotask` too; React 19's scheduler and RNTL's `await render()` both depend on it, so the tree never commits — first case runs 10s, then even `trigger` is unfindable              |
    | `jest.useFakeTimers({ doNotFake: ['queueMicrotask'] })` | fixes rendering, but React's scheduler itself queues work with `setTimeout`, so `await act(async () => ...)` waits on a timer that never arrives — passes after 11s, tripping Jest's 5s timeout |
    | real timers + `waitFor(..., { timeout: 2000 })`         | works, and later cases in the same file are unaffected (verified)                                                                                                                               |

- ⚠️ **RNTL treats siblings of an `aria-modal` element as inaccessible** —
  `isHiddenFromAccessibility` in `helpers/accessibility.js` mirrors iOS
  `accessibilityViewIsModal`. So a `Modal`'s backdrop inside the modal container must be
  queried with `includeHiddenElements: true`, or it is simply not found.
- ⚠️ **A test that waits for a `Modal` to unmount itself poisons later cases in the same
  file** — they report `Unable to find an element with testID: ...` while
  `container.queryAll` still finds it. Fake timers, `waitFor` and real timers all behave
  the same. Moving the waiting cases to the **end of the file** restores them; a separate
  file also avoids it (module-registry isolation) but is not worth the split. See
  `Drawer.test.tsx`.
- **`container.queryAll` yields host nodes only** — composite components are not in the
  result, so props injected into a child control (e.g. `Form` injecting `status="error"`
  into `Input`) cannot be asserted by query. Make a probe child that renders the prop as
  text. See the "错误态" case in `Form.test.tsx`.
- **A bare string child throws** `Invariant Violation: Text strings must be rendered
within a <Text> component`. Components that accept free children (`Form.Item`, `Table`
  cells) wrap strings themselves; tests that render bare text must wrap it too.

## Adding the next component

1. Port into `src/components/<Name>/<Name>.tsx`, keeping the upstream prop names minus
   `className` (add `testID` and `style` instead). Comment every divergence at the point of
   change, with the upstream line it replaces.
2. Add the barrel export to `src/index.ts`.
3. Register the directory in **three** places, or it silently escapes the gate:
   `tsconfig.json` → `include`, `tsconfig.build.json` → `include`,
   `jest.config.js` → `testMatch`.
4. Port the test file. Drop `className` assertions and DOM keyboard cases; for each dropped
   Web case, write down _why_ in the file header, and add an RN-specific replacement when
   one exists (e.g. `Modal.onRequestClose` for Escape).
5. If the component has logic that can't be exercised in the test renderer (measurement,
   scrolling, imperative APIs), **extract it into a pure function and unit-test that** —
   see `src/components/TimePicker/geometry.ts`.
6. `npm run ci`.

## Verification

```bash
npm run ci        # format:check + lint + typecheck + test + build
npm run lint      # eslint .
npm run test      # jest
npm run typecheck # tsc --noEmit  (only the ported subset)
npm run build     # tsc --project tsconfig.build.json → dist/
```

Anything visual — shadows, fonts, scroll behaviour, panel placement — has to be checked on a
device or simulator. This branch's tests cannot see it.
