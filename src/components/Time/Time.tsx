import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { boxShadow, colors, duration, fontSize, spacing } from '../../theme/tokens';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const pad = (value: number) => String(value).padStart(2, '0');

/** @motion-ease: cubic-bezier(0.4, 0, 0.2, 1)（与 Collapse / TimePicker 同一写法） */
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * `.clock` 的字号。上游 Less 硬编码 44px（`font-size: 44px`），
 * 与 `src/theme/tokens.ts` 的 `fontSize`（12 / 14 / 16）无关，故照搬硬编码值。
 */
const CLOCK_FONT_SIZE = 44;

/** 冒号闪烁的半周期（`@keyframes animal-time-blink` 的 1s / 2，step-end） */
const BLINK_HALF_PERIOD = 500;

export interface TimeProps {
    /**
     * 自定义样式（作用于最外层容器）。
     *
     * ⚠️ 上游 `TimeProps = React.HTMLAttributes<HTMLDivElement>`，靠 `{...rest}`
     * 把任意 DOM 属性透传到根 div 上；RN 没有 `div`，也没有「任意属性透传」的概念，
     * 所以这里**只列出有 RN 对应的那几个**（见下方各字段），其余（`id` 以外的
     * HTML 属性、事件回调等）一律丢弃。
     */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /** 根节点 id（对应 Web 的 `id`，RN 里叫 `nativeID`） */
    nativeID?: string;
    /** 可访问名（对应 Web 的 `aria-label`） */
    'aria-label'?: string;
    /** 关联外部可见 label 的 id（对应 Web 的 `aria-labelledby`） */
    'aria-labelledby'?: string;
}

/**
 * 实时时钟卡片：
 * 上方 HH:MM 时钟每秒刷新，冒号按秒闪烁；
 * 下方主色胶囊显示星期与月日，挂载时淡入。
 *
 * 与 Web 版的差异（逐条见下方注释）：
 *   1. `window.setInterval` → `setInterval`（RN 没有 `window`）。
 *   2. 两个 `@keyframes` → `Animated`（`useNativeDriver: true`）。
 *   3. `text-transform: uppercase` → `textTransform: 'uppercase'`（RN 支持，底层字符串不变）。
 *   4. `white-space: nowrap` → `numberOfLines={1}`（RN 的等价物会**加省略号**，
 *      Web 是溢出而不是截断 —— 见 `.clock` 的注释）。
 *   5. 根节点显式 `accessible`：Web 的 `<div role="timer">` 在无障碍树里**就是一个节点**，
 *      RN 里要让 `getByRole('timer')` / 屏幕阅读器把整张卡片当成一个节点，
 *      必须显式 `accessible`（RNTL 的 `isAccessibilityElement` 对非 Text 宿主
 *      只在显式设置 `accessible` 时才返回 true）。这里子节点全是 Text、无交互内容，
 *      合并成一个节点是符合 `role="timer"` 语义的（对比 Collapse 刻意不设 `accessible`）。
 */
