import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CoffeeBreak, ForestGrove, StarryCamp, SweetCorner, type SceneImageProps } from '../../assets/image/rn';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { BACKGROUND_PATTERN_SPEC, BackgroundLayer, BackgroundPatternLayer } from '../Background/patterns';
import type { ProgressProps, ProgressSize, ProgressVariant } from './types';
import { useReduceMotion } from './useReduceMotion';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * 场景图 type → RN 组件。
 *
 * Web 版这里是 `.svg` 模块 import 出来的 **URL 字符串**，塞进
 * `backgroundImage: url(...)`；RN 没有 svg loader、也没有 CSS 背景，
 * 所以值换成 `react-native-svg` 组件（见 `src/assets/image/rn/`）。
 */
const VARIANT_IMAGE: Record<ProgressVariant, React.FC<SceneImageProps>> = {
    'sweet-corner': SweetCorner,
    'forest-grove': ForestGrove,
    'starry-camp': StarryCamp,
    'coffee-break': CoffeeBreak,
};

/** 场景图固有比例（2560 × 1440 = 16:9）。CSS 的 `background-size: <trackW>px auto` 用它换算高度。 */
const SCENE_ASPECT_RATIO = 2560 / 1440;

/** `.track.size-*` 的高度 */
const SIZE_HEIGHT: Record<ProgressSize, number> = {
    small: 14,
    middle: 24,
    large: 32,
};

/** `.fill { transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1) }` */
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * track 的奶油色波点底。
 *
 * `.track` 的 CSS 是
 *   `radial-gradient(...) 0 0 / 28px 28px, radial-gradient(...) 7px 7px / 14px 14px, @track-bg`
 * —— Less 自己的注释写着「与 Background default / Card pattern-default 一致」，
 * 数值也确实和 `Background` 的 `default` 图案逐字相同。既然上游把它们定义为同一张壁纸，
 * 这里就直接复用 `Background` 的 spec（而不是再抄一份 10 个圆点），
 * 保证两处永远同步。代价是 Progress 依赖 Background 的图案模块。
 */
const TRACK_PATTERN = BACKGROUND_PATTERN_SPEC.default;

/** 把 `React.ReactNode` 收窄成能直接塞进 `<Text>` 的类型（RN 要求文本必须包在 Text 里） */
const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

/**
 * 与上游 Web 版的差异（都在下面就地注释过，这里汇总一遍）：
 *
 * 1. **fill 宽度动画**：CSS 的 `transition: width 0.6s cubic-bezier(0.4,0,0.2,1)` 换成
 *    `Animated.Value` 驱动 `width`（`useNativeDriver: false`，因为 `width` 只能在 JS 侧算）。
 *    `duration` 语义不变（秒）。首次渲染不动画 —— 与 CSS transition 的行为一致。
 * 2. **`@media (prefers-reduced-motion: reduce)`** 换成 `useReduceMotion()`
 *    （`AccessibilityInfo.isReduceMotionEnabled`）。见 `useReduceMotion.ts`。
 * 3. **未测量到轨道宽度的那一帧不画场景图**：Web 用 `background-size: 100% auto` 兜底，
 *    RN 里「按宽度百分比推高度」不可表达，所以那一帧 fill 是空的。
 *    `onLayout` 在下一帧就会回调（Web 侧 `clientWidth` 也是首帧后才有值），
 *    且 fill 宽度同时从 0 开始展开，观感无差别。
 * 4. **`.track.size-small { border-width: 1.5px }` 不还原**：Web 上它是死代码
 *    （`border` 简写被注释掉了，没有 border-style），RN 里只写 `borderWidth` 会画出黑边。
 * 5. **track 的波点底复用 `Background` 的 spec**（而不是再抄一份），见 `TRACK_PATTERN`。
 * 6. **`.info` 拆成「盒子 View + Text」两层**：RN 的文字样式必须落在 `<Text>` 上。
 *    `infoFormat` 返回非文本节点时原样渲染，此时只有盒子的 `minWidth` / 右对齐，
 *    文字样式（字重 / 颜色 / 字距）不生效 —— 这是 RN 的 `<Text>` 语义决定的。
 */
