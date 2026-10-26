import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export type CountUpSize = 'small' | 'middle' | 'large';
export type CountUpVariant = 'default' | 'island';

/** 内置缓动曲线名 */
export type CountUpEasingName = 'linear' | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic' | 'easeOutExpo';
/** 自定义缓动：入参是 0→1 的线性进度，返回 0→1 的缓动进度 */
export type CountUpEasingFunction = (progress: number) => number;
export type CountUpEasing = CountUpEasingName | CountUpEasingFunction;

/** onComplete 返回值：返回 { shouldRepeat: true } 可在 delay 秒后自动重播 */
export interface CountUpCompleteResult {
    /** 是否重播动画 */
    shouldRepeat?: boolean;
    /** 重播前的等待时间（秒），默认 0 */
    delay?: number;
    /** 重播时的起始值，默认回到 start */
    newStartAt?: number;
}

export interface CountUpCelebrateOptions {
    /** 贴纸文案，任意内容；不传则不渲染贴纸 */
    text?: React.ReactNode;
}

export interface CountUpRenderState {
    /** 当前展示值 */
    value: number;
    /** 重置到起始值并重新播放 */
    reset: (newStartAt?: number) => void;
}

export interface CountUpProps extends Omit<ViewProps, 'children'> {
    /** 起始值，默认 0 */
    start?: number;
    /** 目标值（比如本局总分） */
    end: number;
    /** 动画时长（秒），默认 2；传 0 直接显示目标值 */
    duration?: number;
    /** 是否正在计数，默认 false。改为 false 会暂停并保留当前值，再改回 true 从暂停处继续 */
    isCounting?: boolean;
    /** Decimal places (0-100, truncated); defaults to the greater start/end precision. */
    decimalPlaces?: number;
    /** 小数点符号，默认 '.' */
    decimalSeparator?: string;
    /** 千分位符号，默认 ''（不分组） */
    thousandsSeparator?: string;
    /** 缓动曲线，默认 'easeOutCubic' */
    easing?: CountUpEasing;
    /** 完全接管数字格式化，优先级高于 decimalPlaces / decimalSeparator / thousandsSeparator */
    formatter?: (value: number) => React.ReactNode;
    /** 展示值刷新间隔（秒），0 表示每帧刷新，默认 0 */
    updateInterval?: number;
    /** 数字前缀，如 '¥' */
    prefix?: React.ReactNode;
    /** 数字后缀，如 '分' */
    suffix?: React.ReactNode;
    /** 尺寸 */
    size?: CountUpSize;
    /** 显示风格 */
    variant?: CountUpVariant;
    /** 数字块是否带边框，默认无 */
    bordered?: boolean;
    /** 计数结束后的庆祝动效（数字弹跳 + 光环 + 星芒），传 text 会额外弹出一张贴纸，默认关闭 */
    celebrate?: boolean | CountUpCelebrateOptions;
    /** 展示值更新时触发（每帧触发，与 updateInterval 无关） */
    onUpdate?: (value: number) => void;
    /** 计数结束时触发，可返回 CountUpCompleteResult 以重播 */
    onComplete?: (elapsedTime: number) => void | CountUpCompleteResult;
    /**
     * 渲染函数，可完全接管数字渲染，参数为 { value, reset }。
     * 注意：数字块整体对辅助技术隐藏（aria-hidden），这里只放展示性内容，可聚焦元素请放到组件外面
     */
    children?: (state: CountUpRenderState) => React.ReactNode;
}

const EASINGS: Record<CountUpEasingName, CountUpEasingFunction> = {
    linear: (progress) => progress,
    easeInCubic: (progress) => progress * progress * progress,
    easeOutCubic: (progress) => 1 - (1 - progress) ** 3,
    easeInOutCubic: (progress) =>
        progress < 0.5 ? 4 * progress * progress * progress : 1 - (-2 * progress + 2) ** 3 / 2,
    easeOutExpo: (progress) => (progress >= 1 ? 1 : 1 - 2 ** (-10 * progress)),
};

