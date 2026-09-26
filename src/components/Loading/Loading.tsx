/**
 * Loading —— 全屏夜晚落雪。
 *
 * ## 关于 `Loading/island/`（第三方压缩库）
 *
 * 上游的 eslint 配置里有两条 ignore —— 压缩产物 `*.min.js` 与 `island/` 目录 —— 注释写着
 * 「第三方压缩库 + 对应声明文件（来自 Loading/island/）」。**在本分支（以及 main、
 * upstream/main、library-hardening）上，`src/components/Loading/island/` 并不存在**，
 * 该目录已在历史提交 `ce82fe3`（"refactor: component optimize the format"）中被删除。
 *
 * 它在历史上是什么（`git show 91e3d6c:src/components/Loading/island/`）：
 *   - `gsap.min.js`（58 KB）+ `gsap.min.d.ts` —— GSAP 3 的压缩构建；
 *   - `MotionPathPlugin.min.js`（20 KB）+ `.d.ts` —— GSAP 的 MotionPath 插件；
 *   - `script.js` + `script.d.ts` —— 手写的 DOM/GSAP 时间线，驱动一幅内联 `<svg>`
 *     海岛插画（#whole-island / #tree / #leaf1-5 / #water-circle / #tri-wave /
 *     #sine-wave-group / 沿 #fish-path 游动的 #fish）。
 *
 * 也就是说：它是**旧版 Loading 的 DOM-only 动画资产**，靠 `document.querySelector`
 * 选择器工作，**当前版本的 Loading 已经完全不 import 它**（现版本只用纯 CSS 关键帧
 * 做落雪）。因此 **RN 版不移植它，也没有任何东西需要移植** —— 上游那两条 eslint
 * ignore 是 `ce82fe3` 之后没清理的遗留物。
 *
 * ## 结构上的取舍：为什么不是 `Modal`
 *
 * Web 版根节点是 `position: fixed; inset: 0`。RN 没有 fixed 定位，两条路：
 *   (a) `position: absolute` + 四边 0（本实现）；
 *   (b) `Modal`。
 *
 * 选了 (a)，理由：
 *   1. `zIndex` 是本组件的公开 prop，它的**全部意义**就是「高于 Notification 的 2000」
 *      这一层序关系。`Modal` 渲染在独立的原生根里，`zIndex` 会彻底失效 —— 这个 prop
 *      就变成了死参数。
 *   2. `Modal` 用 `visible` 控制子树挂载，而本组件在淡出期间**必须保持挂载**
 *      （见下面的 exiting 逻辑），Modal 在这里只会退化成一个空壳。
 *   3. 本组件没有任何「点外部关闭 / 返回键关闭」的交互，`Modal` 的能力用不上。
 *   代价：不像 `position: fixed`，绝对定位会被任何 `overflow: hidden` 的祖先裁掉。
 *   宿主 App 需要把 `<Loading />` 挂在**屏幕根容器的直接子级**（RN 里 overlay 的常规做法）。
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { Defs, RadialGradient, Rect, Stop, Svg } from 'react-native-svg';
import type { LoadingProps } from './types';

const FLAKE_COUNT = 50;

/** `.flake { top: -30px }` —— 雪花从视口上方 30px 处开始下落 */
const FLAKE_TOP = -30;

/** `.flake` 的基色 `@flake-color: #fff`；Less 硬编码，故照搬 */
const FLAKE_COLOR = '#fff';
/** `.loading { background: @night-sky }` = `#0b101a`；Less 硬编码，故照搬 */
const NIGHT_SKY = '#0b101a';
/** `.tip { color: @tip-color }` = `#f8f8f0`；Less 硬编码，故照搬 */
const TIP_COLOR = '#f8f8f0';

/**
 * Less 里两处缓动都是**硬编码**的 `cubic-bezier(0.4, 0, 0.2, 1)`（没用 `var()`），
 * 数值与 `--animal-motion-ease` 相同。按「Less 硬编码就照搬」的规则原样写出。
 */
const EASE = Easing.bezier(0.4, 0, 0.2, 1);
/** `@keyframes animal-loading-fade-in` 的 0.2s 进入时长 */
const FADE_IN_MS = 200;

/**
 * Web 的 `inset: 0`。
 *
 * RN 有 `StyleSheet.absoluteFill`（已注册的样式 ID），但 **RN 0.87 的
 * `types_generated` 里没有导出 `absoluteFillObject`**（写它过不了 tsc），
 * 而 `absoluteFill` 是个不透明 ID、没法再和 `backgroundColor` 之类合并进
 * `StyleSheet.create` 的对象里展开，所以这里显式写出四条边。
 */
const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } as const;

type FlakeSpec = {
    /** 直径 1–6px（`Math.random() * 5 + 1`） */
    size: number;
    /** 水平位置 0–100%（`Math.random() * 100%`） */
    left: `${number}%`;
    /** 下落时长 6–12s（`Math.random() * 6 + 6`） */
    durationMs: number;
    /**
     * 首屏相位 0–1。
     *
     * 对应 Web 的内联 `animationDelay: -<0~duration>s` —— 负延迟让雪花从周期中段开始，
     * 首屏即有分布、不必等它「飘满」。RN 没有负延迟，所以把它换算成 0–1 的起始进度，
     * 由 Flake 组件还原（见那边的注释）。
     */
    phase: number;
};

