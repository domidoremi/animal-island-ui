import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { boxShadow, colors, spacing } from '../../theme/tokens';
import {
    COUNTDOWN_INTERVAL_MS,
    DIGIT_FACES,
    ROLL_DURATION_MS,
    SIZE_SPEC,
    colonOffsetY,
    computeRoll,
    faceHeight,
    formatRemaining,
    parseFormat,
    rollTranslateY,
    shouldWrap,
    splitRemaining,
    toTimestamp,
} from './format';

export type CountdownSize = 'small' | 'middle' | 'large';
export type CountdownVariant = 'default' | 'island';

export interface CountdownProps {
    /** 结束时间，可以传时间戳或 Date */
    value: number | Date;
    /** 输出格式，支持 DD、HH、mm、ss，默认 HH:mm:ss */
    format?: string;
    /** 倒计时前的说明内容 */
    prefix?: React.ReactNode;
    /** 尺寸 */
    size?: CountdownSize;
    /** 显示风格 */
    variant?: CountdownVariant;
    /** 数字块是否带边框，默认无 */
    bordered?: boolean;
    /** 剩余毫秒变化时触发 */
    onChange?: (remaining: number) => void;
    /** 倒计时归零时触发 */
    onFinish?: () => void;
    /**
     * 自定义样式（作用于最外层容器）。
     *
     * ⚠️ 上游 `CountdownProps extends React.HTMLAttributes<HTMLDivElement>`，靠 `{...rest}`
     * 把任意 DOM 属性透传到根 div；RN 没有 div，也没有「任意属性透传」的概念，
     * 所以这里**只列出有 RN 对应的那几个**（见下方各字段），其余一律丢弃
     * （与 `Time.tsx` 同一处理）。
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

/** `@motion-ease: cubic-bezier(0.4, 0, 0.2, 1)`（与 Collapse / Time / TimePicker 同一写法） */
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/** `.digitFace { color: #8b7355 }` / `.sep` / `.colon` 同色（Less 硬编码，无对应 token） */
const DIGIT_COLOR = '#8b7355';

/** `.prefix { color: #725d42 }`（Less 硬编码；@text-color-secondary 是 #9f927d，不是这个值） */
const PREFIX_COLOR = '#725d42';

/** `.island { background: rgb(247, 243, 223) }`（Less 硬编码） */
const ISLAND_BG = 'rgb(247, 243, 223)';

/** `.island { border: 2px dashed #d4c4a8 }` / `.bordered.island .unit { border-color: #d4c4a8 }` */
const ISLAND_BORDER = '#d4c4a8';

/** `.bordered .unit { border: 1.5px solid #d4c9b4 }` */
const BORDERED_BORDER = '#d4c9b4';

/**
 * `.unit` 的底色。
 *
 * ⚠️ **与上游的视觉差异（有意）**：Web 是
 * `background: linear-gradient(180deg, #fff 0%, #f8f8f0 100%)`。
 * RN 没有 CSS 背景渐变，`react-native-svg` 虽然能画（Background 组件就是这么做的），
 * 但那要给每个数字块再插一棵 SVG 子树 —— 一个 `HH:mm:ss` 就有 3 个块，
 * 而这两个色标（#fff → #f8f8f0）的视觉差极小。这里改用**起始色标**做纯色填充。
 * island 变体同理（#fffdf4 → #f8f8f0）。
 */
const UNIT_BG = '#fff';
const ISLAND_UNIT_BG = '#fffdf4';

/** 判断 prefix 是不是可以直接塞进 `Text` 的原始值（与 Collapse 同一手法） */
const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

interface DigitRollProps {
    /** 当前该位显示的数字（'0'-'9'） */
    digit: string;
    /** 该尺寸下的数字字号（决定面高与 `1.2em` 换算） */
    digitFontSize: number;
    /** 测试标识 */
    testID?: string;
}

/**
 * 单个数字位：纵向数字条（0-9 两轮共 20 面），滚动到当前数字。
 *
 * ⚠️ 与 Web 版的结构性差异：Web 直接改 DOM 的 `el.style.transition` /
 * `el.style.transform`，并用 `void el.offsetHeight` 强制回流让「瞬移」先生效；
 * RN 没有 DOM，改用 `Animated.Value` 驱动 `translateY`（像素值）。
 * 「该从第几面滚到第几面 / 要不要先瞬移」的算术在 `format.ts` 的 `computeRoll` 里（可单测）。
 *
 * `useNativeDriver: false`：`translateY` 本来是原生可驱动属性，这里**刻意**用 JS 驱动。
 * 理由是滚动位置本身就是这个组件最值得断言的东西，而原生驱动在测试渲染器里是空操作
 * （`__getValue()` 只会返回 `setValue` 的瞬移起点，看不到动画终点）——
 * 与 Collapse 用 JS 驱动 `height` 换取「高度可断言」是同一个取舍。
 * 代价：动画跑在 JS 线程上，20 面数字条的 350ms 位移动画（对比 Collapse 的高度动画）可接受。
 * 测试里必须配假定时器，否则逐帧更新会落到 `act()` 之外刷屏（见 `Countdown.test.tsx`）。
 */
const DigitRoll: React.FC<DigitRollProps> = ({ digit, digitFontSize, testID }) => {
    const height = faceHeight(digitFontSize);
    // pos 为 20 面数字条上的索引，pos % 10 即显示的数字（初值就是数字本身，与 Web 一致）
    const strip = useRef(new Animated.Value(rollTranslateY(Number(digit), digitFontSize))).current;
    const posRef = useRef(Number(digit));
    const prevDigitRef = useRef(digit);

    useEffect(() => {
        const { from, to, jumped } = computeRoll(posRef.current, prevDigitRef.current, digit);
        prevDigitRef.current = digit;
        posRef.current = to;

        if (from === to && !jumped) {
            // 数字没变。仍然写一次值：`size` 变化时面高会变，需要按新面高重新落位。
            strip.setValue(rollTranslateY(to, digitFontSize));
            return;
        }
        if (jumped) {
            // 跨循环回绕：先无动画瞬移到同数字的下一循环位置（视觉无变化），再向下滚
            strip.setValue(rollTranslateY(from, digitFontSize));
        }
        Animated.timing(strip, {
            toValue: rollTranslateY(to, digitFontSize),
            duration: ROLL_DURATION_MS,
            easing: EASE,
            useNativeDriver: false,
        }).start();
    }, [digit, digitFontSize, strip]);

    return (
        <View style={[styles.digitCell, { height }]} testID={testID}>
            <Animated.View style={[styles.digitStrip, { transform: [{ translateY: strip }] }]}>
                {/* `[...DIGIT_FACES, ...DIGIT_FACES]`：0-9 铺两轮，共 20 面 */}
                {[...DIGIT_FACES, ...DIGIT_FACES].map((face, i) => (
                    <Text
                        key={i}
                        style={[
                            styles.digitFace,
                            { height, lineHeight: height, fontSize: digitFontSize, fontVariant: ['tabular-nums'] },
                        ]}
                    >
                        {face}
                    </Text>
                ))}
            </Animated.View>
        </View>
    );
};

export const Countdown: React.FC<CountdownProps> = ({
    value,
    format = 'HH:mm:ss',
    prefix,
    size = 'middle',
    variant = 'default',
    bordered = false,
    onChange,
    onFinish,
    style,
    testID,
    nativeID,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
}) => {
    const getRemaining = useCallback(() => Math.max(0, toTimestamp(value) - Date.now()), [value]);
    const [remaining, setRemaining] = useState(getRemaining);
    const finishedRef = useRef(false);
    const onChangeRef = useRef(onChange);
    const onFinishRef = useRef(onFinish);

    // 上游就是在 render 期间直接赋值这两个 ref（保证定时器回调永远拿到最新的 props）。
    // 照搬 —— 这是上游的写法，不是本移植引入的。
    onChangeRef.current = onChange;
    onFinishRef.current = onFinish;

    useEffect(() => {
        // value 变化时重新开始一轮（允许再次触发 onFinish）
        finishedRef.current = false;
        let timer: ReturnType<typeof setInterval> | undefined;

        const update = () => {
            const next = getRemaining();
            setRemaining(next);
            onChangeRef.current?.(next);

            if (next === 0) {
                if (!finishedRef.current) {
                    finishedRef.current = true;
                    onFinishRef.current?.();
                }
                // 归零后清除定时器，避免 setInterval 空转（上游 5a002e0 的修复）
                if (timer !== undefined) {
                    clearInterval(timer);
                    timer = undefined;
                }
            }
            return next;
        };

        // Web: `window.setInterval(update, 250)`。RN 没有 window，直接用全局定时器。
        if (update() > 0) {
            timer = setInterval(update, COUNTDOWN_INTERVAL_MS);
        }

        // 卸载（或 value 变化）时清掉定时器
        return () => {
            if (timer !== undefined) {
                clearInterval(timer);
            }
        };
    }, [getRemaining]);

    const spec = SIZE_SPEC[size];
    const windowSize = useWindowDimensions();
    const parts = parseFormat(format);
    const digits = splitRemaining(remaining, format);
    // 读屏文本：滚动数字条对辅助技术隐藏，用完整格式化串代替
    const readable = formatRemaining(remaining, format);

    return (
        <View
            // Web: <div role="timer" aria-live="off">。RN 0.87 的 role / aria-live 同名支持。
            // 显式 `accessible`：子节点全是文本、无交互内容，合并成一个节点正是
            // `role="timer"` 的语义，也让 `getByRole('timer')` 能命中
            //（RNTL 的 isAccessibilityElement 对非 Text 宿主只在显式设置时才为 true）。
            accessible
            role="timer"
            aria-live="off"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            nativeID={nativeID}
            style={[
                styles.countdown,
                { minHeight: spec.minHeight },
                variant === 'island' ? styles.island : styles.default,
                // 对应 `@media (max-width: 480px) { .countdown { flex-wrap: wrap; justify-content: center } }`
                shouldWrap(windowSize.width) && styles.wrapped,
                style,
            ]}
            testID={testID}
        >
            {/* Web: {prefix !== undefined && <span className={styles.prefix}>{prefix}</span>}
                与 Collapse 处理 question / answer 同一手法：字符串包进 `Text`（RN 要求），
                其它节点原样渲染 —— 直接塞进 `Text` 会让 `View` 嵌 `Text`，RN 会告警。 */}
            {prefix !== undefined &&
                (isTextual(prefix) ? (
                    <Text style={[styles.prefix, { fontSize: spec.fontSize }]} numberOfLines={1}>
                        {prefix}
                    </Text>
                ) : (
                    prefix
                ))}

            {/*
             * Web: <span className={styles.group} aria-hidden="true">。整块数字条对辅助技术隐藏，
             * 由下面的 `.srOnly` 文本代替。
             */}
            <View aria-hidden style={styles.group} testID={testID ? `${testID}-digits` : undefined}>
                {parts.map((part, i) =>
                    part.kind === 'token' ? (
                        <View
                            key={`${part.token}-${i}`}
                            style={[
                                styles.unit,
                                variant === 'island' && styles.unitIsland,
                                bordered && styles.unitBordered,
                                bordered && variant === 'island' && styles.unitBorderedIsland,
                            ]}
                        >
                            {digits[part.token].split('').map((d, j) => (
                                <DigitRoll
                                    key={`${part.token}-${j}`}
                                    digit={d}
                                    digitFontSize={spec.digitFontSize}
                                    testID={testID ? `${testID}-digit-${i}-${j}` : undefined}
                                />
                            ))}
                        </View>
                    ) : (
                        // Web: `className={/[:：]/.test(part.text) ? styles.colon : styles.sep}`
                        <Text
                            key={`sep-${i}`}
                            style={
                                /[:：]/.test(part.text)
                                    ? [
                                          styles.colon,
                                          {
                                              fontSize: spec.digitFontSize,
                                              transform: [{ translateY: colonOffsetY(spec.digitFontSize) }],
                                          },
                                      ]
                                    : [styles.sep, { fontSize: spec.fontSize }]
                            }
                        >
                            {part.text}
                        </Text>
                    )
                )}
            </View>

            {/*
             * `.srOnly`：视觉上不可见但保留在无障碍树里。
             * Web 用 `clip: rect(0 0 0 0)`；RN 没有 clip，改用 1×1 + overflow hidden + opacity 0
             * （RN 不因 opacity 为 0 把节点移出无障碍树，只是不绘制）。
             */}
            <Text style={styles.srOnly} testID={testID ? `${testID}-readable` : undefined}>
                {readable}
            </Text>
        </View>
    );
};

Countdown.displayName = 'Countdown';

/**
 * 对应 Web 的 `countdown.module.less`。映射说明：
 *   - `var(--animal-*, fallback)` 走 `src/theme/tokens.ts`（CSS 变量就是 Less 变量的别名）。
 *     注意 `.default { background: var(--animal-bg-color, #fff) }` 的实际值是 `@bg-color: #f8f8f0`
 *     （`#fff` 只是变量缺失时的兜底），所以用 `colors.bg`（与 `Time.tsx` 同一判断）。
 *   - `.default` 的 `box-shadow: var(--animal-shadow-sm, ...)` → `boxShadow.sm`。
 *   - 其余颜色 / 间距 / 圆角在 Less 里都是**硬编码**（20px 圆角、1.2em、0.08em、#8b7355 …），
 *     没有对应 token，照搬字面量并在上方常量里注明。
 *   - `@font-family` 是 Nunito + Noto Sans SC 字体栈，RN 不支持字体栈且 woff2 不可用
 *     （见 tokens.ts 的 `fontFamily`），与 Button / Time / TimePicker 一样**不设置** family。
 */
const styles = StyleSheet.create({
    // .countdown { display: inline-flex; align-items: center; gap: 8px; width: fit-content;
    //              border-radius: 20px; font-weight: 700; color: #794f27 }
    // RN 的 View 默认是 column，inline-flex 默认 row —— 显式写 flexDirection: 'row'；
    // width: fit-content 用 alignSelf: 'flex-start' 复刻。
    // ⚠️ `.countdown` 的 `color` / `font-weight` 在 CSS 里是**继承**给子节点的，RN 不继承，
    // 而所有子 Text 都各自声明了自己的颜色与字重，所以这里不再重复声明（声明了也是死样式）。
    countdown: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm, // var(--animal-spacing-sm, 8px)
        borderRadius: 20, // 硬编码 20px（radius token 只有 16 / 18 / 24）
    },
    wrapped: {
        maxWidth: '100%',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    // .default { padding: 12px 18px; background: var(--animal-bg-color, #fff); box-shadow: var(--animal-shadow-sm, ...) }
    default: {
        paddingVertical: 12,
        paddingHorizontal: 18,
        backgroundColor: colors.bg,
        // ⚠️ `boxShadow` 需要 Android 的新架构（与 Button / Time / TimePicker 同一约束）
        boxShadow: boxShadow.sm,
    },
    // .island { padding: 13px 20px; background: rgb(247, 243, 223); border: 2px dashed #d4c4a8 }
    island: {
        paddingVertical: 13,
        paddingHorizontal: 20,
        backgroundColor: ISLAND_BG,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: ISLAND_BORDER,
    },
    // .prefix { color: #725d42; font-weight: 600; white-space: nowrap }
    prefix: {
        color: PREFIX_COLOR,
        fontWeight: '600',
    },
    // .group { display: inline-flex; align-items: center; gap: 6px }
    group: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    // .unit { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 12px }
    unit: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: UNIT_BG,
    },
    unitIsland: {
        backgroundColor: ISLAND_UNIT_BG,
    },
    // .bordered .unit { border: 1.5px solid #d4c9b4 }
    unitBordered: {
        borderWidth: 1.5,
        borderColor: BORDERED_BORDER,
    },
    // .bordered.island .unit { border-color: #d4c4a8 }
    unitBorderedIsland: {
        borderColor: ISLAND_BORDER,
    },
    // .digitCell { display: inline-block; overflow: hidden; height: 1.2em }（高度按尺寸内联给）
    digitCell: {
        overflow: 'hidden',
    },
    // .digitStrip { display: flex; flex-direction: column; will-change: transform }
    digitStrip: {
        flexDirection: 'column',
    },
    // .digitFace { display: block; height: 1.2em; color: #8b7355; font-weight: 900;
    //              font-variant-numeric: tabular-nums; line-height: 1.2; text-align: center }
    // 高度 / 行高 / 字号按尺寸内联给。
    digitFace: {
        color: DIGIT_COLOR,
        fontWeight: '900',
        textAlign: 'center',
    },
    // .sep { color: #8b7355; font-weight: 700; white-space: pre }
    sep: {
        color: DIGIT_COLOR,
        fontWeight: '700',
    },
    // .colon { color: #8b7355; font-weight: 900; white-space: pre; top: -0.08em }
    // 字号与上移量按尺寸内联给（见 colonOffsetY）。
    colon: {
        color: DIGIT_COLOR,
        fontWeight: '900',
    },
    // .srOnly { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    //           overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0 }
    // RN 没有 clip；1×1 + overflow hidden + opacity 0 是等价的可访问隐藏。
    srOnly: {
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
    },
});