/** 未知缓动名回退到 easeOutCubic，避免 JS 调用方传错值时崩掉动画 */
const resolveEasing = (easing: CountUpEasing): CountUpEasingFunction => {
    if (typeof easing === 'function') return easing;
    const named = (EASINGS as Record<string, CountUpEasingFunction>)[easing];
    return named ?? EASINGS.easeOutCubic;
};

/** 数值的小数位数（用于推导默认 decimalPlaces） */
const decimalCount = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    const [coefficient, exponent = '0'] = String(value).toLowerCase().split('e');
    return Math.max(0, (coefficient.split('.')[1]?.length ?? 0) - Number(exponent));
};

const expandExponent = (value: number): string => {
    const [coefficient, exponent] = String(value).toLowerCase().split('e');
    if (exponent === undefined) return coefficient;
    const sign = coefficient.startsWith('-') ? '-' : '';
    const [integer, fraction = ''] = coefficient.replace(/^-/, '').split('.');
    const digits = integer + fraction;
    const point = integer.length + Number(exponent);
    if (point <= 0) return sign + '0.' + '0'.repeat(-point) + digits;
    if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
    return sign + digits.slice(0, point) + '.' + digits.slice(point);
};

/** 按千分位分组，separator 为空时原样返回 */
const groupThousands = (text: string, separator: string): string =>
    separator === '' ? text : text.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

/** 默认格式化：四舍五入到 decimalPlaces 位小数，再补千分位与小数点符号 */
const formatNumber = (value: number, decimalPlaces: number, decimalSeparator: string, thousandsSeparator: string) => {
    if (!Number.isFinite(value)) return String(value);
    const fixed =
        decimalPlaces === 0
            ? expandExponent(Math.round(value))
            : Math.abs(value) >= 1e21
              ? expandExponent(value)
              : value.toFixed(decimalPlaces);
    const [integer, fraction = ''] = fixed.split('.');
    return (
        groupThousands(integer, thousandsSeparator) +
        (decimalPlaces > 0 ? decimalSeparator + fraction.padEnd(decimalPlaces, '0') : '')
    );
};

const CELEBRATE_DURATION = 900;
const CELEBRATE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const SPARKLES = [
    { left: 0, top: 0, x: -16, y: -14, delay: 0 },
    { right: 0, top: 0, x: 16, y: -12, delay: 60 },
    { left: 0, bottom: 0, x: -16, y: 14, delay: 120 },
    { right: 0, bottom: 0, x: 16, y: 14, delay: 180 },
] as const;