export const Progress: React.FC<ProgressProps> = ({
    percent,
    size = 'middle',
    variant = 'sweet-corner',
    showInfo = true,
    infoFormat,
    duration = 0.6,
    style,
    testID,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    indeterminate = false,
    fillColor,
}) => {
    const { mode, theme, reducedMotion } = useTheme();
    const safePercent = useMemo(() => {
        if (typeof percent !== 'number' || Number.isNaN(percent)) return 0;
        return Math.max(0, Math.min(100, percent));
    }, [percent]);

    const renderedInfo = useMemo(() => {
        if (infoFormat) return infoFormat(safePercent);
        if (indeterminate) return '';
        return `${Math.round(safePercent)}%`;
    }, [infoFormat, safePercent, indeterminate]);

    // track 宽度（px）：图片按整条轨道宽度铺满（取上部），fill 只显示左侧进度宽的部分 = 从左揭开。
    // Web 靠 ResizeObserver + clientWidth（见 RN-PORT.md 的映射表）；RN 用 onLayout。
    const [trackWidth, setTrackWidth] = useState(0);
    const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
        setTrackWidth(e.nativeEvent.layout.width);
    }, []);

    const Scene = VARIANT_IMAGE[variant];

    // ---------- fill 宽度动画：替代 CSS 的 `transition: width 0.6s cubic-bezier(...)` ----------
    const reduceMotion = useReduceMotion();
    const fillPercent = useRef(new Animated.Value(safePercent)).current;
    const isFirstRender = useRef(true);

    useEffect(() => {
        // CSS 的 transition **不会**在首次渲染时播放（元素直接以目标宽度出现），
        // 所以挂载时只同步数值、不动画。
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fillPercent.setValue(safePercent);
            return undefined;
        }
        // `duration={0}` → CSS 的 `.noTransition`；系统开了「减弱动态效果」→ 上游的
        // `@media (prefers-reduced-motion: reduce)`。两者都直接跳到目标值。
        if (duration === 0 || reduceMotion || reducedMotion) {
            fillPercent.setValue(safePercent);
            return undefined;
        }
        const animation = Animated.timing(fillPercent, {
            toValue: safePercent,
            duration: duration * 1000, // CSS 的 transition-duration 单位是秒
            easing: EASE,
            useNativeDriver: false, // `width` 只能在 JS 侧算
        });
        animation.start();
        return () => animation.stop();
    }, [safePercent, duration, reduceMotion, reducedMotion, fillPercent]);

    // 0–100 的数值插值成百分比宽度字符串
    const fillWidth = fillPercent.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

    const ariaValueText = typeof renderedInfo === 'string' ? renderedInfo : undefined;

    return (
        // 与 Collapse 的面板不同，这里**显式**加了 `accessible`：进度条子树只有一条装饰性
        // 轨道 + 一段百分比文字，没有可交互 / 富内容会被「压平」，而且不加 `accessible`
        // 时裸 View 在 iOS 上不会被当作无障碍元素，`role="progressbar"` 等于白设。
        // （Web 版 `<div role="progressbar">` 本来就是暴露给读屏的。）
        <View
            role="progressbar"
            accessible
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : Math.round(safePercent)}
            aria-valuetext={ariaValueText}
            style={[styles.progress, style]}
            testID={testID}
        >
            <View style={styles.row}>
                <View
                    style={[styles.track, { height: SIZE_HEIGHT[size], backgroundColor: theme.colors.bg }]}
                    onLayout={onTrackLayout}
                    testID={testID ? `${testID}-track` : undefined}
                >
                    {/* 奶油色波点底（对应 CSS 的 background 简写），铺在 fill 下面 */}
                    <BackgroundLayer testID={testID ? `${testID}-track-pattern` : undefined}>
                        <BackgroundPatternLayer
                            spec={
                                mode === 'dark' ? { ...TRACK_PATTERN, base: theme.colors.bgSecondary } : TRACK_PATTERN
                            }
                        />
                    </BackgroundLayer>

                    <Animated.View
                        style={[
                            styles.fill,
                            {
                                width: fillWidth,
                                backgroundColor: fillColor ?? theme.colors.primary,
                            },
                            indeterminate && styles.indeterminateFill,
                        ]}
                        testID={testID ? `${testID}-fill` : undefined}
                    >
                        {trackWidth > 0 && !fillColor && (
                            // 图片固定为**整条轨道**的宽度（高度按 16:9 算，所以只露出上部），
                            // fill 自身 overflow: hidden 按进度宽度裁掉右侧 = 从左揭开。
                            // Web 在测量到宽度前用的是 `100% auto`；RN 这里那一帧不画图
                            // （见本文件顶部的「与上游 Web 版的差异」第 3 条）。
                            <View style={styles.fillImage} pointerEvents="none" aria-hidden>
                                <Scene width={trackWidth} height={trackWidth / SCENE_ASPECT_RATIO} />
                            </View>
                        )}
                    </Animated.View>
                </View>

                {showInfo && (
                    // Web 的 `.info` 是一个 div，同时承担盒子样式与文字样式；RN 里文字样式
                    // 必须在 <Text> 上，所以拆成「盒子 View + Text」两层。
                    <View style={styles.infoBox} testID={testID ? `${testID}-info` : undefined}>
                        {isTextual(renderedInfo) ? (
                            <Text
                                numberOfLines={1}
                                style={[styles.infoText, mode === 'dark' && { color: theme.colors.textSecondary }]}
                            >
                                {renderedInfo}
                            </Text>
                        ) : (
                            // infoFormat 返回非文本节点时原样渲染（Web 的 div 能放任意内容）
                            renderedInfo
                        )}
                    </View>
                )}
            </View>
        </View>
    );
};

