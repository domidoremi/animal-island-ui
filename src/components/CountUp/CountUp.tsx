import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './count-up.module.less';

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

export interface CountUpProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'prefix' | 'children'> {
    /** 起始值，默认 0 */
    start?: number;
    /** 目标值（比如本局总分） */
    end: number;
    /** 动画时长（秒），默认 2；传 0 直接显示目标值 */
    duration?: number;
    /** 是否正在计数，默认 false。改为 false 会暂停并保留当前值，再改回 true 从暂停处继续 */
    isCounting?: boolean;
    /** 小数位数，默认取 start / end 中较大的小数位数 */
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
    const text = String(value);
    const dot = text.indexOf('.');
    return dot === -1 ? 0 : text.length - dot - 1;
};

/** 按千分位分组，separator 为空时原样返回 */
const groupThousands = (text: string, separator: string): string =>
    separator === '' ? text : text.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

/** 默认格式化：四舍五入到 decimalPlaces 位小数，再补千分位与小数点符号 */
const formatNumber = (value: number, decimalPlaces: number, decimalSeparator: string, thousandsSeparator: string) => {
    if (decimalPlaces <= 0) {
        return groupThousands(String(Math.round(value)), thousandsSeparator);
    }
    const [integer, fraction] = value.toFixed(decimalPlaces).split('.');
    return `${groupThousands(integer, thousandsSeparator)}${decimalSeparator}${fraction}`;
};

/** 庆祝动效的总时长（ms），需略大于 CSS 动画时长，用于自动摘掉动画类以便下次重播 */
const CELEBRATE_DURATION = 900;

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
    className,
    ...rest
}) => {
    const places = decimalPlaces ?? Math.max(decimalCount(start), decimalCount(end));

    const [display, setDisplay] = useState(start);
    const [counting, setCounting] = useState(false);
    const [celebrating, setCelebrating] = useState(false);
    /** 递增即重启动画：reset / onComplete 重播都靠它触发主 effect */
    const [runToken, setRunToken] = useState(0);

    const frameRef = useRef<number | null>(null);
    const repeatTimerRef = useRef<number | null>(null);
    const celebrateTimerRef = useRef<number | null>(null);
    const elapsedRef = useRef(0);
    const lastTimestampRef = useRef<number | null>(null);
    const completedRef = useRef(false);
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
                window.clearTimeout(repeatTimerRef.current);
                repeatTimerRef.current = null;
            }
        };
        /** 只在渲染文案真的变化时 setState，长时长动画因此不会每帧重建 DOM */
        const commit = (next: number, force = false) => {
            const rendered = formatRef.current(next);
            const key = typeof rendered === 'string' || typeof rendered === 'number' ? String(rendered) : null;
            if (!force && key !== null && key === formattedRef.current) return;
            formattedRef.current = key;
            setDisplay(next);
        };

        const finish = (elapsedMs: number) => {
            completedRef.current = true;
            lastTimestampRef.current = null;
            setCounting(false);
            commit(end, true);

            if (celebrateRef.current) {
                setCelebrating(true);
                if (celebrateTimerRef.current !== null) {
                    window.clearTimeout(celebrateTimerRef.current);
                }
                celebrateTimerRef.current = window.setTimeout(() => {
                    celebrateTimerRef.current = null;
                    setCelebrating(false);
                }, CELEBRATE_DURATION);
            }

            const result = onCompleteRef.current?.(elapsedMs / 1_000);
            if (result && result.shouldRepeat) {
                clearRepeat();
                repeatTimerRef.current = window.setTimeout(
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
            const intervalMs = Math.max(0, updateIntervalRef.current) * 1_000;
            // updateInterval > 0 时按间隔取值（时间轴量化），与 use-count-up 一致
            const quantized = intervalMs > 0 ? Math.floor(elapsed / intervalMs) * intervalMs : elapsed;
            const done = elapsed >= totalMs;
            const progress = done ? 1 : Math.min(1, Math.max(0, quantized / totalMs));
            const next = done ? end : start + (end - start) * resolveEasing(easingRef.current)(progress);

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
            commit(typeof pendingStart === 'number' ? pendingStart : start, true);
        }
        pendingStartRef.current = undefined;

        if (!isCounting || completedRef.current) {
            setCounting(false);
            return undefined;
        }

        // 环境不支持 rAF（老浏览器 / 非可视化环境）时退化为静态展示起始值，不抛错
        if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
            setCounting(false);
            return undefined;
        }

        // duration = 0 直接到位，不必等一帧；onComplete 仍可能排下重播计时器，所以同样要交出 cleanup
        if (totalMs === 0) {
            finish(0);
            return () => {
                clearFrame();
                clearRepeat();
            };
        }

        lastTimestampRef.current = null;
        setCounting(true);
        frameRef.current = requestAnimationFrame(step);

        return () => {
            clearFrame();
            clearRepeat();
        };
    }, [isCounting, start, end, duration, runToken]);

    // 卸载时清掉庆祝计时器，避免对已卸载组件 setState
    useEffect(
        () => () => {
            if (celebrateTimerRef.current !== null) {
                window.clearTimeout(celebrateTimerRef.current);
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
    const classNames = [
        styles['count-up'],
        styles[size],
        styles[variant],
        bordered && styles.bordered,
        celebrating && styles.celebrating,
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classNames} role="status" {...rest}>
            <span className={styles.plateWrap}>
                {celebrating && (
                    <span className={styles.effects} aria-hidden="true">
                        <span className={styles.ring} />
                        <span className={styles.ring} />
                        <span className={styles.sparkles}>
                            <span className={styles.sparkle} />
                            <span className={styles.sparkle} />
                            <span className={styles.sparkle} />
                            <span className={styles.sparkle} />
                        </span>
                        {celebrateText !== undefined && (
                            <span className={styles.badgeWrap}>
                                <span className={styles.badge}>{celebrateText}</span>
                            </span>
                        )}
                    </span>
                )}
                <span className={styles.plate} aria-hidden="true">
                    {prefix !== undefined && <span className={styles.affix}>{prefix}</span>}
                    <span className={styles.number}>{content}</span>
                    {suffix !== undefined && <span className={styles.affix}>{suffix}</span>}
                </span>
            </span>
            <span className={styles.srOnly}>{readable}</span>
        </div>
    );
};

CountUp.displayName = 'CountUp';
