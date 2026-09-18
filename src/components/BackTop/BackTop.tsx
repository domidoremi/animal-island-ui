/**
 * BackTop —— 返回顶部按钮（只有一枚火箭图标，无底色 / 无边框）。
 *
 * ## API 决策：为什么把 `target` 换成 `scrollY`
 *
 * Web 版自己管滚动：`target?: () => HTMLElement | Window`（默认 `window`），组件
 * `addEventListener('scroll')` 读 `scrollTop`，点击时用 `requestAnimationFrame`
 * 手写缓动把 `scrollTop` 归零。
 *
 * RN 里这两件事**都做不了**：
 *   - `ScrollView` 没有 `addEventListener('scroll')`，也没有 `scrollTop` 可写；
 *     滚动位置只能由宿主在 `onScroll` 里拿到。
 *   - `ScrollView.scrollTo({ y, animated })` 只有「动画 / 不动画」两档，
 *     没有时长参数 —— 所以 `duration` 在 RN 里没有任何落点。
 *
 * 题目给了两条路：(a) 纯展示按钮，可见性也交给宿主；(b) 接收 scroll-y 值。
 * 选了 **(b)**，因为它对公开 API 的改动最小：
 *   - `visibilityHeight`（含「严格大于才显示」的边界语义）这套**判定逻辑留在组件里**，
 *     宿主只需把 `onScroll` 的 `contentOffset.y` 透进来 —— 换掉 1 个 prop（`target`），
 *     而不是把整个「何时显示」的职责推给宿主。
 *   - 真机上 `ScrollView.scrollTo` 的动画由原生负责，与 Web 手写 rAF 缓动观感一致。
 *
 * 因此：**`target` 被删除，新增 `scrollY`；`duration` 被删除**（RN 无对应能力），
 * 点击后滚到顶部的动作由宿主在 `onPress` 里完成：
 *
 * ```tsx
 * const ref = useRef<ScrollView>(null);
 * const [y, setY] = useState(0);
 *
 * <ScrollView ref={ref} onScroll={(e) => setY(e.nativeEvent.contentOffset.y)} scrollEventThrottle={16} />
 * <BackTop scrollY={y} onPress={() => ref.current?.scrollTo({ y: 0, animated: true })} />
 * ```
 *
 * ## 其它
 *
 * `position: fixed` → `position: absolute`（同 Loading 的取舍：RN 没有 fixed，
 * 宿主需要把它挂在屏幕根容器的直接子级，否则会被 `overflow: hidden` 的祖先裁掉）。
 */
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    View,
    type GestureResponderEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import { RocketIcon } from './RocketIcon';

export interface BackTopProps {
    /**
     * 当前滚动位置（px）。
     *
     * 宿主把 `ScrollView.onScroll` 的 `nativeEvent.contentOffset.y` 传进来即可。
     * 对应 Web 版由组件自己 `addEventListener('scroll')` 读到的 `scrollTop`；
     * 默认 0（未滚动 → 隐藏）。
     */
    scrollY?: number;
    /** 滚动多少 px 后显示，默认 400（判定为**严格大于**，与上游一致） */
    visibilityHeight?: number;
    /**
     * 点击回调（对应 Web 的 `onClick`）。
     *
     * 宿主在这里执行 `scrollTo({ y: 0, animated: true })` —— 组件不再自己滚。
     */
    onPress?: (e: GestureResponderEvent) => void;
    /** 自定义样式（作用于最外层 Pressable，替代 Web 的 `className`） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /** 可访问名，默认「返回顶部」（与 Web 版 `<img alt="返回顶部">` 一致） */
    accessibilityLabel?: string;
}

/** Less 里硬编码的 `transition: ... 0.3s cubic-bezier(0.4, 0, 0.2, 1)`，照搬 */
const TRANSITION_MS = 300;
const EASE = Easing.bezier(0.4, 0, 0.2, 1);

