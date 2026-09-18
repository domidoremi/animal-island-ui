import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { colors, fontSize as fontSizeToken, spacing } from '../../theme/tokens';

export type RadioSize = 'small' | 'middle' | 'large';

export interface RadioOption {
    /** 选项标签 */
    label: React.ReactNode;
    /** 选项值 */
    value: string | number;
    /** 是否禁用该选项 */
    disabled?: boolean;
}

export interface RadioProps {
    /** 选中的值（受控） */
    value?: string | number;
    /** 默认选中的值 */
    defaultValue?: string | number;
    /** 选项列表 */
    options: RadioOption[];
    /** 尺寸 */
    size?: RadioSize;
    /** 禁用全部 */
    disabled?: boolean;
    /** 布局方向 */
    direction?: 'horizontal' | 'vertical';
    /** 变化回调 */
    onChange?: (value: string | number) => void;
    /**
     * 自定义样式（作用于最外层 View）。
     *
     * 对应 Web 版的 `className`：RN 没有类名系统，`style` 是它的替代物。
     */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * 尺寸规格 —— 对应 `.small` / `.middle` / `.large` 里的 CSS 变量。
 *
 *   --cbx-size:    18 / 22 / 28
 *   --cbx-check-w: 10 / 12 / 15
 *   --cbx-check-h: 9  / 11 / 14
 *   .label { font-size: @font-size-sm / -base / -lg }  → 12 / 14 / 16（走 token）
 */
const SIZE_SPEC: Record<RadioSize, { box: number; checkWidth: number; checkHeight: number; fontSize: number }> = {
    small: { box: 18, checkWidth: 10, checkHeight: 9, fontSize: fontSizeToken.sm },
    middle: { box: 22, checkWidth: 12, checkHeight: 11, fontSize: fontSizeToken.base },
    large: { box: 28, checkWidth: 15, checkHeight: 14, fontSize: fontSizeToken.lg },
};

/** 圆圈描边 —— `.cbx input { border: 2px solid #c4b89e }`（Less 硬编码，照搬） */
const BOX_BORDER = '#c4b89e';
/** 圆圈底色 —— `.cbx input { background: rgb(247, 243, 223) }`（Less 硬编码，照搬） */
const BOX_BG = 'rgb(247, 243, 223)';
/** 标签文字色 —— `.label { color: #725d42 }`（Less 硬编码，照搬；tokens 里没有同值项） */
const LABEL_COLOR = '#725d42';
/** 选中态标签色 —— `.checked .label { color: #794f27 }`（Less 硬编码，照搬；与 `colors.text` 同值） */
const LABEL_COLOR_CHECKED = '#794f27';
/** 禁用态底色 —— `.disabled .cbx input { background: #f0ece2 }`（与 `colors.bgDisabled` 同值，但 Less 是硬编码的） */
const BOX_BG_DISABLED = '#f0ece2';
/** 禁用态描边 —— `.disabled .cbx input { border-color: #d4c9b4 }`（与 `colors.textDisabled` 同值） */
const BOX_BORDER_DISABLED = '#d4c9b4';
/** 勾的描边 —— `.check path { stroke: #fff }`；禁用态 `.disabled .cbx .check path { stroke: #c4b89e }` */
const CHECK_STROKE = '#fff';
const CHECK_STROKE_DISABLED = '#c4b89e';

/**
 * 勾的路径总长 —— `.check path { stroke-dasharray: 19; stroke-dashoffset: 19 }`。
 * `stroke-dashoffset: 19`（= 整条虚线长度）让描边完全藏在虚线间隙里，视觉上就是「没画」；
 * 选中时 `input:checked ~ .check path { stroke-dashoffset: 0 }` 把它画出来。
 */
const CHECK_DASH = 19;

/**
 * 勾的描边色。
 *
 * ⚠️ **丢弃的动效**：`.check path { transition: stroke-dashoffset 0.3s ease; transition-delay: 0.2s }`
 * —— RN 没有 CSS 过渡，用 `Animated` 驱动 `react-native-svg` 的 `strokeDashoffset`
 * 需要 JS 逐帧（`useNativeDriver: false`），成本与收益不成比例。这里改成**瞬时切换**
 * （与 Tag / Card 丢弃 `transition` 的处理一致）。
 *
 * ⚠️ **丢弃的动效**：`@keyframes animal-radio-splash`（`.splash` 的 6 个 box-shadow 水波）
 * —— 它靠 `box-shadow` 的多段 spread 扩散，而 RN 的 `Animated` **无法插值 `boxShadow`**
 * （见 Switch 的同类说明）。水波是「纯动效」：静止态 `.splash { background: none }` 完全不可见，
 * 所以丢弃它不影响任何静态视觉或行为，只是没有那一下涟漪。
 * `.splash` 这个 `aria-hidden` 的装饰节点本身也就不需要了。
 */
export const Radio: React.FC<RadioProps> = ({
    value,
    defaultValue,
    options,
    size = 'middle',
    disabled = false,
    direction = 'horizontal',
    onChange,
    style,
    testID,
}) => {
    const [innerValue, setInnerValue] = useState<string | number | undefined>(defaultValue);
    const isControlled = value !== undefined;
    const checkedValue = isControlled ? value : innerValue;

    const spec = SIZE_SPEC[size];
    const sub = (suffix: string) => (testID === undefined ? undefined : `${testID}-${suffix}`);

    const handleChange = useCallback(
        (optValue: string | number, optDisabled?: boolean) => {
            if (disabled || optDisabled) return;
            if (!isControlled) setInnerValue(optValue);
            onChange?.(optValue);
        },
        [disabled, isControlled, onChange]
    );

    return (
        <View
            // ⚠️ Web 版是 `<div role="radiogroup">`。RN 0.87 的 `Role` 联合里**有**
            // `radiogroup`，但这里**不能**加 `accessible`：那会把整组选项合并成一个
            // 无障碍节点，毁掉每个单选项的独立可达性（与 Collapse 面板不加
            // `accessible` 同一理由）。代价是根节点在 RNTL 里查不到（`getByRole`
            // 要求 `isAccessibilityElement`），只能断言 prop 透传。
            role="radiogroup"
            style={[styles.group, direction === 'vertical' ? styles.vertical : styles.horizontal, style]}
            testID={testID}
        >
            {options.map((opt) => {
                const isChecked = checkedValue === opt.value;
                const isDisabled = disabled || opt.disabled;
                const valueKey = String(opt.value);

                // CSS 层叠（同权重按源码顺序，见 radio.module.less）：
                //   `.checked .cbx input`(L154) < `.disabled .cbx input`(L161)
                // 所以「禁用 + 选中」时看到的是禁用配色。
                const boxStyle: StyleProp<ViewStyle> = {
                    width: spec.box,
                    height: spec.box,
                    borderRadius: spec.box / 2,
                    backgroundColor: isDisabled ? BOX_BG_DISABLED : isChecked ? colors.primary : BOX_BG,
                    borderColor: isDisabled ? BOX_BORDER_DISABLED : isChecked ? colors.primaryActive : BOX_BORDER,
                };

                // `.check { top: 50%; left: 50%; transform: translate(-50%, -54%) }`
                // RN 的 transform 不支持百分比，改写成等价的绝对偏移：
                //   top  = 50% * box - 54% * checkHeight
                //   left = 50% * box - 50% * checkWidth
                const checkOffset: StyleProp<ViewStyle> = {
                    position: 'absolute',
                    top: spec.box / 2 - 0.54 * spec.checkHeight,
                    left: spec.box / 2 - 0.5 * spec.checkWidth,
                };

                const labelStyle = [
                    styles.label,
                    // CSS `letter-spacing: 0.01em` 是相对字号的比例，RN 只接受绝对值 → 按字号换算
                    { fontSize: spec.fontSize, letterSpacing: spec.fontSize * 0.01 },
                    isChecked && styles.labelChecked,
                    isDisabled && styles.labelDisabled,
                ];

                // 上游把 label 无条件包在 `<span className={styles.label}>` 里；RN 里裸字符串
                // 不能直接作为 View 的子节点，而 `<Text>` 又不能安全地包住任意节点，
                // 所以只包文本/数字，节点原样透传（与 Tag / Card 同一处理）。
                // 代价：非文本 label 拿不到由文本推导出的可访问名。
                const labelNode =
                    typeof opt.label === 'string' || typeof opt.label === 'number' ? (
                        <Text style={labelStyle}>{opt.label}</Text>
                    ) : (
                        opt.label
                    );

                return (
                    <Pressable
                        key={valueKey}
                        // ⚠️ Web 版是 `<label><input type="radio" name={idBase} checked disabled /></label>`。
                        // RN 没有 `<input type="radio">`，用 Pressable + ARIA 角色复刻：
                        //   - `role="radio"` 取代 `type="radio"`；
                        //   - `aria-checked` 取代 `checked`（Pressable 会把它并进
                        //     `accessibilityState.checked`，RNTL 的 `getByRole(..., { checked })`
                        //     对 radio / checkbox / switch 三个角色生效）；
                        //   - `disabled` 取代 `disabled`（同时给出 `accessibilityState.disabled`）。
                        // 丢弃：`id` / `htmlFor`（RN 无 id 绑定，label 文本就在 Pressable 内部，
                        //       自然成为可访问名）、`name`（RN 无表单 name；单选语义由
                        //       `role="radiogroup"` + 每个 `role="radio"` 表达）、
                        //       `tabIndex`（roving tabindex 的载体不存在，见文件末尾的键盘说明）。
                        role="radio"
                        aria-checked={isChecked}
                        disabled={isDisabled}
                        // 非交互时把 handler 摘掉，而不只是在 handler 里 return：
                        // RNTL 的 fireEvent 会绕过 Pressability 直接调用 Pressable 的 onPress。
                        onPress={isDisabled ? undefined : () => handleChange(opt.value, opt.disabled)}
                        style={[styles.item, isDisabled && styles.itemDisabled]}
                        testID={sub(`option-${valueKey}`)}
                    >
                        <View style={[styles.box, boxStyle]} testID={sub(`box-${valueKey}`)}>
                            {/*
                             * 装饰性：勾的形状已经由 `aria-checked` 表达，整块不进无障碍树。
                             * 注意 `aria-hidden` 必须挂在 **View** 上：`react-native-svg` 的
                             * `extractProps` 只搬运 `accessible` / `accessibilityLabel`，
                             * 会把 `aria-hidden` 丢掉，挂在 `<Svg>` 上是空操作。
                             * （上游的 `<svg className={styles.check}>` 没有 aria-hidden，
                             *   但它没有文本、本来也进不了可访问名 —— 这里显式标出来更稳。）
                             */}
                            <View
                                style={checkOffset}
                                pointerEvents="none"
                                aria-hidden
                                testID={sub(`check-${valueKey}`)}
                            >
                                <Svg width={spec.checkWidth} height={spec.checkHeight} viewBox="0 0 15 14" fill="none">
                                    <Path
                                        d="M2 8.36364L6.23077 12L13 2"
                                        stroke={isDisabled ? CHECK_STROKE_DISABLED : CHECK_STROKE}
                                        strokeWidth={3}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeDasharray={CHECK_DASH}
                                        strokeDashoffset={isChecked ? 0 : CHECK_DASH}
                                        fill="none"
                                        testID={sub(`check-path-${valueKey}`)}
                                    />
                                </Svg>
                            </View>
                        </View>
                        {labelNode}
                    </Pressable>
                );
            })}
        </View>
    );
};

Radio.displayName = 'Radio';

/**
 * ⚠️ **整段丢弃：键盘可访问性。**
 *
 * 上游实现了 roving tabindex（`tabIndex={isFocusable ? 0 : -1}`）+
 * `onKeyDown` 的 ArrowRight / ArrowDown / ArrowLeft / ArrowUp / Home / End ——
 * 全部是 **DOM 键盘事件**，RN 没有对应能力（见 RN-PORT.md 的移植契约表）。
 *
 * 触摸设备上的等价物由系统读屏承担：因为每个单选项都是**独立的无障碍节点**
 * （`role="radio"` + `accessibilityState.checked`，组容器刻意不设 `accessible`），
 * TalkBack / VoiceOver 会用「单选组 + 上下滑动切换 + 双击选中」的原生交互覆盖
 * 同一功能。RN 侧没有 API 可以断言这一点，所以对应的 4 个 Web 用例被丢弃。
 */
const styles = StyleSheet.create({
    // `.radioGroup { display: flex; flex-wrap: wrap; gap: @spacing-lg; font-family: @font-family }`
    // 丢弃：`font-family` —— RN 不支持字体栈（见 tokens.ts 的 fontFamily 注释）。
    group: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.lg,
        // Web 的 `display: flex` 在 column 父容器里默认拉伸，想按内容宽度收缩必须显式 flex-start
        alignSelf: 'flex-start',
    },
    // `.horizontal { flex-direction: row }`
    horizontal: {
        flexDirection: 'row',
    },
    // `.vertical { flex-direction: column; gap: @spacing-md }`
    vertical: {
        flexDirection: 'column',
        gap: spacing.md,
    },
    // `.radioItem { display: inline-flex; align-items: center; gap: @spacing-sm; position: relative }`
    // 丢弃：`cursor: pointer` / `user-select: none`（RN 无光标、Text 默认不可选中）。
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    // `.disabled { cursor: not-allowed; opacity: 0.55 }` —— 光标部分丢弃，只保留 opacity
    itemDisabled: {
        opacity: 0.55,
    },
    // `.cbx { position: relative; width: var(--cbx-size); height: var(--cbx-size); flex-shrink: 0 }`
    // 丢弃：`flex-shrink: 0` —— RN 的默认 flexShrink 就是 0，等价。
    box: {
        position: 'relative',
        borderWidth: 2,
    },
    // `.label { color: #725d42; font-weight: 500; letter-spacing: 0.01em }`
    // 丢弃：`transition: color @motion-duration-fast`（RN 没有 CSS 过渡，选中是瞬时的）。
    // `font-size` 与 `letter-spacing` 随尺寸变化，在行内给（见 labelStyle）。
    label: {
        color: LABEL_COLOR,
        fontWeight: '500',
    },
    // `.checked .label { color: #794f27 }`
    labelChecked: {
        color: LABEL_COLOR_CHECKED,
    },
    // `.disabled .label { color: #c4b89e }`（源码在 `.checked .label` 之后，故优先）
    labelDisabled: {
        color: CHECK_STROKE_DISABLED,
    },
});