const Celebration: React.FC<{ text?: React.ReactNode; testID?: string }> = ({ text, testID }) => {
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const animation = Animated.timing(progress, {
            toValue: 1,
            duration: CELEBRATE_DURATION,
            easing: Easing.linear,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [progress]);
    const phase = (delay: number, duration: number) =>
        progress.interpolate({
            inputRange: [delay / CELEBRATE_DURATION, (delay + duration) / CELEBRATE_DURATION],
            outputRange: [0, 1],
            extrapolate: 'clamp',
        });
    const sticker = phase(0, 500);
    return (
        <View
            pointerEvents="none"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={StyleSheet.absoluteFill}
            testID={testID}
        >
            {[0, 120].map((delay, index) => {
                const ring = phase(delay, 700);
                return (
                    <Animated.View
                        key={delay}
                        testID={testID ? `${testID}-ring-${index}` : undefined}
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                borderWidth: 2,
                                borderColor: index ? 'rgba(255, 204, 0, 0.7)' : 'rgba(247, 205, 103, 0.85)',
                                borderRadius: 14,
                                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                            },
                        ]}
                    />
                );
            })}
            {SPARKLES.map(({ x, y, delay, ...position }, index) => {
                const sparkle = phase(delay, 720);
                return (
                    <Animated.View
                        key={index}
                        testID={testID ? `${testID}-sparkle-${index}` : undefined}
                        style={{
                            position: 'absolute',
                            width: 10,
                            height: 10,
                            ...position,
                            opacity: sparkle.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 0] }),
                            transform: [
                                { translateX: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                                { translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
                                { scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
                                { rotate: sparkle.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) },
                            ],
                        }}
                    >
                        <Svg width={10} height={10} viewBox="0 0 100 100" accessible={false}>
                            <Path d="M50 0 L61 39 L100 50 L61 61 L50 100 L39 61 L0 50 L39 39 Z" fill="#f7cd67" />
                        </Svg>
                    </Animated.View>
                );
            })}
            {text !== undefined ? (
                <Animated.View
                    style={[
                        styles.sticker,
                        {
                            opacity: sticker.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 1, 1] }),
                            transform: [
                                {
                                    scale: sticker.interpolate({
                                        inputRange: [0, 0.55, 0.76, 1],
                                        outputRange: [0.4, 1.12, 0.96, 1],
                                    }),
                                },
                                {
                                    rotate: sticker.interpolate({
                                        inputRange: [0, 0.55, 0.76, 1],
                                        outputRange: ['-8deg', '3deg', '-2deg', '0deg'],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    {typeof text === 'string' || typeof text === 'number' ? (
                        <Text style={styles.stickerText}>{text}</Text>
                    ) : (
                        text
                    )}
                </Animated.View>
            ) : null}
        </View>
    );
};

export const CountUp: React.FC<CountUpProps> = ({
    start = 0,
    end,
    duration = 2,
    isCounting = false,
    decimalPlaces,
    decimalSeparator = '.',
    thousandsSeparator = '',
    easing = 'easeOutCubic',
    formatter,
    updateInterval = 0,
    prefix,
    suffix,
    size = 'middle',
    variant = 'default',
    bordered = false,
    celebrate = false,
    onUpdate,
    onComplete,
    children,
    style,
    testID,
    ...rest
}) => {
    const { theme, reducedMotion } = useTheme();
    const bounce = useRef(new Animated.Value(1)).current;
    const inferredPlaces = Math.max(decimalCount(start), decimalCount(end));
    const places = Math.max(
        0,
        Math.min(
            100,
            Math.trunc(decimalPlaces !== undefined && Number.isFinite(decimalPlaces) ? decimalPlaces : inferredPlaces)
        )
    );

    const [display, setDisplay] = useState(start);
    const [counting, setCounting] = useState(false);
    const [celebrating, setCelebrating] = useState(false);
    /** 递增即重启动画：reset / onComplete 重播都靠它触发主 effect */
    const [runToken, setRunToken] = useState(0);

    const frameRef = useRef<number | null>(null);
    const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const elapsedRef = useRef(0);
    const lastTimestampRef = useRef<number | null>(null);
    const completedRef = useRef(false);
    const activeStartRef = useRef(start);
    const pendingStartRef = useRef<number | undefined>(undefined);
    /** 上一次真正渲染出来的文案，用于跳过文案没变的帧 */
    const formattedRef = useRef<string | null>(null);
    /** 已生效的 起始值|目标值|时长 组合，变化即重新开始 */
    const targetRef = useRef(`${start}|${end}|${duration}`);
    const tokenRef = useRef(0);

    // 动画循环里需要读取的最新值放 ref，避免回调引用变化导致动效重启
    const formatRef = useRef<(value: number) => React.ReactNode>(() => null);
    const easingRef = useRef(easing);
    const updateIntervalRef = useRef(updateInterval);
    const onUpdateRef = useRef(onUpdate);
    const onCompleteRef = useRef(onComplete);
    const celebrateRef = useRef(celebrate);

    formatRef.current = (value) =>
        formatter ? formatter(value) : formatNumber(value, places, decimalSeparator, thousandsSeparator);
    easingRef.current = easing;
    updateIntervalRef.current = updateInterval;
    onUpdateRef.current = onUpdate;
    onCompleteRef.current = onComplete;
    celebrateRef.current = celebrate;

    useEffect(() => {
        const clearFrame = () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
        const clearRepeat = () => {
            if (repeatTimerRef.current !== null) {
                clearTimeout(repeatTimerRef.current);
                repeatTimerRef.current = null;
            }
        };
        const commit = (next: number, force = false) => {
            const rendered = formatRef.current(next);
            const key = typeof rendered === 'string' || typeof rendered === 'number' ? String(rendered) : null;
            if (!force && key !== null && key === formattedRef.current) return;
            formattedRef.current = key;
            setDisplay(next);
        };

        const finish = (elapsedMs: number, notifyUpdate = false) => {
            completedRef.current = true;
            lastTimestampRef.current = null;
            setCounting(false);
            commit(end, true);
            if (notifyUpdate) onUpdateRef.current?.(end);

            if (celebrateRef.current && !reducedMotion) {
                setCelebrating(true);
                if (celebrateTimerRef.current !== null) {
                    clearTimeout(celebrateTimerRef.current);
                }
                celebrateTimerRef.current = setTimeout(() => {
                    celebrateTimerRef.current = null;
                    setCelebrating(false);
                }, CELEBRATE_DURATION);
            }

            const result = onCompleteRef.current?.(elapsedMs / 1_000);
            if (result && result.shouldRepeat && !reducedMotion) {
                clearRepeat();
                repeatTimerRef.current = setTimeout(
                    () => {
                        repeatTimerRef.current = null;
                        pendingStartRef.current = result.newStartAt;
                        setRunToken((token) => token + 1);
                    },
                    Math.max(0, result.delay ?? 0) * 1_000
                );
            }
        };

        const totalMs = Math.max(0, duration) * 1_000;

        const step = (timestamp: number): void => {
            frameRef.current = null;
            // 首帧只记录时间基准，保证 elapsed 从 0 开始
            if (lastTimestampRef.current === null) {
                lastTimestampRef.current = timestamp;
                frameRef.current = requestAnimationFrame(step);
                return;
            }

            elapsedRef.current += timestamp - lastTimestampRef.current;
            lastTimestampRef.current = timestamp;

            const elapsed = elapsedRef.current;
            const intervalMs = Number.isFinite(updateIntervalRef.current)
                ? Math.max(0, updateIntervalRef.current) * 1_000
                : 0;
            // updateInterval > 0 时按间隔取值（时间轴量化），与 use-count-up 一致
            const quantized = intervalMs > 0 ? Math.floor(elapsed / intervalMs) * intervalMs : elapsed;
            const done = elapsed >= totalMs;
            const progress = done ? 1 : Math.min(1, Math.max(0, quantized / totalMs));
            const next = done
                ? end
                : activeStartRef.current + (end - activeStartRef.current) * resolveEasing(easingRef.current)(progress);

            onUpdateRef.current?.(next);

            if (done) {
                finish(elapsed);
                return;
            }

            commit(next);
            frameRef.current = requestAnimationFrame(step);
        };

        // 起始值 / 目标值 / 时长变化时重播；reset 与 onComplete 重播通过 runToken 触发
        const target = `${start}|${end}|${duration}`;
        const restart = target !== targetRef.current || runToken !== tokenRef.current;
        const pendingStart = pendingStartRef.current;
        targetRef.current = target;
        tokenRef.current = runToken;

        if (restart) {
            elapsedRef.current = 0;
            lastTimestampRef.current = null;
            completedRef.current = false;
            setCelebrating(false);
            activeStartRef.current =
                typeof pendingStart === 'number' && Number.isFinite(pendingStart) ? pendingStart : start;
            commit(activeStartRef.current, true);
        }
        pendingStartRef.current = undefined;

        if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(duration)) {
            setCounting(false);
            return undefined;
        }

        if (!isCounting || completedRef.current) {
            setCounting(false);
            return undefined;
        }

        // duration = 0 直接到位，不必等一帧；onComplete 仍可能排下重播计时器，所以同样要交出 cleanup
        if (totalMs === 0 || reducedMotion) {
            finish(0, true);
            return () => {
                clearFrame();
                clearRepeat();
            };
        }

        if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
            setCounting(false);
            return undefined;
        }

        lastTimestampRef.current = null;
        setCounting(true);
        frameRef.current = requestAnimationFrame(step);

        return () => {
            clearFrame();
            clearRepeat();
        };
    }, [isCounting, start, end, duration, runToken, reducedMotion]);

    // 卸载时清掉庆祝计时器，避免对已卸载组件 setState
    useEffect(
        () => () => {
            if (celebrateTimerRef.current !== null) {
                clearTimeout(celebrateTimerRef.current);
            }
        },
        []
    );

    const reset = useCallback((newStartAt?: number) => {
        pendingStartRef.current = newStartAt;
        setRunToken((token) => token + 1);
    }, []);

    const content = typeof children === 'function' ? children({ value: display, reset }) : formatRef.current(display);
    // 计数过程中不打扰读屏，静止后再播报最终数值（默认数字格式，不经过 formatter）
    const readable = counting ? '' : formatNumber(display, places, decimalSeparator, thousandsSeparator);
    const celebrateText = typeof celebrate === 'object' ? celebrate.text : undefined;
    useEffect(() => {
        if (!celebrating || reducedMotion) {
            bounce.setValue(1);
            return;
        }
        const animation = Animated.sequence([
            ...[
                { toValue: 1.14, duration: 112 },
                { toValue: 0.98, duration: 126 },
                { toValue: 1.08, duration: 126 },
                { toValue: 0.99, duration: 140 },
                { toValue: 1, duration: 196 },
            ].map((step) => Animated.timing(bounce, { ...step, easing: CELEBRATE_EASING, useNativeDriver: true })),
        ]);
        animation.start();
        return () => animation.stop();
    }, [celebrating, reducedMotion, bounce]);
    const textSize = { small: 20, middle: 26, large: 34 }[size];
    const renderNode = (node: React.ReactNode, affix = false) =>
        typeof node === 'string' || typeof node === 'number' ? (
            <Text
                style={{
                    color: theme.colors.text,
                    fontWeight: affix ? '800' : '900',
                    fontSize: affix ? textSize * 0.62 : textSize,
                }}
            >
                {node}
            </Text>
        ) : (
            node
        );
    return (
        <View
            {...rest}
            testID={testID}
            accessible
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            accessibilityLabel={readable}
            style={[
                styles.countUp,
                {
                    backgroundColor: variant === 'island' ? theme.colors.bgSecondary : theme.colors.bg,
                    borderColor: theme.colors.border,
                    borderWidth: variant === 'island' ? 2 : 0,
                },
                style,
            ]}
        >
            <View style={styles.plateWrap}>
                {celebrating && !reducedMotion ? (
                    <Celebration text={celebrateText} testID={testID ? testID + '-celebration' : undefined} />
                ) : null}
                <Animated.View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={[
                        styles.plate,
                        {
                            backgroundColor: theme.colors.bg,
                            borderWidth: bordered ? 1.5 : 0,
                            borderColor: theme.colors.border,
                            transform: [{ scale: bounce }],
                        },
                    ]}
                >
                    {prefix !== undefined ? renderNode(prefix, true) : null}
                    {renderNode(content)}
                    {suffix !== undefined ? renderNode(suffix, true) : null}
                </Animated.View>
            </View>
        </View>
    );
};
CountUp.displayName = 'CountUp';
const styles = StyleSheet.create({
    countUp: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 20,
    },
    plateWrap: { position: 'relative' },
    plate: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 2,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    sticker: {
        position: 'absolute',
        bottom: '100%',
        alignSelf: 'center',
        marginBottom: 6,
        paddingVertical: 2,
        paddingHorizontal: 10,
        backgroundColor: '#f7cd67',
        borderColor: '#e0b800',
        borderWidth: 1.5,
        borderRadius: 50,
        boxShadow: '0 2px 6px rgba(61, 52, 40, 0.18)',
    },
    stickerText: { color: '#725d42', fontWeight: '800', fontSize: 13, letterSpacing: 0.52 },
});
