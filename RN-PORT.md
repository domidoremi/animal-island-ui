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

| Layer                   | Ported | Tests | Notes                                                                         |
| ----------------------- | ------ | ----- | ----------------------------------------------------------------------------- |
| design tokens           | ✅     | 52    | `src/theme/tokens.ts`, 1:1 with `src/styles/variables.less`                   |
| Divider                 | ✅     | 12    | wave / squiggle tiling rebuilt on `react-native-svg`                          |
| Button                  | ✅     | 21    | plus a self-built RN icon set (`src/icons/`)                                  |
| Collapse                | ✅     | 14    | CSS Grid `0fr → 1fr` → measured height + `Animated`                           |
| TimePicker              | ✅     | 22    | panel moved into a `Modal`; geometry extracted into `geometry.ts` (+15 tests) |
| remaining 30 components | ❌     | —     | untouched Web source                                                          |

`npm run ci` = `format:check` + `lint` + `typecheck` + `test` + `build`. Currently **136 tests / 6 suites**.

### ⚠️ What this branch gives up

Rewriting `package.json` for RN **removed the Web toolchain** (vite, vitest, less,
`@testing-library/react`). eslint was re-added, but on RN's terms — see "Linting". So on `rn`:

- `npm run ci` is the **RN** pipeline. Upstream's `ci` also ran `check:docs` and
  `test:a11y`; neither has an RN equivalent here.
- The Web components still on disk are **no longer verified by anything** on this branch.
  Their pipeline lives on `main`. If you edit a Web component here, you are on your own.
- `.githooks/pre-commit` is **not active** (`core.hooksPath` is unset), so nothing runs `ci`
  automatically — run it yourself before committing.

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
- **JS-driven `Animated` needs fake timers.** `useNativeDriver: false` updates React every
  frame; without fake timers those frames land outside `act` and flood the output with
  "not wrapped in act(...)" warnings. See `Collapse.test.tsx`.
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
