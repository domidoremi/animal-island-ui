import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CoffeeBreak, ForestGrove, StarryCamp, SweetCorner, type SceneImageProps } from '../../assets/image/rn';
import { colors, fontSize, spacing } from '../../theme/tokens';
import Svg, { Circle, Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { BackgroundLayer } from '../Background/patterns';
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

const TRACK_BORDER_WIDTH = 2;

const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

export const Progress: React.FC<ProgressProps> = ({
    percent,
    size = 'middle',
    variant,
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
    const artworkId = `animal-progress-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const patternId = `${artworkId}-dots`;
    const gradientId = `${artworkId}-fill`;
    const safePercent = useMemo(() => {
        if (typeof percent !== 'number' || Number.isNaN(percent)) return 0;
        return Math.max(0, Math.min(100, percent));
    }, [percent]);

    const renderedInfo = useMemo(() => {
        if (infoFormat) return infoFormat(safePercent);
        if (indeterminate) return '';
        return `${Math.round(safePercent)}%`;
    }, [infoFormat, safePercent, indeterminate]);

    const [trackWidth, setTrackWidth] = useState(0);
    const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
        // Web clientWidth excludes the outline; RN onLayout includes it.
        setTrackWidth(Math.max(0, e.nativeEvent.layout.width - 2 * TRACK_BORDER_WIDTH));
    }, []);

    const Scene = variant ? VARIANT_IMAGE[variant] : null;
    const completed = !indeterminate && Math.round(safePercent) === 100;
    const defaultPalette = mode === 'light' && theme.colors.primary === colors.primary;
    const gradientColors = completed
        ? [defaultPalette ? '#7fe0d5' : theme.colors.primaryHover, defaultPalette ? '#3dd4c6' : theme.colors.primary]
        : [theme.colors.primaryHover, theme.colors.primary, defaultPalette ? '#14b6a8' : theme.colors.primaryActive];
    const durationMs = Number.isFinite(duration) && duration > 0 ? Math.min(duration * 1000, 2147483647) : 0;

    const reduceMotion = useReduceMotion();
    const fillPercent = useRef(new Animated.Value(safePercent)).current;
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            fillPercent.setValue(safePercent);
            return undefined;
        }
        if (durationMs === 0 || reduceMotion || reducedMotion) {
            fillPercent.setValue(safePercent);
            return undefined;
        }
        const animation = Animated.timing(fillPercent, {
            toValue: safePercent,
            duration: durationMs,
            easing: EASE,
            useNativeDriver: false, // `width` 只能在 JS 侧算
        });
        animation.start();
        return () => animation.stop();
    }, [safePercent, durationMs, reduceMotion, reducedMotion, fillPercent]);

    // 0–100 的数值插值成百分比宽度字符串
    const fillWidth = fillPercent.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

    const ariaValueText = typeof renderedInfo === 'string' ? renderedInfo : undefined;

    return (
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
                    style={[
                        styles.track,
                        {
                            height: SIZE_HEIGHT[size],
                            backgroundColor: theme.colors.bg,
                            borderColor:
                                mode === 'light' && theme.colors.border === colors.border
                                    ? '#e2d6bd'
                                    : theme.colors.border,
                        },
                    ]}
                    onLayout={onTrackLayout}
                    testID={testID ? `${testID}-track` : undefined}
                >
                    <BackgroundLayer testID={testID ? `${testID}-track-pattern` : undefined}>
                        <Svg width="100%" height="100%">
                            <Defs>
                                <Pattern id={patternId} width={14} height={14} patternUnits="userSpaceOnUse">
                                    {[0, 14].map((cx) =>
                                        [0, 14].map((cy) => (
                                            <Circle
                                                key={`${cx}-${cy}`}
                                                cx={cx}
                                                cy={cy}
                                                r={1.5}
                                                fill="rgba(196, 184, 158, 0.1)"
                                            />
                                        ))
                                    )}
                                </Pattern>
                            </Defs>
                            <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
                        </Svg>
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
                        {!Scene && !fillColor && (
                            <BackgroundLayer testID={testID ? `${testID}-fill-gradient` : undefined}>
                                <Svg width="100%" height="100%">
                                    <Defs>
                                        <LinearGradient id={gradientId} x1={0} y1={0} x2={0} y2={1}>
                                            {gradientColors.map((color, index) => (
                                                <Stop
                                                    key={index}
                                                    offset={completed ? index : [0, 0.6, 1][index]}
                                                    stopColor={color}
                                                />
                                            ))}
                                        </LinearGradient>
                                    </Defs>
                                    <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
                                </Svg>
                            </BackgroundLayer>
                        )}
                        {Scene && trackWidth > 0 && !fillColor && (
                            // Native scenes need a measured aspect ratio; the first frame uses the fill color.
                            <View style={styles.fillImage} pointerEvents="none" aria-hidden>
                                <Scene width={trackWidth} height={trackWidth / SCENE_ASPECT_RATIO} />
                            </View>
                        )}
                        <View style={styles.fillHighlight} pointerEvents="none" aria-hidden />
                    </Animated.View>
                </View>

                {showInfo && (
                    <View style={styles.infoBox} testID={testID ? `${testID}-info` : undefined}>
                        {isTextual(renderedInfo) ? (
                            <Text
                                numberOfLines={1}
                                style={[styles.infoText, mode === 'dark' && { color: theme.colors.textSecondary }]}
                            >
                                {renderedInfo}
                            </Text>
                        ) : (
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
        overflow: 'hidden',
        borderRadius: 999,
        borderWidth: TRACK_BORDER_WIDTH,
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
    fillHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
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
