import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    type LayoutChangeEvent,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
    type PressableProps,
} from 'react-native';
import { duration as motionDuration, easing as motionEase } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export type SwitchSize = 'small' | 'default';

export interface SwitchProps {
    /** 是否选中（受控） */
    checked?: boolean;
    /** 默认是否选中 */
    defaultChecked?: boolean;
    /** 尺寸 */
    size?: SwitchSize;
    /** 禁用 */
    disabled?: boolean;
    /** 加载状态 */
    loading?: boolean;
    /** 选中时文案 */
    checkedChildren?: React.ReactNode;
    /** 未选中时文案 */
    unCheckedChildren?: React.ReactNode;
    /** 变化回调 */
    onChange?: (checked: boolean) => void;
    /**
     * 自定义样式（作用于最外层 Pressable）。
     *
     * 对应 Web 版的 `className`：RN 没有类名系统，`style` 是它的替代物。
     */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /** 无障碍标签（无可见 label 时使用） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id */
    'aria-labelledby'?: string;
    /** Extend the compact track's native touch target without changing its shape. */
    hitSlop?: PressableProps['hitSlop'];
}

/**
 * 尺寸规格 —— 对应 `.switch` / `.switch-small`。
 *
 * ⚠️ `switch.module.less` **没有引用任何 Less 变量**（颜色、尺寸全部硬编码），
 * 所以这里也逐条照搬硬编码值，不走 `src/theme/tokens.ts`。
 * 唯一走 token 的是动效：Less 用的是 `var(--animal-motion-duration-base)` 与
 * `var(--animal-motion-ease)`，对应 `motionDuration.base` / `motionEase`。
 *
 * 把手位置说明（CSS 的百分比是按**内边距盒**解析的，Yoga 的绝对定位同理）：
 *   - 未选中 `left: 2px`（small `1px`）→ 直接照搬；
 *   - 选中 `left: calc(100% - 24px)`（small `calc(100% - 16px)`）是「内边距盒宽度 -
 *     24」，宽度由文案撑开，RN 没有 `calc`。改成等价的 `right: 3px`
 *     （small `2px`）= 24 - 把手 21（16 - 14），与盒子宽度无关。
 */
type Spec = {
    minWidth: number;
    height: number;
    borderWidth: number;
    handleSize: number;
    /** 未选中时把手距内边距盒左边缘 */
    handleOffset: number;
    /** 选中时把手距内边距盒右边缘 */
    handleCheckedInset: number;
    fontSize: number;
    /** `.inner` 未选中时的左右内边距 */
    paddingStart: number;
    paddingEnd: number;
};

const SPEC: Record<SwitchSize, Spec> = {
    default: {
        minWidth: 52,
        height: 28,
        borderWidth: 2.5,
        handleSize: 21,
        handleOffset: 2,
        handleCheckedInset: 3,
        fontSize: 11,
        paddingStart: 28,
        paddingEnd: 8,
    },
    small: {
        minWidth: 38,
        height: 20,
        borderWidth: 2.5,
        handleSize: 14,
        handleOffset: 1,
        handleCheckedInset: 2,
        fontSize: 9,
        paddingStart: 20,
        paddingEnd: 6,
    },
};

/** Less 里硬编码的颜色，逐字照搬 */
const PALETTE = {
    trackOff: '#d4c9b4',
    trackOn: '#86d67a',
    borderOff: '#c4b89e',
    borderOn: '#6fba2c',
    handleBg: 'rgb(247, 243, 223)',
    spinnerOn: '#6fba2c',
    spinnerOff: '#a89878',
} as const;

/**
 * `.switch { box-shadow: inset 0 2px 4px rgba(114, 93, 66, 0.15) }` /
 * `.switch-checked { box-shadow: inset 0 2px 4px rgba(90, 158, 30, 0.2) }`。
 *
 * 上游省略了 spread（等价于 0），这里补全成 RN 解析器能读的四段式。
 * 另外：RN 的 `Animated` **无法插值 boxShadow**，所以这两条阴影是**瞬间切换**的
 * （Web 的 `transition: all` 会把它一起过渡掉）——这是有意放弃的一处动效。
 */
