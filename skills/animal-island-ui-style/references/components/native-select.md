# Select search and clear - RN fork

For `animal-island-ui-rn`, not the upstream DOM package. The declarations below are
verbatim from native source; rebuild `dist/index.d.ts` before relying on installed types.
Package/runtime setup: [native-host.md](native-host.md).

## Select

```ts
export type SelectOption = {
    key: string;
    label: string;
    disabled?: boolean;
};

export interface SelectProps {
    options: SelectOption[];
    value: string;
    onChange: (key: string) => void;
    placeholder?: string;
    disabled?: boolean;
    /** Show an explicit clear action; native hosts do not require hover. */
    allowClear?: boolean;
    /** Called after onChange(''); the host still owns value writeback. */
    onClear?: () => void;
    /** Localized name for the clear action. */
    clearAriaLabel?: string;
    /** The native editable search moves inside the Modal while it is open. */
    showSearch?: boolean;
    /** false preserves host-supplied results; a function receives the raw query. */
    filterOption?: boolean | ((inputValue: string, option: SelectOption) => boolean);
    /** Built-in matching is case insensitive. */
    optionFilterProp?: 'key' | 'label';
    /** Closing a nonempty query notifies the owner with an empty string. */
    onSearch?: (value: string) => void;
    /** Primitive text is wrapped in native Text; native element content is retained. */
    notFoundContent?: React.ReactNode;
    /** 对外暴露的无障碍标签（无可见 label 时使用） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id */
    'aria-labelledby'?: string;
    /** 自定义最外层容器样式；尺寸不引入上游未定义的 size 属性。 */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}
```

Selection is controlled: onChange never writes the host value. Defaults are allowClear
false, showSearch false, filterOption true, optionFilterProp label. Native clear is visible
with a selected value rather than requiring hover. Clearing calls onChange('') then onClear.
Disabled options remain visible and cannot commit or dismiss.

Built-in key/label filtering is case-insensitive. filterOption false preserves host-owned
remote results; onSearch does not fetch automatically. A custom predicate sees the raw
query. Closing a nonempty query emits onSearch(''). Query edits never select a value.

While open on native, the editable search belongs inside the Modal. Native Enter commits
through onSubmitEditing only; onKeyPress does not duplicate that submission. Escape clears
a query before closing. The Web adapter handles keyboard/focus/ARIA independently, ignores
IME/modifier shortcuts and leaves nested clear actions alone.

The scrollable option panel is constrained to measured/fallback viewport bounds. The
KeyboardAvoidingView supplies keyboard-reduced bounds. Reduced motion bypasses decorative
fade. Geometry/renderer fixtures do not establish actual keyboard, focus or popup placement.