export const Time: React.FC<TimeProps> = ({
    style,
    testID,
    nativeID,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
}) => {
    const [now, setNow] = useState(() => new Date());

    // Web: `const timer = window.setInterval(...)`；RN 无 window，直接用全局 setInterval。
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1_000);
        return () => clearInterval(timer);
    }, []);

    // ---------- 挂载淡入：`@keyframes animal-time-fade-in`，0.35s（= @motion-duration-slow） ----------
    // opacity 是原生可驱动属性，用 useNativeDriver: true。测试里它不产生 JS 帧，
    // 因此不会污染 act()（见 RN-PORT.md「JS 驱动的 Animated 需要假定时器」）。
    const fade = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const animation = Animated.timing(fade, {
            toValue: 1,
            duration: duration.slow,
            easing: EASE,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [fade]);

    // ---------- 冒号闪烁：`@keyframes animal-time-blink { 50% { opacity: 0 } }`，1s step-end infinite ----------
    // step-end 的含义是「跳变，不插值」：0～0.5s 保持 1，0.5s 瞬间变 0，1s 瞬间变回 1。
    // 所以用两段 duration: 0 的 timing（各延迟 500ms）复刻，而不是 duration: 500 的渐变 ——
    // 后者会变成淡入淡出，与 step-end 的硬切不一致。
    const blink = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(blink, {
                    toValue: 0,
                    duration: 0,
                    delay: BLINK_HALF_PERIOD,
                    useNativeDriver: true,
                }),
                Animated.timing(blink, {
                    toValue: 1,
                    duration: 0,
                    delay: BLINK_HALF_PERIOD,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [blink]);

    return (
        <Animated.View
            // Web: <div role="timer" aria-live="off">。RN 0.87 的 role / aria-live 同名支持。
            accessible
            role="timer"
            aria-live="off"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            nativeID={nativeID}
            style={[styles.time, { opacity: fade }, style]}
            testID={testID}
        >
            {/*
             * Web: <div className={styles.clock}>{pad(h)}<span className={styles.colon}>:</span>{pad(m)}</div>
             * 数字与冒号在**同一段文本流**里，由字体基线对齐 —— RN 用嵌套 <Text> 复刻
             * （而不是 flexDirection: 'row' 三个 Text，那样基线要靠 alignItems: 'baseline' 手动对齐）。
             */}
            <Text style={styles.clock} numberOfLines={1}>
                {pad(now.getHours())}
                <Animated.Text style={[styles.colon, { opacity: blink }]}>:</Animated.Text>
                {pad(now.getMinutes())}
            </Text>
            <View style={styles.date}>
                {/* Web: <span className={styles.weekday}>；大小写由 CSS text-transform 控制 */}
                <Text style={[styles.dateText, styles.weekday]} numberOfLines={1}>
                    {WEEKDAYS[now.getDay()]}
                </Text>
                {/* Web: <span className={styles.dot} aria-hidden="true">·</span> */}
                <Text style={[styles.dateText, styles.dot]} aria-hidden>
                    ·
                </Text>
                <Text style={[styles.dateText, styles.monthDay]} numberOfLines={1}>
                    {MONTHS[now.getMonth()]} {now.getDate()}
                </Text>
            </View>
        </Animated.View>
    );
};

Time.displayName = 'Time';

/**
 * 对应 Web 的 `time.module.less`。映射说明：
 *   - `var(--animal-*, fallback)` 全部走 `src/theme/tokens.ts`（CSS 变量就是 Less 变量的别名，
 *     见 `src/styles/themes/default.less`）。注意 `.time` 的 `background: var(--animal-bg-color, #fff)`
 *     实际值是 `@bg-color: #f8f8f0`（`#fff` 只是 CSS 变量缺失时的兜底），所以用 `colors.bg`。
 *   - `.time` 的 `border-radius: 20px` / `padding: 20px 32px 15px 32px` 与 `.clock` 的 44px
 *     在 Less 里都是**硬编码**，没有对应 token，故照搬字面量。
 *   - `@font-family` 是 Nunito + Noto Sans SC 的字体栈，RN 不支持字体栈且 woff2 不可用
 *     （见 tokens.ts 的 `fontFamily`），与 Button / Divider / TimePicker 一样**不设置** family。
 */
const styles = StyleSheet.create({
    // .time { display: inline-flex; flex-direction: column; align-items: center; gap: 12px; ... }
    // RN 的 View 默认就是 column；inline-flex 用 alignSelf: 'flex-start' 复刻
    // （width: fit-content 同义）。
    time: {
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: spacing.md, // var(--animal-spacing-md, 12px)
        paddingTop: 20, // padding: 20px 32px 15px 32px（硬编码）
        paddingBottom: 15,
        paddingHorizontal: 32,
        borderRadius: 20, // 硬编码 20px（radius token 只有 16 / 18 / 24）
        backgroundColor: colors.bg, // var(--animal-bg-color, #fff) → @bg-color #f8f8f0
        // var(--animal-shadow-sm, ...) → @shadow-sm；注意 Less 的兜底值少写了一个 spread 0，
        // 以 token（即 @shadow-sm）为准。⚠️ Android 需要新架构，旧架构下阴影被忽略。
        boxShadow: boxShadow.sm,
    },
    clock: {
        color: colors.text, // var(--animal-text-color, #794f27)
        fontWeight: '900', // font-weight: 900
        fontSize: CLOCK_FONT_SIZE, // font-size: 44px（硬编码）
        fontVariant: ['tabular-nums'], // font-variant-numeric: tabular-nums
        letterSpacing: 1, // letter-spacing: 1px
        lineHeight: CLOCK_FONT_SIZE, // line-height: 1
        // white-space: nowrap → numberOfLines={1}。差异：RN 在放不下时加省略号，
        // Web 是溢出容器。卡片本身 alignSelf: 'flex-start' 按内容撑开，正常不会触发。
    },
    colon: {
        // transform: translateY(-0.11em) —— em 相对 .clock 的 44px，即 -4.84px。
        transform: [{ translateY: -0.11 * CLOCK_FONT_SIZE }],
    },
    // .date { display: inline-flex; align-items: center; gap: 4px; padding: 4px 14px;
    //         border-radius: 999px; background: ...; font-size/weight/color 由子节点继承 }
    date: {
        alignSelf: 'flex-start', // display: inline-flex
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs, // var(--animal-spacing-xs, 4px)
        paddingVertical: 4,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: colors.primaryBg, // var(--animal-primary-color-bg, #e6f9f6)
    },
    // CSS 里 .date 的 font-size / font-weight / color 会**继承**给三个 span；
    // RN 没有继承，所以抽一份共用的 dateText，子节点各自再叠加覆盖项。
    dateText: {
        fontSize: fontSize.sm, // var(--animal-font-size-sm, 12px)
        fontWeight: '700',
        color: colors.textSecondary, // var(--animal-text-color-secondary, #9f927d)
    },
    weekday: {
        color: colors.primary, // var(--animal-primary-color, #19c8b9)
        fontWeight: '800',
        textTransform: 'uppercase', // text-transform: uppercase
        letterSpacing: 1,
    },
    dot: {
        color: colors.textDisabled, // var(--animal-text-color-disabled, #c4b89e)
    },
    monthDay: {
        fontVariant: ['tabular-nums'],
    },
});