/** 生成 50 片雪花。随机数来源与上游逐条一致。 */
const createFlakes = (): FlakeSpec[] =>
    Array.from({ length: FLAKE_COUNT }, () => {
        const size = Math.random() * 5 + 1; // 1–6px
        const durationSec = Math.random() * 6 + 6; // 6–12s
        return {
            size,
            left: `${Math.random() * 100}%`,
            durationMs: durationSec * 1000,
            // Web: animationDelay = -Math.random() * duration
            //      → 起始进度 = |delay| / duration = Math.random()
            phase: Math.random(),
        };
    });

/**
 * 单片雪花。
 *
 * `@keyframes animal-loading-snow`：
 *   `0%   { transform: translateY(0) rotate(0deg) }`
 *   `100% { transform: translateY(calc(100vh + 60px)) rotate(360deg) }`
 * `100vh` 在 RN 里取 `useWindowDimensions().height`。
 *
 * 相位还原方式：先播一段「补完当前周期」的短动画（`phase → 1`，时长
 * `duration * (1 - phase)`），再接一条无限循环序列 `[0ms 归零 → 整周期下落]`。
 * 为什么不直接用 `Animated.loop` + 初值：`AnimatedValue.resetAnimation()` 回到的是
 * **构造该 Value 时的值**，而原生驱动下每次迭代又回到「本段动画的起始值」——
 * 两条路都会把相位抹掉（每次循环都从 phase 处重新开始 = 明显跳帧）。
 */
const Flake: React.FC<{ flake: FlakeSpec; distance: number; testID?: string }> = ({ flake, distance, testID }) => {
    // 构造值即相位：首帧就落在周期中段（对应 Web 的负延迟）
    const progress = useRef(new Animated.Value(flake.phase)).current;

    useEffect(() => {
        const fall = (duration: number) =>
            Animated.timing(progress, {
                toValue: 1,
                duration,
                easing: Easing.linear,
                useNativeDriver: true,
            });

        const loop = Animated.loop(
            Animated.sequence([
                // 0ms 归零，让下一轮从视口上方重新开始
                Animated.timing(progress, { toValue: 0, duration: 0, easing: Easing.linear, useNativeDriver: true }),
                fall(flake.durationMs),
            ]),
            // 关掉 loop 自带的 reset：它会调用 `resetAnimation()`（回到构造值），
            // 而我们要的是「显式归零」这一条腿来定义循环起点。
            // `iterations: -1` 是「无限」—— RN 0.87 的类型把该字段标成了必填。
            { iterations: -1, resetBeforeIteration: false }
        );

        const animation = Animated.sequence([fall(flake.durationMs * (1 - flake.phase)), loop]);
        animation.start();
        return () => animation.stop();
    }, [flake.durationMs, flake.phase, progress]);

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, distance] });
    const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <Animated.View
            style={[
                styles.flake,
                {
                    width: flake.size,
                    height: flake.size,
                    borderRadius: flake.size / 2,
                    left: flake.left,
                    top: FLAKE_TOP,
                    transform: [{ translateY }, { rotate }],
                },
            ]}
            testID={testID}
        />
    );
};