/** `.backtop { transform: translateY(10px) }` —— 隐藏态从下方 10px 处上浮 */
const HIDDEN_OFFSET = 10;

/** `.img { filter: drop-shadow(0 4px 10px rgba(91, 78, 30, 0.22)) }`，照搬数值 */
const ICON_SHADOW = '0 4px 10px 0 rgba(91, 78, 30, 0.22)';

/** 与 Switch 相同：Pressable 不是 Animated 组件，包一层才能让透明度 / 位移动起来 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const BackTop: React.FC<BackTopProps> = ({
    scrollY = 0,
    visibilityHeight = 400,
    onPress,
    style,
    testID,
    accessibilityLabel = '返回顶部',
}) => {
    // Web: `const [visible, setVisible] = useState(false)` + scroll 监听里的
    //      `setVisible(scrollTop > visibilityHeight)`。这里改成由 prop 直接推导 ——
    //      没有内部状态，也就不存在「挂载时同步一次」的问题。
    const visible = scrollY > visibilityHeight;

    /**
     * 可见进度 0 → 1。
     *
     * 对应 `.backtop { opacity: 0; visibility: hidden; transform: translateY(10px);
     * transition: opacity .3s, transform .3s, visibility .3s }` 与 `.visible { opacity: 1;
     * visibility: visible; transform: translateY(0) }`。
     *
     * `useNativeDriver: false` —— opacity / transform 本来是原生可驱动的，但本组件
     * 的「淡入淡出真的发生了」是本批唯一能测到的动效（见测试文件头），所以选了 JS 驱动
     * 以便用假定时器断言。真机上改成 `true` 是安全的（不会改变任何状态）。
     */
    const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
    useEffect(() => {
        Animated.timing(progress, {
            toValue: visible ? 1 : 0,
            duration: TRANSITION_MS,
            easing: EASE,
            useNativeDriver: false,
        }).start();
    }, [visible, progress]);

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [HIDDEN_OFFSET, 0] });

    return (
        // Pressable 不是 Animated 组件，而透明度 / 位移要由 Animated 驱动，所以包一层。
        // 这样根节点仍然**只有一个** —— 与 Web 的 `<div role="button">` 结构一致，
        // `style` / `testID` 也都落在同一个可点区域上（与 Switch 的处理相同）。
        <AnimatedPressable
            // Web: <div role="button" tabIndex={0} aria-label="返回顶部">
            // `tabIndex` → RN 的 `focusable`（RN-PORT.md 的映射表）
            role="button"
            focusable
            aria-label={accessibilityLabel}
            // CSS 的 `visibility: hidden` 会把节点移出无障碍树与命中测试，
            // RN 侧对应 `aria-hidden` + `pointerEvents="none"` 这一对。
            aria-hidden={!visible}
            pointerEvents={visible ? 'auto' : 'none'}
            onPress={onPress}
            style={[styles.button, { opacity: progress, transform: [{ translateY }] }, style]}
            testID={testID}
        >
            {/* Web: <img className={styles.img} src={rocketIcon} alt="返回顶部" />
                → react-native-svg 复刻的 RocketIcon；可访问名由外层 aria-label 提供
                （SVG 没有 alt 语义）。`filter: drop-shadow(...)` → boxShadow：
                前者沿轮廓、后者沿盒子，这是近似（图标基本铺满 64×64，差异很小）。 */}
            <View style={styles.icon} testID={testID ? `${testID}-icon` : undefined}>
                <RocketIcon size={64} />
            </View>
        </AnimatedPressable>
    );
};

BackTop.displayName = 'BackTop';

const styles = StyleSheet.create({
    button: {
        // Web 的 `.backtop`：
        //   position: fixed; bottom: 32px; right: 24px; z-index: 1000;
        //   border: none; background: none; padding: 0; margin: 0; line-height: 1
        position: 'absolute',
        bottom: 32,
        right: 24,
        zIndex: 1000,
        padding: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        width: 64,
        height: 64,
        boxShadow: ICON_SHADOW,
    },
});