const SHADOW_OFF = 'inset 0 2px 4px 0 rgba(114, 93, 66, 0.15)';
const SHADOW_ON = 'inset 0 2px 4px 0 rgba(90, 158, 30, 0.2)';

/**
 * Pressable 本身不是 Animated 组件，而轨道背景 / 描边 / 把手位移都要靠 Animated
 * 驱动，所以把 Pressable 包一层 —— 这样根节点仍然是唯一的、带 `role="switch"`
 * 的可点区域（与 Web 的 `<button role="switch">` 结构一致）。
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Switch: React.FC<SwitchProps> = ({
    checked,
    defaultChecked = false,
    size = 'default',
    disabled = false,
    loading = false,
    checkedChildren,
    unCheckedChildren,
    onChange,
    style,
    testID,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    hitSlop,
}) => {
    const { mode, theme, reducedMotion } = useTheme();
    const palette =
        mode === 'dark'
            ? {
                  ...PALETTE,
                  trackOff: theme.colors.bgSecondary,
                  trackOn: theme.colors.primaryBg,
                  borderOff: theme.colors.border,
                  borderOn: theme.colors.primary,
                  handleBg: theme.colors.text,
                  spinnerOn: theme.colors.primary,
                  spinnerOff: theme.colors.textSecondary,
              }
            : PALETTE;
    const [innerChecked, setInnerChecked] = useState(defaultChecked);
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : innerChecked;

    const spec = SPEC[size];
    const interactive = !disabled && !loading;

    /**
     * 轨道宽度需要实测。
     *
     * 上游用 `left: calc(100% - 24px)` 定位选中态的把手，百分比解析的是内边距盒宽度，
     * 而盒子宽度是被文案撑开的（`min-width` 只是下限），所以位移量必须先量宽才知道。
     * 量不到（测试渲染器不会触发 onLayout）时位移为 0，把手停在未选中位置。
     */
    const [trackWidth, setTrackWidth] = useState(0);
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        setTrackWidth(e.nativeEvent.layout.width);
    }, []);

    /**
     * 选中进度 0 → 1，对应 `.switch { transition: all 0.25s var(--animal-motion-ease) }`。
     *
     * 用 `useNativeDriver: false`：背景色 / 描边色是颜色插值，只能在 JS 侧算，
     * 一个 Value 同时驱动位移与颜色，不能拆成两个 driver。
     */
    const progress = useRef(new Animated.Value(isChecked ? 1 : 0)).current;
    useEffect(() => {
        Animated.timing(progress, {
            toValue: isChecked ? 1 : 0,
            duration: reducedMotion ? 0 : motionDuration.base,
            easing: Easing.bezier(...motionEase),
            useNativeDriver: false,
        }).start();
    }, [isChecked, progress, reducedMotion]);

    /** 加载指示器旋转 —— `@keyframes animal-spin { to { transform: rotate(360deg) } }`，0.6s linear */
    const spin = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!loading || reducedMotion) {
            spin.setValue(0);
            return undefined;
        }
        const animation = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 600,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, [loading, spin, reducedMotion]);

    const handleClick = useCallback(() => {
        if (disabled || loading) return;
        const next = !isChecked;
        if (!isControlled) setInnerChecked(next);
        onChange?.(next);
    }, [disabled, loading, isChecked, isControlled, onChange]);

    // 内边距盒宽度 = 轨道宽度 - 两侧描边；把手位移 = 内边距盒宽度 - 右内边距 - 把手宽 - 左偏移
    const innerWidth = Math.max(trackWidth - spec.borderWidth * 2, 0);
    const travel = Math.max(innerWidth - spec.handleCheckedInset - spec.handleSize - spec.handleOffset, 0);

    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel] });
    const trackBackgroundColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [palette.trackOff, palette.trackOn],
    });
    const trackBorderColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [palette.borderOff, palette.borderOn],
    });
    const handleBorderColor = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [palette.borderOff, palette.borderOn],
    });
    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    /** 把手垂直居中：`.handle { top: 50%; transform: translateY(-50%) }`（RN 的 transform 不支持百分比） */
    const handleTop = (spec.height - spec.borderWidth * 2 - spec.handleSize) / 2;

    return (
        <AnimatedPressable
            // Web 版：<button type="button" role="switch" aria-checked={isChecked} ...>
            // RN 0.87 的 Pressable 原生支持 ARIA 风格 prop，`aria-checked` 会被合进
            // `accessibilityState.checked`；`aria-busy` 同理（上游写的是 `loading || undefined`）。
            role="switch"
            aria-checked={isChecked}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-busy={loading || undefined}
            disabled={disabled}
            hitSlop={hitSlop}
            // Web 的 `.switch-loading { pointer-events: none }`
            pointerEvents={loading ? 'none' : 'auto'}
            // 非交互时把 handler 摘掉，而不只是在 handler 里 return：
            // RNTL 的 fireEvent 会绕过 Pressability 直接调用 Pressable 的 onPress。
            onPress={interactive ? handleClick : undefined}
            onLayout={handleLayout}
            style={[
                styles.track,
                {
                    minWidth: spec.minWidth,
                    height: spec.height,
                    borderWidth: spec.borderWidth,
                    backgroundColor: trackBackgroundColor,
                    borderColor: trackBorderColor,
                    boxShadow: isChecked ? SHADOW_ON : SHADOW_OFF,
                },
                disabled && styles.disabled,
                loading && styles.loading,
                style,
            ]}
            testID={testID}
        >
            <Animated.View
                style={[
                    styles.handle,
                    {
                        width: spec.handleSize,
                        height: spec.handleSize,
                        borderRadius: spec.handleSize / 2,
                        left: spec.handleOffset,
                        top: handleTop,
                        borderWidth: spec.borderWidth,
                        borderColor: handleBorderColor,
                        backgroundColor: palette.handleBg,
                        transform: [{ translateX }],
                    },
                ]}
                testID={testID ? `${testID}-handle` : undefined}
            >
                {loading && (
                    <Animated.View
                        style={[
                            styles.spinner,
                            {
                                // `.spinner { border: 2px solid #6fba2c; border-right-color: transparent }`
                                // `.switch:not(.switch-checked) .spinner { border-color: #a89878 }`
                                // 注意 `.spinner` 自己没有 transition，颜色是瞬间切换的（不做插值）。
                                borderColor: isChecked ? palette.spinnerOn : palette.spinnerOff,
                                transform: [{ rotate }],
                            },
                        ]}
                        testID={testID ? `${testID}-spinner` : undefined}
                    />
                )}
            </Animated.View>

            {/* `.inner`。RN 里字符串必须包在 Text 里；`white-space: nowrap` → numberOfLines={1} */}
            <Text
                numberOfLines={1}
                style={[
                    styles.inner,
                    {
                        fontSize: spec.fontSize,
                        lineHeight: spec.fontSize, // CSS line-height: 1
                        letterSpacing: 0.02 * spec.fontSize, // CSS letter-spacing: 0.02em
                        paddingLeft: isChecked ? spec.paddingEnd : spec.paddingStart,
                        paddingRight: isChecked ? spec.paddingStart : spec.paddingEnd,
                    },
                ]}
                testID={testID ? `${testID}-inner` : undefined}
            >
                {isChecked ? checkedChildren : unCheckedChildren}
            </Text>
        </AnimatedPressable>
    );
};

Switch.displayName = 'Switch';

const styles = StyleSheet.create({
    track: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 0,
        borderRadius: 50, // CSS border-radius: 50px
        // Web 是 `display: inline-flex`：RN 的 View 在 column 父容器里默认拉伸，
        // 想「按内容宽度收缩」必须显式 flex-start（与 Button 的处理一致）。
        alignSelf: 'flex-start',
    },
    disabled: {
        opacity: 0.5, // `.switch-disabled { opacity: 0.5 }`
    },
    loading: {
        opacity: 0.7, // `.switch-loading { opacity: 0.7 }`（在 .switch-disabled 之后定义，故优先）
    },
    handle: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: PALETTE.handleBg,
    },
    spinner: {
        width: 11,
        height: 11,
        borderWidth: 2,
        borderRadius: 5.5,
        borderRightColor: 'transparent',
    },
    inner: {
        color: '#fff',
        fontWeight: '700',
        // CSS text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1)
        textShadowColor: 'rgba(0, 0, 0, 0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
    } as TextStyle,
});
