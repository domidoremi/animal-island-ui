import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewInstance,
    type ViewStyle,
} from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';
import { TRIGGER_MIN_WIDTH, computeDropdownPosition, type DropdownPosition } from './geometry';

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
    /** 对外暴露的无障碍标签（无可见 label 时使用） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id */
    'aria-labelledby'?: string;
    /**
     * 自定义样式（作用于最外层容器）。
     *
     * ⚠️ 上游 `SelectProps` **没有** `style` / `className` / `testID`，也没有 `size`
     * （尺寸完全由 `select.module.less` 写死）。这里按 RN 侧的统一约定补 `style` + `testID`，
     * **没有**凭空加 `size` —— 上游没有的东西不发明。
     */
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

/**
 * 面板挂载时使用的兜底位置。
 *
 * 真机上 `measureInWindow` 回调到达前会先落在这里（下一帧就被校正，此时面板正从
 * `opacity: 0` 淡入，看不出来）；测试渲染器里回调**永不触发**，所以断言时看到的就是这个值。
 */
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
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    style,
    testID,
}) => {
    const { mode, theme, reducedMotion } = useTheme();
    const [open, setOpen] = useState(false);
    const [panelPosition, setPanelPosition] = useState<DropdownPosition | null>(null);
    const triggerRef = useRef<ViewInstance>(null);

    const windowSize = useWindowDimensions();

    const currentLabel = options.find((o) => o.key === value)?.label || placeholder;

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
        setOpen(false);
        setPanelPosition(null);
    }, []);

    // 展开时：重置淡入、测量触发区在屏幕上的位置
    useEffect(() => {
        if (!open) {
            setPanelPosition(null);
            return;
        }

        visible.setValue(0);
        Animated.timing(visible, {
            toValue: 1,
            duration: reducedMotion ? 0 : FADE_IN_MS,
            easing: EASE,
            useNativeDriver: true,
        }).start();

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
                setPanelPosition(computeDropdownPosition({ x, y, width, height }, windowSize, options.length));
            });
        }
        // `options.length` 会改变估算高度，进而改变翻边判断，所以要进依赖
    }, [open, visible, windowSize, options.length, reducedMotion]);

    const handleSelect = useCallback(
        (key: string) => {
            onChange(key);
            setOpen(false);
            setPanelPosition(null);
            // ⚠️ 上游还有一句 `triggerRef.current?.focus()` 把焦点交还触发区。
            // RN 的 View 没有 DOM 意义上的 focus，`focusable` 只是 Android 的原生焦点，
            // 没有对应的命令式 API，只能丢（与 `tabIndex` 的映射限制同源）。
        },
        [onChange]
    );

    return (
        <View style={[styles.wrapper, disabled && styles.wrapperDisabled, style]} testID={testID}>
            <Pressable
                ref={triggerRef}
                role="combobox"
                aria-expanded={open}
                // ⚠️ Web 版还有 `aria-haspopup="listbox"` / `aria-controls={listboxId}` /
                // `aria-activedescendant`：RN 三个都没有对应属性，全部丢弃
                //（`aria-controls` / `aria-haspopup` 是 RN-PORT.md 里点名「无 RN 等价物」的两个）。
                aria-disabled={disabled || undefined}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                tabIndex={disabled ? -1 : 0}
                // ⚠️ 展开后触发区被 Modal 的透明遮罩盖住，再点同一位置命中的是遮罩
                // （见 `close`）—— 用户观感与 Web 的「再次点击折叠」一致，
                // 但触发区自身的 `!open` 分支实际不可达，保留是为了与上游同形。
                onPress={() => !disabled && setOpen(!open)}
                style={[
                    styles.trigger,
                    open && styles.triggerOpen,
                    disabled && styles.triggerDisabled,
                    mode === 'dark' && {
                        backgroundColor: theme.colors.bg,
                        borderColor: open ? theme.colors.primary : theme.colors.border,
                    },
                ]}
                testID={testID ? `${testID}-trigger` : undefined}
            >
                <Text
                    style={[
                        value ? styles.value : styles.placeholder,
                        mode === 'dark' && { color: value ? theme.colors.text : theme.colors.textSecondary },
                    ]}
                    numberOfLines={1}
                >
                    {currentLabel}
                </Text>
                {/* `aria-hidden`：装饰性箭头，不进无障碍树（Web 版同样是 aria-hidden） */}
                <View
                    aria-hidden
                    style={[styles.arrow, open && styles.arrowOpen]}
                    testID={testID ? `${testID}-arrow` : undefined}
                >
                    <ArrowIcon
                        color={open ? theme.colors.primary : mode === 'dark' ? theme.colors.textSecondary : ARROW_COLOR}
                    />
                </View>
            </Pressable>

            <Modal
                transparent
                visible={open}
                animationType="none"
                // Android 实体返回键 / 手势返回：等价于 Web 版的 Escape（键盘事件 RN 没有）
                onRequestClose={close}
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
                            panelPosition,
                            { opacity: visible },
                            mode === 'dark' && { backgroundColor: theme.colors.bgSecondary },
                        ]}
                        testID={testID ? `${testID}-listbox` : undefined}
                    >
                        {options.map((option) => {
                            const selected = value === option.key;
                            return (
                                <Pressable
                                    key={option.key}
                                    role="option"
                                    // `aria-selected`：RN 0.87 支持，RNTL 的 `getByRole('option', { selected })`
                                    // 直接读它；真机上 RN 的 View.js 会改写成 accessibilityState.selected。
                                    aria-selected={selected}
                                    disabled={option.disabled}
                                    accessibilityState={{ disabled: !!option.disabled, selected }}
                                    onPress={option.disabled ? undefined : () => handleSelect(option.key)}
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
                        })}
                    </Animated.View>
                )}
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
});
