import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { CloseIcon } from '../../icons';
import { useTheme } from '../../theme/ThemeProvider';
import {
    TRIGGER_MIN_WIDTH,
    computeDropdownPosition,
    constrainDropdownPosition,
    dropdownHeight,
    type DropdownPosition,
} from './geometry';
import { attachSelectKeyboard, focusSelect, setSelectWebSemantics } from './selectWeb';

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

/** `@keyframes dropdownFadeIn` 的 0.2s —— `.dropdown { animation: dropdownFadeIn 0.2s ease forwards }` */
const FADE_IN_MS = 200;

/** `ease`（CSS 默认缓动）在 RN 里的近似：cubic-bezier(0.4, 0, 0.2, 1)，与全库其余动效统一 */
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/** `.trigger { background: #fff; border: 2px solid #e8dcc8 }`（Less 硬编码，无对应 token） */
const TRIGGER_BG = '#fff';
const TRIGGER_BORDER = '#e8dcc8';

/** `.value { color: #725d42 }` / `.placeholder { color: #a09080 }`（Less 硬编码） */
const VALUE_COLOR = '#725d42';
const PLACEHOLDER_COLOR = '#a09080';

/** `.arrow { color: #a09080 }`；`.trigger.open .arrow { color: #19c8b9 }` = @primary-color */
const ARROW_COLOR = '#a09080';

/** `.disabled .trigger { background: #f5f5f0 }`（Less 硬编码） */
const DISABLED_BG = '#f5f5f0';

/** `.dropdown { background: #ffeea0 }`（Less 硬编码） */
const DROPDOWN_BG = '#ffeea0';

/** `.pillBar { background: #ffcc00; opacity: 0.3 }`（Less 硬编码） */
const PILL_BG = '#ffcc00';

// Renderer mocks omit measurement callbacks; viewport constraints also apply to this seed.
const FALLBACK_PANEL_POSITION: DropdownPosition = { top: 0, left: 0 };

/**
 * 触发区右侧的箭头。
 *
 * Web 版把这段 svg 内联在 Select 的 JSX 里，并用 `stroke="currentColor"` 从
 * `.arrow { color }` 取色。RN 没有 `currentColor`，把颜色当参数传进来
 * （展开时是主色 `#19c8b9`）。
 */