Progress.displayName = 'Progress';

const styles = StyleSheet.create({
    indeterminateFill: { width: '30%' },
    progress: {
        // `.progress { display: flex; align-items: center; width: 100% }`
        // CSS 的 display:flex 默认就是 row，RN 的 View 默认是 column，所以要显式写。
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        // CSS 的 `user-select: none` / `vertical-align: middle` 在 RN 没有对应物：
        // RN 文本默认不可选中，且 RN 没有 inline 布局（也就没有 vertical-align）。
    },
    row: {
        // `.row { display: flex; align-items: center; gap: 12px; width: 100%; flex: 1 1 auto; min-width: 0 }`
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md, // Less 里是硬编码的 12px，与 @spacing-md 同值
        width: '100%',
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
        minWidth: 0, // CSS 里 flex 子项默认 min-width:auto，RN 的默认值本来就是 0
    },
    track: {
        // Web 的 `.track` 是 `position: relative`；RN(Yoga) 里绝对定位子节点本来就相对父节点
        // 定位，所以这行是照抄过来的**空操作**，留着只为和 Less 对齐。
        position: 'relative',
        // `.track { flex: 1 1 auto; width: 100%; min-width: 80px }`：在 row 容器里
        // 「占满剩余空间、但至少 80px」，RN 里 `flex: 1` + `minWidth` 等价
        flex: 1,
        minWidth: 80,
        backgroundColor: colors.bg, // @track-bg: #f8f8f0 —— 与 @bg-color 同值，用 token
        // `.track { box-shadow: inset 0 2px 4px @track-inner }`
        boxShadow: 'inset 0 2px 4px rgba(114, 93, 66, 0.08)',
        overflow: 'hidden',
        borderRadius: 999,
        // ⚠️ `.track.size-small { border-width: 1.5px }` 在 Web 上是**死代码**：
        // `.track` 里的 `border: 1px solid @track-border` 被注释掉了，没有 border-style
        // 就没有可见边框。RN 里只写 borderWidth 会画出一条黑色边框（颜色默认黑），
        // 所以这里**刻意不写**，保持与 Web 的实际观感一致。
    },
    fill: {
        // `.fill { position: absolute; top: 0; left: 0; bottom: 0; width: 0; border-radius: 999px; overflow: hidden }`
        // width 由 Animated 插值成 `${percent}%` 驱动（替代 CSS transition）
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        borderRadius: 999,
        overflow: 'hidden',
    },
    fillImage: {
        // 图片锚在 fill 的左上角（CSS `background-position: left top`）
        position: 'absolute',
        top: 0,
        left: 0,
    },
    infoBox: {
        // `.info { flex-shrink: 0 }` + `.info.right { min-width: 44px; text-align: right }`
        flexShrink: 0,
        minWidth: 44,
        alignItems: 'flex-end', // 容器版的 text-align: right
    },
    infoText: {
        // `.info { font-weight: 700; color: @text-on-track; letter-spacing: 0.02em; white-space: nowrap }`
        fontWeight: '700',
        color: '#725d42', // @text-on-track（tokens 里没有对应项，逐字照抄）
        // `.progress { line-height: 1 }`；Web 没给 .progress 设 font-size，所以继承浏览器
        // 默认的 16px —— 对应 tokens 的 @font-size-lg
        fontSize: fontSize.lg,
        lineHeight: fontSize.lg,
        letterSpacing: 0.02 * fontSize.lg, // CSS 的 0.02em
        // white-space: nowrap → <Text numberOfLines={1}>
    },
});
