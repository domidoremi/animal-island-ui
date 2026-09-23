# RN fork — host integration API

Applies to `animal-island-ui-rn` on the fork's `rn` branch, not the upstream Web npm package.
Use installed `dist/index.d.ts` as authority. Build declarations after source API changes.
The other component references retain the upstream Web API; do not pass DOM props to RN.
Source and native divergences: [RN-PORT.md](https://github.com/domidoremi/animal-island-ui/blob/rn/RN-PORT.md).

## Provider and package entry points

Import components, `ThemeProvider` and `useTheme` from `animal-island-ui-rn`.
Import pure tokens and `resolveNativeTheme` from `animal-island-ui-rn/theme` in Node tools.
Metro/browser consume source; Node consumes the built CommonJS entry. Share the host's
React, React Native and SVG runtimes when linking this fork as a workspace.

```ts
export interface ThemeProviderProps {
    children?: React.ReactNode;
    /** Follow the host's resolved light/dark setting, not a second system listener. */
    mode?: ThemeMode;
    /** Host motion preference; true disables decorative animation. */
    reducedMotion?: boolean;
    /** Optional brand accent. Default colors remain owned by this package. */
    accent?: string;
}
```

`mode` defaults to `light`; `reducedMotion` defaults to `false`. Accent only replaces
`colors.primary`, not every brand color. Provider-aware colors: Button, Input, Switch,
Select, Card, Background, Modal and Progress. Motion-aware: Button, Switch, Select, Card,
Modal, Progress and Tooltip. Other components retain their static skin.

## RadioGroup — custom radio layouts

Import `RadioGroup` from `animal-island-ui-rn`. It adds no visual styling and is also
used internally by `Radio`.

```ts
export type RadioGroupProps = Omit<ViewProps, 'accessible' | 'role' | 'accessibilityRole' | 'ref'>;
```

Pass a localized `accessibilityLabel`. Children must expose `role="radio"` (or RN
`accessibilityRole`), checked/disabled state and their ordinary `onPress`; the host
remains the selection authority. Web gets one Tab entry, wrapping arrows, Space and Home/End.
Horizontal arrows follow RTL. Native keeps every option independently accessible.
Use `hidden`, `aria-hidden` or `inert` for dynamic hiding. Do not manage child tabIndex
concurrently; the group restores its changes on cleanup. Nested inputs keep their keys.

## User-initiated theme transitions

Import `ThemeTransitionProvider` and `useThemeTransition` from the package root.
Mount the provider once inside the root `ThemeProvider`, in a full-screen positioned host.

```ts
export interface ThemeTransitionOptions {
    /** Viewport coordinates of the initiating press; omitted for a centered reveal. */
    origin?: { x: number; y: number };
    /** Opaque destination surface for native / older-browser cover-and-reveal. */
    color?: string;
}
export interface ThemeTransitionProviderProps {
    children?: React.ReactNode;
    /** Overrides ThemeProvider's policy; true applies changes without decorative motion. */
    reducedMotion?: boolean;
}
```

`useThemeTransition()` returns `(update: () => void, options?: ThemeTransitionOptions) => Promise<void>`.
Pass a synchronous host settings mutation; the promise completes after reveal and rejects if that mutation throws.
Without a provider, changes apply immediately. Reduced motion also applies immediately.
Do not animate hydration/system changes: call the host mutation directly for those.
Overlapping requests finish the preceding mutation once before starting the next, preserving different settings.
Unmount cancels unapplied work. The provider never duplicates or keys the application tree.

## Button — added host props (verbatim excerpt)

```ts
export interface ButtonProps {
    /** Host accessibility semantics (for example a disclosure's expanded state). */
    accessibilityRole?: PressableProps['accessibilityRole'];
    accessibilityState?: PressableProps['accessibilityState'];
    /** Typography only; layout belongs on style. */
    textStyle?: StyleProp<TextStyle>;
    /** Extend a compact visual control's accessible touch target. */
    hitSlop?: PressableProps['hitSlop'];
}
```

Use `onPress`, not `onClick`. Loading disables presses and announces busy state.

## Input — added host props (verbatim excerpt)

```ts
export interface InputProps {
    /** Native props not covered above, including selection, content-size and test ID. */
    inputProps?: Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText' | 'editable' | 'onFocus' | 'onBlur'>;
    /** Native string callback in addition to the Form-compatible onChange event. */
    onChangeText?: (value: string) => void;
    /** Text styling applies to the actual TextInput, not the wrapper. */
    inputStyle?: StyleProp<TextStyle>;
    /** Ref to the native input for host focus/selection commands. */
    inputRef?: React.ComponentPropsWithRef<typeof TextInput>['ref'];
}
```

Top-level `onChange` emits the Form-compatible event (`target.value` / `nativeEvent.text`);
`inputProps.onChange` receives the actual native event. Put selection, content-size,
scroll and native test ID props in `inputProps`. Top-level value, disabled, focus/blur
remain controlled by Input; use `inputRef` to focus the native field. `style` affects
the wrapper; `inputStyle` affects text. Multiline sizing policy belongs to the host.

## Switch — added host prop (verbatim excerpt)

```ts
export interface SwitchProps {
    /** Extend the compact track's native touch target without changing its shape. */
    hitSlop?: PressableProps['hitSlop'];
}
```

## Select — option type (verbatim)

```ts
export type SelectOption = {
    key: string;
    label: string;
    disabled?: boolean;
};
```

Disabled options stay visible but cannot update selection or dismiss the panel.

## Modal — added host props (verbatim excerpt)

```ts
export interface ModalProps {
    /** Insets supplied by the host's safe-area authority. */
    contentInsets?: { top: number; right: number; bottom: number; left: number };
    /** Host typography/layout for the scrollable body. */
    contentStyle?: StyleProp<ViewStyle>;
}
```

Default insets are 24 vertically and 16 horizontally. The body scrolls separately from the footer;
the outer container avoids the keyboard. `contentStyle` controls body layout; style
text children explicitly (RN Views do not inherit typography). Use `footer` for
localized actions (`null` hides it); `undefined` keeps the built-in Chinese actions.
Reduced motion skips entry animation and typewriter playback. `onClose` handles
Android Back and a closable backdrop. Native keyboard/screen-reader behavior requires
device verification, not just renderer tests.

## Tooltip — added host prop (verbatim excerpt)

```ts
export interface TooltipProps {
    /** Controlled visibility for host-owned focus/hover policies. */
    open?: boolean;
}
```

Omit `open` for the fork's press-and-hold policy; set it for host-owned visibility.

## Progress — added host props (verbatim excerpt)

```ts
export interface ProgressProps {
    /** Unknown progress must not announce a fabricated percentage. */
    indeterminate?: boolean;
    /** Optional host status color; omitting it keeps the scene fill. */
    fillColor?: string;
}
```

Indeterminate progress uses a static partial fill, omits `aria-valuenow` and the default
percentage label. Supply `infoFormat` for localized status text. `fillColor` replaces
the scene artwork. Both host reduced motion and the existing OS preference suppress
progress transitions.