const ArrowIcon: React.FC<{ color: string }> = ({ color }) => (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
        <Path d="M3 4.5L6 7.5L9 4.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

export const Select: React.FC<SelectProps> = ({
    options,
    value,
    onChange,
    placeholder = '请选择',
    disabled = false,
    allowClear = false,
    onClear,
    clearAriaLabel = '清除',
    showSearch = false,
    filterOption = true,
    optionFilterProp = 'label',
    onSearch,
    notFoundContent = '暂无数据',
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    style,
    testID,
}) => {
    const { mode, theme, reducedMotion } = useTheme();
    const [open, setOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<DropdownPosition | null>(null);
    const [searchValue, setSearchValue] = useState<string | null>(null);
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const wrapperRef = useRef<React.ComponentRef<typeof View>>(null);
    const panelRef = useRef<React.ComponentRef<typeof View>>(null);
    const triggerRef = useRef<React.ComponentRef<typeof View>>(null);
    const searchRef = useRef<React.ComponentRef<typeof TextInput>>(null);
    const panelSearchRef = useRef<React.ComponentRef<typeof TextInput>>(null);
    const restoreFocus = useRef(false);
    const prefix = 'animal-select-' + useId().replace(/[^a-zA-Z0-9_-]/g, '') + '-';
    const controlId = prefix + 'control';
    const listId = prefix + 'list';
    const optionPrefix = prefix + 'option-';

    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
    const [panelSize, setPanelSize] = useState<{ width: number; height: number } | null>(null);
    const panelWindow = { width: viewport?.width ?? windowWidth, height: viewport?.height ?? windowHeight };

    const currentLabel = options.find((o) => o.key === value)?.label || placeholder;
    const labelForInput = value ? currentLabel : '';
    const filteredOptions = useMemo(() => {
        if (!showSearch || !filterOption || !searchValue) return options;
        const matches =
            typeof filterOption === 'function'
                ? filterOption
                : (input: string, option: SelectOption) =>
                      option[optionFilterProp].toLowerCase().includes(input.toLowerCase());
        return options.filter((option) => matches(searchValue, option));
    }, [options, showSearch, filterOption, optionFilterProp, searchValue]);
    const enabledOptions = useMemo(() => filteredOptions.filter((option) => !option.disabled), [filteredOptions]);
    const showClear = allowClear && Boolean(value) && !disabled;

    /**
     * 面板的淡入进度 0→1 —— 对应 `.dropdown { opacity: 0; animation: dropdownFadeIn 0.2s ease forwards }`。
     *
     * `useNativeDriver: true`：opacity 是原生可驱动属性（与 Time 的挂载淡入一致）。
     * 测试里它不产生 JS 帧，因此不会污染 `act()`。
     *
     * ⚠️ 退场动效**没有**移植：上游 Less 里有 `.dropdown.closing { animation: dropdownFadeOut 0.15s }`，
     * 但组件从未加上 `closing` 这个 class —— 是**死代码**，关闭本来就是瞬时的。照搬「瞬时关闭」。
     */
    const visible = useRef(new Animated.Value(0)).current;

    const close = useCallback(() => {
        restoreFocus.current = true;
        setOpen(false);
        setPanelPosition(null);
        if (searchValue) onSearch?.('');
        setSearchValue(null);
    }, [searchValue, onSearch]);

    useEffect(() => {
        if (disabled) close();
    }, [disabled, close]);

    useEffect(() => {
        setActiveKey((current) =>
            !open
                ? null
                : enabledOptions.some((option) => option.key === current)
                  ? current
                  : (enabledOptions.find((option) => option.key === value)?.key ?? enabledOptions[0]?.key ?? null)
        );
    }, [open, enabledOptions, value]);

    const focusControl = useCallback(() => {
        if (showSearch) searchRef.current?.focus();
        else if (Platform.OS === 'web') focusSelect(triggerRef.current);
    }, [showSearch]);

    useEffect(() => {
        if (open || !restoreFocus.current) return;
        restoreFocus.current = false;
        if (!disabled) focusControl();
    }, [open, disabled, focusControl]);

    // 展开时：重置淡入、测量触发区在屏幕上的位置
    useEffect(() => {
        if (!open) {
            setPanelPosition(null);
            return;
        }

        let current = true;
        visible.setValue(reducedMotion ? 1 : 0);
        const animation = reducedMotion
            ? undefined
            : Animated.timing(visible, {
                  toValue: 1,
                  duration: FADE_IN_MS,
                  easing: EASE,
                  useNativeDriver: true,
              });
        animation?.start();

        // ⚠️ 与 Web 版的结构性差异：Web 的下拉是 wrapper 的子节点，`left: 100%` /
        // `top: 50%` 这类相对定位天然生效；RN 为了不被祖先的 overflow 裁掉（任何
        // `ScrollView` 都会裁），把面板放进了 `Modal`，于是必须自己测量触发区在屏幕上的
        // 位置，再换算成绝对偏移（换算逻辑在 `geometry.ts`，可单测）。
        //
        // 先落兜底位置**再**尝试测量校正：`measureInWindow` 是回调式的，测试渲染器里
        // 它存在但**永远不会回调**（实测），只等回调会让面板根本挂不上。
        setPanelPosition(FALLBACK_PANEL_POSITION);
        const trigger = triggerRef.current;
        if (trigger && typeof trigger.measureInWindow === 'function') {
            trigger.measureInWindow((x, y, width, height) => {
                if (current)
                    setPanelPosition(
                        computeDropdownPosition(
                            { x, y, width, height },
                            { width: windowWidth, height: windowHeight },
                            Math.max(1, filteredOptions.length) + (showSearch ? 1 : 0)
                        )
                    );
            });
        }
        return () => {
            current = false;
            animation?.stop();
        };
    }, [open, visible, windowWidth, windowHeight, filteredOptions.length, showSearch, reducedMotion]);

    const handleSelect = useCallback(
        (key: string) => {
            if (disabled || !filteredOptions.some((option) => option.key === key && !option.disabled)) return;
            onChange(key);
            close();
        },
        [disabled, filteredOptions, onChange, close]
    );

    const search = (next: string) => {
        if (disabled) return;
        const editingLabel =
            searchValue === null && Boolean(value) && labelForInput !== '' && next.startsWith(labelForInput);
        const query = editingLabel ? next.slice(labelForInput.length) : next;
        setSearchValue(query);
        onSearch?.(query);
        setOpen(true);
    };
    const handleKey = (key: string, fromOption = false) => {
        if (disabled) return false;
        if (!open) {
            if (key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp' || (key === ' ' && !showSearch)) {
                setOpen(true);
                return true;
            }
            return false;
        }
        if (key === 'Escape') {
            if (showSearch && searchValue) {
                setSearchValue(null);
                onSearch?.('');
            } else close();
            return true;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Home' || key === 'End') {
            if (!enabledOptions.length) return true;
            const index = enabledOptions.findIndex((option) => option.key === activeKey);
            const next =
                key === 'Home'
                    ? 0
                    : key === 'End'
                      ? enabledOptions.length - 1
                      : index < 0
                        ? key === 'ArrowDown'
                            ? 0
                            : enabledOptions.length - 1
                        : (index + (key === 'ArrowDown' ? 1 : -1) + enabledOptions.length) % enabledOptions.length;
            setActiveKey(enabledOptions[next].key);
            return true;
        }
        if (key === 'Enter' || (key === ' ' && (!showSearch || fromOption))) {
            if (activeKey) handleSelect(activeKey);
            return true;
        }
        return false;
    };
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const a = attachSelectKeyboard(wrapperRef.current, controlId, optionPrefix, handleKey);
        const b = attachSelectKeyboard(panelRef.current, controlId, optionPrefix, handleKey);
        return () => {
            a?.();
            b?.();
        };
    });
    useEffect(() => {
        if (!open || Platform.OS !== 'web') return;
        if (showSearch) panelSearchRef.current?.focus();
        else if (activeKey) focusSelect(panelRef.current, optionPrefix + activeKey);
    }, [open, panelPosition, showSearch, activeKey, optionPrefix]);
    useEffect(() => {
        if (Platform.OS !== 'web' || !open) return;
        return setSelectWebSemantics(
            showSearch ? panelSearchRef.current : triggerRef.current,
            listId,
            activeKey ? optionPrefix + activeKey : null
        );
    }, [open, panelPosition, showSearch, activeKey, listId, optionPrefix]);
    const renderSearch = (inside: boolean) => (
        <TextInput
            ref={inside ? panelSearchRef : searchRef}
            nativeID={inside || !open ? controlId : prefix + 'inactive'}
            accessibilityRole="combobox"
            accessibilityLabel={ariaLabel ?? placeholder}
            accessibilityLabelledBy={ariaLabelledBy}
            accessibilityState={{ disabled, expanded: open }}
            accessible={inside || !open}
            editable={!disabled}
            autoFocus={inside}
            autoCorrect={false}
            placeholder={placeholder}
            placeholderTextColor={mode === 'dark' ? theme.colors.textSecondary : PLACEHOLDER_COLOR}
            value={open ? (searchValue ?? labelForInput) : labelForInput}
            onChangeText={search}
            onPressIn={() => {
                if (!disabled) setOpen(true);
            }}
            onSubmitEditing={() => {
                if (activeKey) handleSelect(activeKey);
            }}
            onKeyPress={
                Platform.OS === 'web'
                    ? undefined
                    : (event) => {
                          // Native Enter also fires onSubmitEditing; only that event commits a value.
                          if (event.nativeEvent.key !== 'Enter') handleKey(event.nativeEvent.key);
                      }
            }
            style={[styles.searchInput, mode === 'dark' && { color: theme.colors.text }]}
            testID={testID ? `${testID}-${inside ? 'panel-' : ''}search` : undefined}
        />
    );
    return (
        <View ref={wrapperRef} style={[styles.wrapper, disabled && styles.wrapperDisabled, style]} testID={testID}>
            <Pressable
                ref={triggerRef}
                nativeID={showSearch ? prefix + 'trigger' : controlId}
                role={showSearch ? undefined : 'combobox'}
                accessible={!showSearch}
                aria-expanded={open}
                // Native has no DOM relationships; selectWeb attaches them on Web.
                aria-disabled={disabled || undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                tabIndex={disabled ? -1 : 0}
                // ⚠️ 展开后触发区被 Modal 的透明遮罩盖住，再点同一位置命中的是遮罩
                // （见 `close`）—— 用户观感与 Web 的「再次点击折叠」一致，
                // 但触发区自身的 `!open` 分支实际不可达，保留是为了与上游同形。
                onPress={() => {
                    if (!disabled) {
                        if (open && !showSearch) close();
                        else setOpen(true);
                    }
                }}
                style={[
                    styles.trigger,
                    showClear && { paddingRight: 58 },
                    open && styles.triggerOpen,
                    disabled && styles.triggerDisabled,
                    mode === 'dark' && {
                        backgroundColor: theme.colors.bg,
                        borderColor: open ? theme.colors.primary : theme.colors.border,
                    },
                ]}
                testID={testID ? `${testID}-trigger` : undefined}
            >
                {showSearch ? (
                    renderSearch(false)
                ) : (
                    <Text
                        style={[
                            value ? styles.value : styles.placeholder,
                            mode === 'dark' && { color: value ? theme.colors.text : theme.colors.textSecondary },
                        ]}
                        numberOfLines={1}
                    >
                        {currentLabel}
                    </Text>
                )}
                {/* `aria-hidden`：装饰性箭头，不进无障碍树（Web 版同样是 aria-hidden） */}
                <View
                    aria-hidden
                    style={[styles.arrow, showClear && { position: 'absolute', right: 13 }, open && styles.arrowOpen]}
                    testID={testID ? `${testID}-arrow` : undefined}
                >
                    <ArrowIcon
                        color={open ? theme.colors.primary : mode === 'dark' ? theme.colors.textSecondary : ARROW_COLOR}
                    />
                </View>
            </Pressable>

            {showClear && (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={clearAriaLabel}
                    nativeID={prefix + 'clear'}
                    hitSlop={6}
                    testID={testID ? `${testID}-clear` : undefined}
                    onPress={() => {
                        onChange('');
                        onClear?.();
                        focusControl();
                    }}
                    style={styles.clear}
                >
                    <CloseIcon size={12} />
                </Pressable>
            )}

            <Modal
                transparent
                visible={open}
                animationType="none"
                // Native Back and the Web keyboard adapter share the same close policy.
                onRequestClose={close}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    onLayout={(event) => {
                        const { width, height } = event.nativeEvent.layout;
                        if (width > 0 && height > 0)
                            setViewport((previous) =>
                                previous?.width === width && previous.height === height ? previous : { width, height }
                            );
                    }}
                >
                    {/*
                     * 透明全屏遮罩：对应 Web 的 `document.addEventListener('mousedown')` 外部点击关闭。
                     * 不画任何底色（Web 没有 scrim）。
                     */}
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={close}
                        testID={testID ? `${testID}-backdrop` : undefined}
                    />

                    {panelPosition && (
                        <Animated.View
                            ref={panelRef}
                            onLayout={(event) => {
                                const { width, height } = event.nativeEvent.layout;
                                if (width > 0 && height > 0)
                                    setPanelSize((previous) =>
                                        previous?.width === width && previous.height === height
                                            ? previous
                                            : { width, height }
                                    );
                            }}
                            nativeID={listId}
                            // ⚠️ 上游是 `role="listbox"`，但 **RN 0.87 的 `Role` 联合类型里没有
                            // `listbox`**（有 `list` / `listitem` / `option`，没有 `listbox`）。
                            // 取最接近的 `list`，这是被迫的语义降级 —— 见 RN-PORT.md 的契约表。
                            role="list"
                            aria-label={ariaLabel}
                            aria-labelledby={ariaLabelledBy}
                            // 面板自身要「吃掉」落在它身上的触摸，否则点到面板空白处会穿透到
                            // 下面那层遮罩、把面板关掉。Web 版靠 `wrapper.contains(e.target)`，
                            // RN 靠响应者系统，等价物就是这一句。
                            onStartShouldSetResponder={() => true}
                            style={[
                                styles.dropdown,
                                constrainDropdownPosition(
                                    panelPosition,
                                    panelWindow,
                                    panelSize ?? {
                                        width: 200,
                                        height: dropdownHeight(
                                            Math.max(1, filteredOptions.length) + (showSearch ? 1 : 0)
                                        ),
                                    }
                                ),
                                {
                                    opacity: visible,
                                    maxHeight: Math.max(1, panelWindow.height - 24),
                                    maxWidth: Math.max(1, panelWindow.width - 24),
                                },
                                mode === 'dark' && { backgroundColor: theme.colors.bgSecondary },
                            ]}
                            testID={testID ? `${testID}-listbox` : undefined}
                        >
                            {showSearch && renderSearch(true)}
                            <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
                                {filteredOptions.length === 0 ? (
                                    <View
                                        role="option"
                                        accessible
                                        accessibilityState={{ disabled: true, selected: false }}
                                        aria-disabled
                                        aria-selected={false}
                                        testID={testID ? `${testID}-not-found` : undefined}
                                        style={styles.option}
                                    >
                                        {typeof notFoundContent === 'string' || typeof notFoundContent === 'number' ? (
                                            <Text
                                                style={[
                                                    styles.optionLabel,
                                                    mode === 'dark' && { color: theme.colors.textSecondary },
                                                ]}
                                            >
                                                {notFoundContent}
                                            </Text>
                                        ) : (
                                            notFoundContent
                                        )}
                                    </View>
                                ) : (
                                    filteredOptions.map((option) => {
                                        const selected = value === option.key;
                                        return (
                                            <Pressable
                                                key={option.key}
                                                nativeID={optionPrefix + option.key}
                                                tabIndex={option.key === activeKey && !option.disabled ? 0 : -1}
                                                role="option"
                                                // `aria-selected`：RN 0.87 支持，RNTL 的 `getByRole('option', { selected })`
                                                // 直接读它；真机上 RN 的 View.js 会改写成 accessibilityState.selected。
                                                aria-selected={selected}
                                                disabled={option.disabled}
                                                accessibilityState={{ disabled: !!option.disabled, selected }}
                                                onPress={option.disabled ? undefined : () => handleSelect(option.key)}
                                                onFocus={() => {
                                                    if (!option.disabled) setActiveKey(option.key);
                                                }}
                                                onHoverIn={() => {
                                                    if (!option.disabled) setActiveKey(option.key);
                                                }}
                                                style={styles.option}
                                                testID={testID ? `${testID}-option-${option.key}` : undefined}
                                            >
                                                {({ pressed }) => (
                                                    <>
                                                        {/*
                                                         * `.pillBar`：选中项背后的黄色药丸。
                                                         * Web 用 `z-index: -1` 把它压到文字下面；RN 不靠负 zIndex
                                                         *（Android 上不可靠），改成「先渲染 = 先绘制」，
                                                         * 后面的文字自然盖在上面。
                                                         */}
                                                        {selected && <View style={styles.pillBar} />}
                                                        {/* `.optionDot { width: 16px }`：纯占位，Web 版也是 aria-hidden 空 span */}
                                                        <View aria-hidden style={styles.optionDot} />
                                                        <Text
                                                            style={[
                                                                styles.optionLabel,
                                                                (selected || pressed) && styles.optionLabelActive,
                                                                mode === 'dark' && { color: theme.colors.text },
                                                                option.disabled && { color: theme.colors.textDisabled },
                                                            ]}
                                                        >
                                                            {option.label}
                                                        </Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        );
                                    })
                                )}
                            </ScrollView>
                        </Animated.View>
                    )}
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

Select.displayName = 'Select';

/**
 * 对应 Web 的 `select.module.less`。映射说明：
 *   - 这个组件的 Less 里**没有** `var(--animal-*, …)`，所有颜色 / 间距 / 圆角都是硬编码，
 *     所以这里也照搬字面量（只有 `.arrow` 展开态的 `#19c8b9` 恰好等于 `colors.primary`，
 *     用 token 表达它、并注明来源）。
 *   - `@font-family` 是 Nunito + Noto Sans SC 字体栈，RN 不支持字体栈且 woff2 不可用
 *     （见 tokens.ts 的 `fontFamily`），与其余组件一样**不设置** family。
 *   - 已丢弃的样式（RN 无对应能力，逐条注明）：
 *       `.trigger:hover`（无 hover）、`.trigger { transition: all .2s }`（RN 没有 CSS 过渡，
 *       箭头旋转改为瞬时切换）、`.option:hover::before` 的三角光标 + `@keyframes cursorSlideIn`
 *       （无 hover）、`.dropdown.closing` + `dropdownFadeOut`（上游从未使用的死代码）、
 *       `user-select: none`（RN 没有文本选择，非 `selectable` 的 Text 本就不可选）。
 */
const styles = StyleSheet.create({
    // .wrapper { position: relative; display: inline-block; min-width: 140px }
    wrapper: {
        alignSelf: 'flex-start', // display: inline-block
        minWidth: TRIGGER_MIN_WIDTH,
    },
    // .disabled .trigger { opacity: 0.5; cursor: not-allowed; background: #f5f5f0 }
    wrapperDisabled: {
        opacity: 0.5,
    },
    // .trigger { display: flex; align-items: center; justify-content: space-between;
    //            padding: 8px 13px; background: #fff; border: 2px solid #e8dcc8; border-radius: 12px }
    trigger: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8, // 让长 label 与箭头之间至少留出间距（Web 靠 space-between 自然分开）
        paddingVertical: 8,
        paddingHorizontal: 13,
        backgroundColor: TRIGGER_BG,
        borderWidth: 2,
        borderColor: TRIGGER_BORDER,
        borderRadius: 12,
    },
    // .trigger.open { background: #fff; border-radius: 12px }（与静止态同值，无视觉变化）
    triggerOpen: {
        backgroundColor: TRIGGER_BG,
    },
    // .disabled .trigger { background: #f5f5f0 }（透明度由 wrapper 的 .disabled 承担）
    triggerDisabled: {
        backgroundColor: DISABLED_BG,
    },
    // .value { font-size: 14px; color: #725d42; font-weight: 600 }
    value: {
        flexShrink: 1,
        fontSize: 14,
        color: VALUE_COLOR,
        fontWeight: '600',
    },
    // .placeholder { font-size: 14px; color: #a09080 }
    placeholder: {
        flexShrink: 1,
        fontSize: 14,
        color: PLACEHOLDER_COLOR,
    },
    // .arrow { color: #a09080; display: flex; align-items: center }
    arrow: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    // .trigger.open .arrow { transform: rotate(180deg); color: #19c8b9 }
    // 颜色在 JSX 里传给 ArrowIcon（RN 没有 currentColor）；旋转照搬，
    // 但 `.arrow { transition: transform .2s }` 被丢弃（RN 没有 CSS 过渡）。
    arrowOpen: {
        transform: [{ rotate: '180deg' }],
    },
    // .dropdown { background: #ffeea0; border-radius: 28px; padding: 12px 0; z-index: 100 }
    // `position: absolute` 是 RN 侧新增的（面板在 Modal 里，靠绝对偏移定位）。
    dropdown: {
        position: 'absolute',
        paddingVertical: 12,
        backgroundColor: DROPDOWN_BG,
        borderRadius: 28,
    },
    // .option { display: flex; align-items: center; justify-content: center;
    //           padding: 10px 30px 10px 14px; font-size: 14px; font-weight: 500; color: #725d42;
    //           white-space: nowrap }
    option: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 10,
        paddingLeft: 14,
        paddingRight: 30,
    },
    // `.option:hover { font-weight: 700 }` 的 RN 替代：没有 hover，改用按下的 `pressed` 状态，
    // 加粗落在 optionLabelActive 上（与选中态同一处）。上游 hover 只改字重，没有背景变化。
    // .optionDot { width: 16px; font-size: 12px }
    optionDot: {
        width: 16,
    },
    // .option { font-size: 14px; font-weight: 500; color: #725d42; white-space: nowrap }
    optionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: VALUE_COLOR,
    },
    // .option.active { font-weight: 700 } / .option:hover { font-weight: 700 }
    optionLabelActive: {
        fontWeight: '700',
    },
    // .pillBar { position: absolute; left: 0; right: 0; top: 56%; transform: translateY(-50%);
    //            height: 14px; margin: 0 20px; background: #ffcc00; border-radius: 7px; opacity: 0.3 }
    // `translateY(-50%)` 是相对**自身**高度（14px）的，所以等价于 marginTop: -7（RN 的
    // transform 百分比支持不稳，用等价的 margin 更确定）。
    pillBar: {
        position: 'absolute',
        left: 20,
        right: 20,
        top: '56%',
        marginTop: -7,
        height: 14,
        borderRadius: 7,
        backgroundColor: PILL_BG,
        opacity: 0.3,
    },
    searchInput: {
        flex: 1,
        minWidth: 80,
        minHeight: 28,
        color: VALUE_COLOR,
        fontSize: 14,
        fontWeight: '600',
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    clear: {
        position: 'absolute',
        right: 24,
        top: 0,
        bottom: 0,
        minWidth: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
});
