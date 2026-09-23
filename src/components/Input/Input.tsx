import React, { useCallback, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    type KeyboardTypeOptions,
    type ReturnKeyTypeOptions,
    type StyleProp,
    type TextInputBlurEvent,
    type TextInputFocusEvent,
    type TextInputSubmitEditingEvent,
    type TextInputProps,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { colors, controlHeight, fontSize, lineHeightBase } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export type InputSize = 'small' | 'middle' | 'large';

/**
 * 值变化事件。
 *
 * ⚠️ **与上游的差异（事件形状）**：Web 版 `onChange` 收的是
 * `React.ChangeEvent<HTMLInputElement>`，取值一律走 `e.target.value`；RN 的
 * `TextInput.onChange` 收的是 `NativeSyntheticEvent<{ text, target: number, ... }>`
 * —— 其中 `target` 是**节点号（number）**，没有 `value`。
 *
 * 这里同时提供两种取值方式，而不是二选一：
 *   - `target.value` —— 与上游同形。下游 `Form` 的 `FormItem` 就是用
 *     `event.target.value` 取值的（见 `FormItem.tsx` 的 `defaultGetValueFromEvent`），
 *     保持这个字段可以让 Form 移植时不必为 Input 加特判。
 *   - `nativeEvent.text` —— RN 的原生字段，RN 惯用写法也能取值。
 */
export interface InputChangeEvent {
    /** 与 Web 的 `e.target.value` 对齐 */
    target: { value: string };
    /** 与 RN `TextInputChangeEvent` 的 `nativeEvent` 对齐 */
    nativeEvent: { text: string };
}

export interface InputProps {
    /** 输入框尺寸 */
    size?: InputSize;
    /** 前缀图标 */
    prefix?: React.ReactNode;
    /** 后缀图标 */
    suffix?: React.ReactNode;
    /** 允许清除 */
    allowClear?: boolean;
    /** 错误状态 */
    status?: 'error' | 'warning';
    /** 是否显示阴影 */
    shadow?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 受控值 */
    value?: string;
    /** 非受控初始值 */
    defaultValue?: string;
    /**
     * 值变化回调。
     *
     * ⚠️ 上游是 `React.ChangeEventHandler<HTMLInputElement>`（DOM 事件），
     * RN 侧改成自有的 `InputChangeEvent`（见该类型的注释）。**prop 名不变**。
     */
    onChange?: (e: InputChangeEvent) => void;
    /** 清除回调 */
    onClear?: () => void;
    /** 清除按钮的无障碍标签，默认"清除" */
    clearAriaLabel?: string;

    // ---------- 以下为 RN 专有的输入框透传属性 ----------
    // Web 版把 `React.InputHTMLAttributes` 的剩余属性直接摊到 <input> 上
    // （`{...rest}`），RN 没有等价的「原生属性集合」，所以这里显式列出常用项。
    // 上游 prop 名不变，只是数量从「全部 HTML 属性」收敛为「RN 支持的这些」。

    /** 占位文本（上游经 `...rest` 透传） */
    placeholder?: string;
    /** 占位文本颜色。RN 专有 prop：Web 用 `.input::placeholder { color }` */
    placeholderTextColor?: string;
    /** 键盘类型 */
    keyboardType?: KeyboardTypeOptions;
    /** 自动首字母大写策略 */
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    /** 是否自动纠正 */
    autoCorrect?: boolean;
    /** 密码框 */
    secureTextEntry?: boolean;
    /** 最大长度 */
    maxLength?: number;
    /** 多行 */
    multiline?: boolean;
    /** 多行行数 */
    numberOfLines?: number;
    /** 回车键文案 */
    returnKeyType?: ReturnKeyTypeOptions;
    /** 回车提交回调 */
    onSubmitEditing?: (e: TextInputSubmitEditingEvent) => void;
    /** 自动聚焦 */
    autoFocus?: boolean;
    /**
     * 原生 id。
     *
     * ⚠️ Web 版是通过 `...rest` 把 DOM 的 `id` 摊到 `<input>` 上的；RN 的等价物是
     * `nativeID`（与 `aria-labelledby` 配对使用）。**Form 移植时注意**：`FormItem`
     * 目前注入的是 `id={fieldKey}`，在 RN 侧需要改成 `nativeID`。
     */
    nativeID?: string;
    /** 聚焦回调（RN 里也是聚焦样式的驱动源，见 `focused` state） */
    onFocus?: (e: TextInputFocusEvent) => void;
    /** 失焦回调 */
    onBlur?: (e: TextInputBlurEvent) => void;
    /** 可访问名（无可见 label 时使用） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id */
    'aria-labelledby'?: string;

    /**
     * 自定义样式（作用于最外层容器）。
     *
     * 对应 Web 版的 `className`：RN 没有类名系统，`style` 是它的替代物。
     */
    style?: StyleProp<ViewStyle>;
    /**
     * 测试标识（RN 里 `className` 的对应物）。
     *
     * 组件内部还会派生 `${testID}-input` / `-clear` / `-prefix` / `-suffix`，
     * 供测试定位 Web 版用类名定位的那几个结构节点（RN 没有 `querySelector`）。
     */
    testID?: string;
    /** Native props not covered above, including selection, content-size and test ID. */
    inputProps?: Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText' | 'editable' | 'onFocus' | 'onBlur'>;
    /** Native string callback in addition to the Form-compatible onChange event. */
    onChangeText?: (value: string) => void;
    /** Text styling applies to the actual TextInput, not the wrapper. */
    inputStyle?: StyleProp<TextStyle>;
    /** Ref to the native input for host focus/selection commands. */
    inputRef?: React.ComponentPropsWithRef<typeof TextInput>['ref'];
}

type SizeSpec = {
    height: number;
    paddingHorizontal: number;
    fontSize: number;
    borderRadius: number;
    /** 该尺寸的投影（`.wrapper-small` / `.wrapper-large` 的 `:not(.wrapper-no-shadow)` 分支） */
    boxShadow: string;
};

/**
 * 尺寸规格 —— 对应 `.wrapper-small` / `.wrapper-middle` / `.wrapper-large`。
 *
 * `height` 取 `@height-*` token；`padding` / `border-radius` 在 Less 里是硬编码的
 * `14px` / `40px` 等，所以这里照搬字面量，只有 `font-size` 走 token。
 * `border-radius`：`.wrapper` 是 50px，`.wrapper-small` 覆盖成 40px，
 * `.wrapper-large` 又写回 50px（与基类同值），`.wrapper-middle` 不覆盖 → 50px。
 */
const SIZE_SPEC: Record<InputSize, SizeSpec> = {
    small: {
        height: controlHeight.sm, // var(--animal-height-sm)
        paddingHorizontal: 14,
        fontSize: fontSize.sm,
        borderRadius: 40,
        boxShadow: '0 2px 0 0 #d4c9b4',
    },
    middle: {
        height: controlHeight.base, // var(--animal-height-base)
        paddingHorizontal: 18,
        fontSize: fontSize.base,
        borderRadius: 50,
        boxShadow: '0 3px 0 0 #d4c9b4',
    },
    large: {
        height: controlHeight.lg, // var(--animal-height-lg)
        paddingHorizontal: 22,
        fontSize: fontSize.lg,
        borderRadius: 50,
        boxShadow: '0 4px 0 0 #d4c9b4',
    },
};

/** `.wrapper { background: rgb(250, 248, 243) }`（Less 里是硬编码，照搬） */
const WRAPPER_BG = 'rgb(250, 248, 243)';
/** `.wrapper-disabled { background: #ece8dc }` */
const DISABLED_BG = '#ece8dc';
/** `.input { color: #794f3f }` */
const TEXT_COLOR = '#794f3f';
/** `.wrapper-disabled .input { color: #c4b89e }` */
const DISABLED_TEXT_COLOR = '#c4b89e';
/** `.input::placeholder { color: #c4b89e }` */
const PLACEHOLDER_COLOR = '#c4b89e';

/**
 * 聚焦光圈 —— **上游没有的、有意添加的一处**。
 *
 * Web 版 `.input { outline: none }` 把浏览器的默认焦点环去掉了，而且整个
 * `input.module.less` **没有任何 `:focus` / `:focus-visible` 规则**，等于键盘用户
 * 完全看不到焦点位置（`Form` 场景下这是个无障碍缺口）。
 * RN 同样没有 `:focus` 伪类，只能靠 `onFocus` / `onBlur` 维护 state ——
 * 既然状态已经有了，就顺手补一个焦点环（与 TimePicker 展开态的
 * `0 0 0 3px rgba(...)` 双层投影同一手法）。
 *
 * `colors.focus` = `#f5c31c` = `rgb(245, 195, 28)`。属于**可回退的增量**：
 * 去掉这一段，行为就与上游一致（无焦点视觉）。
 */
const FOCUS_RING = '0 0 0 3px rgba(245, 195, 28, 0.25)';

/**
 * 解析静止态投影，**逐条复刻 CSS 的层叠结果**，而不是「看起来差不多」的近似。
 *
 * `input.module.less` 里同时有两条梯队：
 *
 * 1. 权重 0-2-0：`.wrapper-small:not(.wrapper-no-shadow)`（L47）、
 *    `.wrapper-large:not(.wrapper-no-shadow)`（L64）。它们**压过下面所有 0-1-0 规则**，
 *    所以「小号 + error」看到的是灰色的 `0 2px 0 0 #d4c9b4`，**不是**红色错误投影。
 * 2. 权重 0-1-0，同权重按源码顺序「后写的胜」：
 *    `.wrapper`(L13, 3px) → `.wrapper-disabled`(L22, none) →
 *    `.wrapper-no-shadow`(L33, none) → `.wrapper-error`(L71) → `.wrapper-warning`(L79)。
 *    于是 `disabled + error` 看到的是**错误色**（L71 在 L22 之后），
 *    而 `no-shadow + error` 也是错误色（L71 在 L33 之后）。
 */
const restingBoxShadow = (
    size: InputSize,
    status: InputProps['status'],
    shadow: boolean,
    disabled: boolean
): string | undefined => {
    if (shadow && (size === 'small' || size === 'large')) return SIZE_SPEC[size].boxShadow;

    if (status === 'warning') return `0 3px 0 0 ${colors.warningActive}`; // @warning-color-active
    if (status === 'error') return `0 3px 0 0 ${colors.errorActive}`; // @error-color-active
    if (!shadow) return undefined; // `.wrapper-no-shadow { box-shadow: none }`
    if (disabled) return undefined; // `.wrapper-disabled { box-shadow: none }`
    return SIZE_SPEC[size].boxShadow;
};

export const Input: React.FC<InputProps> = ({
    size = 'middle',
    prefix,
    suffix,
    allowClear = false,
    status,
    shadow = false,
    disabled = false,
    value,
    defaultValue,
    onChange,
    onClear,
    clearAriaLabel = '清除',
    placeholder,
    placeholderTextColor,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    secureTextEntry,
    maxLength,
    multiline,
    numberOfLines,
    returnKeyType,
    onSubmitEditing,
    autoFocus,
    nativeID,
    onFocus,
    onBlur,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    style,
    testID,
    inputProps,
    onChangeText,
    inputStyle,
    inputRef,
}) => {
    const { mode, theme } = useTheme();
    const [innerValue, setInnerValue] = useState(defaultValue ?? '');
    /**
     * 聚焦状态。
     *
     * Web 版没有焦点样式（见 `FOCUS_RING` 注释），RN 也没有 `:focus` 伪类，
     * 所以焦点态只能由 `onFocus` / `onBlur` 自己维护。`focused` 同时用于
     * 增量焦点环。
     */
    const [focused, setFocused] = useState(false);

    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : innerValue;

    const emitChange = useCallback(
        (next: string) => {
            if (!isControlled) setInnerValue(next);
            onChange?.({ target: { value: next }, nativeEvent: { text: next } });
            onChangeText?.(next);
        },
        [isControlled, onChange, onChangeText]
    );

    // 用 `onChangeText`（拿字符串）而不是 `onChange`（拿 NativeSyntheticEvent）：
    // 这是 RN 里 TextInput 的惯用写法，也是 RNTL 的 `fireEvent.changeText` 唯一能命中的
    // handler（它按 `onChangeText` 找）。事件对象由 `emitChange` 自己构造。
    const handleChangeText = useCallback((text: string) => emitChange(text), [emitChange]);

    /**
     * 清除。
     *
     * ⚠️ 与 Web 版的结构性差异：上游为了拿到一个「真的」`React.SyntheticEvent`
     * （而不是手搓的假事件），会去改 DOM 的 value setter 再 `dispatchEvent('input')`，
     * 让 React 自己派发 onChange。RN 没有 DOM 事件派发，**直接调用同一个
     * `emitChange('')`** 即可 —— 事件形状由本组件自己保证（`InputChangeEvent`）。
     *
     * 调用顺序与上游一致：先写内部值 → `onClear` → `onChange`。
     */
    const handleClear = useCallback(() => {
        if (!isControlled) setInnerValue('');
        onClear?.();
        onChange?.({ target: { value: '' }, nativeEvent: { text: '' } });
        onChangeText?.('');
    }, [isControlled, onClear, onChange, onChangeText]);

    const handleFocus = useCallback(
        (e: TextInputFocusEvent) => {
            setFocused(true);
            onFocus?.(e);
        },
        [onFocus]
    );

    const handleBlur = useCallback(
        (e: TextInputBlurEvent) => {
            setFocused(false);
            onBlur?.(e);
        },
        [onBlur]
    );

    const sizeSpec = SIZE_SPEC[size];

    // 投影：静止态（CSS 层叠结果）+ 增量焦点环。`ViewStyle` 的属性是 readonly，
    // 所以先攒到 `Record<string, unknown>` 再断言（与 Button 的 `toViewStyle` 同法）。
    const resting = restingBoxShadow(size, status, shadow, disabled);
    const ring = focused && !disabled ? FOCUS_RING : undefined;
    const boxShadowValue = [resting, ring].filter(Boolean).join(', ');

    const wrapperFace: Record<string, unknown> = {
        height: sizeSpec.height,
        paddingHorizontal: sizeSpec.paddingHorizontal,
        borderRadius: sizeSpec.borderRadius,
        backgroundColor:
            mode === 'dark'
                ? disabled
                    ? theme.colors.bgDisabled
                    : theme.colors.bgSecondary
                : disabled
                  ? DISABLED_BG
                  : WRAPPER_BG,
    };
    if (boxShadowValue) wrapperFace.boxShadow = boxShadowValue;

    const inputFace: TextStyle = {
        flex: 1,
        height: '100%', // CSS `.input { height: 100% }`
        // CSS 的 `border: none; outline: none; padding: 0` 在 RN 里只剩「去掉内边距」
        // —— RN 的 TextInput 自带平台默认内边距，不清掉会让文字偏离垂直居中。
        padding: 0,
        textAlignVertical: 'center', // Android 专属，保证与 iOS 一样垂直居中
        backgroundColor: 'transparent',
        fontSize: sizeSpec.fontSize, // CSS 的 `font-size: inherit`（RN 不继承）
        fontWeight: '500',
        lineHeight: sizeSpec.fontSize * lineHeightBase, // CSS line-height: var(--animal-line-height-base)
        letterSpacing: sizeSpec.fontSize * 0.01, // CSS letter-spacing: 0.01em（RN 只收绝对值）
        color:
            mode === 'dark'
                ? disabled
                    ? theme.colors.textDisabled
                    : theme.colors.text
                : disabled
                  ? DISABLED_TEXT_COLOR
                  : TEXT_COLOR,
    };

    return (
        <View
            style={[styles.wrapper, wrapperFace as ViewStyle, disabled && styles.wrapperDisabled, style]}
            testID={testID}
        >
            {prefix != null && (
                <View style={[styles.affix, styles.prefix]} testID={testID ? `${testID}-prefix` : undefined}>
                    {prefix}
                </View>
            )}

            <TextInput
                ref={inputRef}
                // Web 的 `<input disabled>`；RN 里等价的是 `editable={false}`
                editable={!disabled}
                value={currentValue}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={placeholder}
                placeholderTextColor={
                    placeholderTextColor ?? (mode === 'dark' ? theme.colors.textSecondary : PLACEHOLDER_COLOR)
                }
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                secureTextEntry={secureTextEntry}
                maxLength={maxLength}
                multiline={multiline}
                numberOfLines={numberOfLines}
                returnKeyType={returnKeyType}
                onSubmitEditing={onSubmitEditing}
                autoFocus={autoFocus}
                nativeID={nativeID}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                {...inputProps}
                style={[inputFace, inputStyle, inputProps?.style]}
                // React Native Web forwards aria-invalid. Native RN has no invalid
                // AccessibilityState trait; hosts should also expose a visible error.
                aria-invalid={status === 'error' || undefined}
                testID={inputProps?.testID ?? (testID ? `${testID}-input` : undefined)}
                accessibilityState={{ ...inputProps?.accessibilityState, disabled }}
            />

            {allowClear && !!currentValue && !disabled && (
                // Web 版是原生 `<button type="button">`（可 Tab 聚焦、可 Enter 触发）。
                // RN 没有键盘焦点，`accessibilityRole="button"` 是等价的可访问语义。
                <Pressable
                    accessibilityRole="button"
                    aria-label={clearAriaLabel}
                    hitSlop={12}
                    onPress={handleClear}
                    style={styles.clear}
                    testID={testID ? `${testID}-clear` : undefined}
                >
                    {/* `.clear { font-size: 13px; line-height: 1 }` —— RN 里行高不设会按字体默认值撑高 */}
                    <Text style={styles.clearText}>×</Text>
                </Pressable>
            )}

            {suffix != null && (
                <View style={[styles.affix, styles.suffix]} testID={testID ? `${testID}-suffix` : undefined}>
                    {suffix}
                </View>
            )}
        </View>
    );
};

Input.displayName = 'Input';

const styles = StyleSheet.create({
    // `.wrapper { display: inline-flex; align-items: center; width: 100% }`
    wrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        // `.wrapper { transition: all var(--animal-motion-duration-base) ... }` **丢弃** ——
        // RN 没有 CSS transition，而变化的属性是 `boxShadow`（Animated 无法插值，
        // 见 Switch 的同款说明）与 `backgroundColor`，所以投影/底色是瞬间切换的。
    },
    // `.wrapper-disabled { opacity: 0.6; cursor: not-allowed }`（cursor 无对应物）
    wrapperDisabled: {
        opacity: 0.6,
    },
    // `.prefix, .suffix { display: inline-flex; align-items: center; flex-shrink: 0; font-size: 1em }`
    //
    // ⚠️ `.prefix, .suffix { color: #a0936e }` **丢弃**：Web 靠 `color` 的**继承**给
    // 前缀/后缀里的图标（`currentColor`）上色，RN 的样式不跨组件继承，`color` 放在
    // `<View>` 上也不产生任何效果。前缀/后缀是调用方传进来的任意节点，
    // 只能由调用方自己着色。
    affix: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    prefix: {
        marginRight: 6,
    },
    suffix: {
        marginLeft: 6,
    },
    // `.clear { width: 20px; height: 20px; margin-left: 4px; border-radius: 50%; background: transparent }`
    // `border-radius: 50%` 在 20×20 的盒子上就是 10，RN 里直接写死（不依赖百分比解析）。
    clear: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        marginLeft: 4,
        borderRadius: 10,
        backgroundColor: 'transparent',
        // ⚠️ `.clear:hover`（文字转 #725d42 + 底色 rgba(114,93,66,.1)）与
        // `.clear:focus-visible`（outline）**都丢弃**：触摸设备没有 hover，
        // RN 也没有 outline / focus-visible。上游的 `.clear` 没有 `:active`，
        // 所以按下态同样不加（保持无反馈，与上游一致）。
    },
    clearText: {
        color: '#c4b89e',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 13, // CSS line-height: 1
    },
});