export const Loading: React.FC<LoadingProps> = ({
    active = true,
    tip,
    delay = 0,
    fadeDuration = 0.6,
    zIndex = 3000,
    style,
    testID,
}) => {
    // shown：雪花屏已显示（含淡出阶段）；exiting：正在渐变消失
    const [shown, setShown] = useState(false);
    const [exiting, setExiting] = useState(false);
    // ref 与 state 同步，供 effect 读取而无需将其纳入依赖
    const shownRef = useRef(false);
    const showTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const flakes = useMemo(createFlakes, []);
    // Web 是 `translateY(calc(100vh + 60px))`
    const { height: windowHeight } = useWindowDimensions();
    const distance = windowHeight + 60;

    // 暗角渐变的 id 需要唯一（Web 版是 CSS radial-gradient，没有 id 问题）
    const gradientId = `animal-loading-vignette-${useId().replace(/:/g, '')}`;

    useEffect(() => {
        clearTimeout(showTimerRef.current);

        if (active) {
            // 淡出途中恢复开启：取消卸载计时，立即回到不透明
            clearTimeout(hideTimerRef.current);
            setExiting(false);
            if (delay === 0) {
                shownRef.current = true;
                setShown(true);
            } else {
                showTimerRef.current = setTimeout(() => {
                    shownRef.current = true;
                    setShown(true);
                }, delay);
            }
            return () => clearTimeout(showTimerRef.current);
        }

        // active=false：只有显示过才进入渐变消失
        if (shownRef.current) {
            setExiting(true);
            hideTimerRef.current = setTimeout(() => {
                shownRef.current = false;
                setShown(false);
                setExiting(false);
            }, fadeDuration * 1000);
        }
        return undefined;
    }, [active, delay, fadeDuration]);

    // 卸载时清理计时器
    useEffect(
        () => () => {
            clearTimeout(showTimerRef.current);
            clearTimeout(hideTimerRef.current);
        },
        []
    );

    /**
     * 整体淡入 / 淡出。
     *
     * Web 版进入时同时挂着 `animation: animal-loading-fade-in 0.2s`（关键帧，0 → 1）
     * 和 `transition: opacity 0.25s`；退出时 transition-duration 被内联的 fadeDuration
     * 覆盖。RN 侧合并成**一条** Animated.timing：进入 200ms、退出 fadeDuration 秒。
     *
     * `useNativeDriver: false` —— 见 Loading.test.tsx 文件头：需要假定时器才能断言
     * 淡出确实发生；opacity 是原生可驱动的，真机上换成 `true` 更省 JS 线程。
     */
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!shown) return undefined;
        Animated.timing(opacity, {
            toValue: exiting ? 0 : 1,
            duration: exiting ? fadeDuration * 1000 : FADE_IN_MS,
            easing: EASE,
            useNativeDriver: false,
        }).start();
        return undefined;
    }, [shown, exiting, fadeDuration, opacity]);

    if (!shown) return null;

    return (
        <Animated.View
            // Web: <div role="status"> —— role=status 隐含「礼貌播报」的 live region。
            // RN 里 role 只是角色，要让 `getByRole('status')` / 读屏拿到可访问名，
            // 还需要 `accessible`（RNTL 的 isAccessibilityElement 只看 accessible）。
            role="status"
            accessible
            // `.loading.exiting { pointer-events: none }`
            pointerEvents={exiting ? 'none' : 'auto'}
            style={[styles.root, { zIndex, opacity }, style]}
            testID={testID}
        >
            {/* Web: <div className={styles.snow} aria-hidden="true"> */}
            <View aria-hidden style={styles.snow} testID={testID ? `${testID}-snow` : undefined}>
                {flakes.map((flake, i) => (
                    <Flake
                        // 雪花是随机生成后固定不动的列表，索引即身份
                        key={i}
                        flake={flake}
                        distance={distance}
                        testID={testID ? `${testID}-flake` : undefined}
                    />
                ))}
            </View>

            {/*
             * 暗角。Web 是纯 CSS 的
             *   radial-gradient(ellipse at center, transparent 55%, rgba(5, 10, 20, 0.6) 100%)
             * RN 没有渐变能力，按「CSS 画的图形一律换成 react-native-svg」的约定改用
             * `<RadialGradient>`。近似点：CSS 默认 size 是 farthest-corner（椭圆），
             * SVG 的 `r="50%"` 是正圆 —— 竖屏下差异很小。
             */}
            <View aria-hidden style={styles.vignette} testID={testID ? `${testID}-vignette` : undefined}>
                <Svg width="100%" height="100%">
                    <Defs>
                        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                            <Stop offset="55%" stopColor="#050a14" stopOpacity={0} />
                            <Stop offset="100%" stopColor="#050a14" stopOpacity={0.6} />
                        </RadialGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
                </Svg>
            </View>

            {tip ? (
                // `.tip` 在 Web 里是「绝对铺满 + flex 居中」的文字容器。RN 的 Text 没有
                // 跨平台可靠的垂直居中（`textAlignVertical` 只对 Android 生效），
                // 所以拆成 View（负责布局）+ Text（负责字体）。
                <View style={styles.tip} testID={testID ? `${testID}-tip` : undefined}>
                    <Text style={styles.tipText}>{tip}</Text>
                </View>
            ) : (
                // `.srOnly`：视觉上 1×1 裁掉，但在无障碍树里仍然可读 —— 这正是
                // role=status 容器可访问名的来源（Web 版同样是给读屏用的兜底文案）。
                <Text style={styles.srOnly}>加载中</Text>
            )}
        </Animated.View>
    );
};

Loading.displayName = 'Loading';

const styles = StyleSheet.create({
    root: {
        // Web 的 `position: fixed; inset: 0`（见文件头的取舍说明）
        ...FILL,
        backgroundColor: NIGHT_SKY,
        overflow: 'hidden',
    },
    snow: {
        ...FILL,
    },
    flake: {
        position: 'absolute',
        backgroundColor: FLAKE_COLOR,
    },
    vignette: {
        ...FILL,
    },
    tip: {
        ...FILL,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    tipText: {
        color: TIP_COLOR,
        fontWeight: '800',
        fontSize: 18,
        letterSpacing: 0.04 * 18, // CSS letter-spacing: 0.04em
        lineHeight: 18 * 1.5, // CSS line-height: 1.5
        textAlign: 'center',
        // CSS text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6)
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    } as TextStyle,
    srOnly: {
        // `.srOnly { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden }`
        position: 'absolute',
        width: 1,
        height: 1,
        margin: -1,
        overflow: 'hidden',
    },
});
