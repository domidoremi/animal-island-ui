import React, { useEffect, useId, useRef } from 'react';
import {
    Animated,
    Easing,
    StyleSheet,
    Text,
    View,
    type DimensionValue,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export type SkeletonVariant = 'text' | 'circle' | 'rect' | 'paragraph';

export interface SkeletonProps {
    /** 是否显示骨架屏（false 时直接渲染 children） */
    loading?: boolean;
    /** 骨架屏变体 */
    variant?: SkeletonVariant;
    /** 是否启用动画（银白流光） */
    active?: boolean;
    /** 行数（paragraph 模式有效） */
    rows?: number;
    /** 宽度（text 模式有效） */
    width?: DimensionValue;
    /** 每行宽度（paragraph 模式有效，可传数组对不同行指定不同宽度） */
    rowWidths?: DimensionValue[];
    /** 宽（circle / rect 模式有效） */
    widthValue?: DimensionValue;
    /** 高（circle / rect / text 模式有效） */
    heightValue?: DimensionValue;
    /** 自定义样式（作用于最外层容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /** 子元素（loading=false 时渲染） */
    children?: React.ReactNode;
}

/**
 * ⚠️ 与 Web 的类型差异：上游把 `width` / `rowWidths` / `widthValue` / `heightValue`
 * 声明为 `number | string`。RN 的尺寸只接受 `DimensionValue`
 * （`number | 'auto' | '${number}%' | null`），裸 string 无法赋给 `width`，所以这里收窄为
 * `DimensionValue` —— 上游实际用到的 `'100%'` / `'92%'` / 数字都能通过。
 */

/** Less 局部变量 @bg-base / @bg-line / @shimmer-light / @shimmer-mid */
const BG_BASE = '#eae5db';
const BG_LINE = '#dfd9ce';
const SHIMMER_LIGHT = 'rgba(255, 252, 242, 0.55)';
const SHIMMER_MID = 'rgba(255, 250, 235, 0.18)';

/** `@keyframes animal-skeleton-shimmer { 0% → translateX(-100%); 100% → translateX(100%) }` */
const SHIMMER_DURATION = 1600; // CSS `animation: ... 1.6s`

/** `.line` 的高度 / 圆角 */
const LINE_HEIGHT = 14;
const RADIUS_SM = 12;
const RADIUS_BASE = 18;

/** 上游 DEFAULT_PARAGRAPH_WIDTHS */
const DEFAULT_PARAGRAPH_WIDTHS: DimensionValue[] = ['100%', '92%', '84%', '76%', '68%'];

/**
 * 银白流光 —— 对应 `.active::after` + `@keyframes animal-skeleton-shimmer`。
 *
 * Web 用一层 `linear-gradient(90deg, transparent, mid, light, mid, transparent)` 的
 * 伪元素，从 `translateX(-100%)` 滑到 `translateX(100%)`。RN 没有渐变背景，
 * 所以改用 `react-native-svg` 的 `<LinearGradient>` + `<Rect>` 画这一层，
 * 外面套 `Animated.View` 做位移。
 *
 * ⚠️ 驱动方式：**故意用 `useNativeDriver: false`**。位移是百分比字符串
 * （`'-100%' → '100%'`），JS 驱动的插值对字符串+单位（含 `%`）是明确支持的；
 * 原生驱动对 transform 的百分比插值在本环境里**无法验证**（没有真机/模拟器），
 * 与其赌它不报错，不如用确定可用的 JS 驱动。代价是每帧走一次 JS，
 * 对一个加载占位组件可以接受。**待真机确认**后再考虑切回原生驱动。
 */
const Shimmer: React.FC<{ testID?: string }> = ({ testID }) => {
    const progress = useRef(new Animated.Value(0)).current;
    // 渐变的 id 必须全局唯一，否则同屏多个骨架屏会互相串色
    const gradientId = `animal-skeleton-shimmer-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.timing(progress, {
                toValue: 1,
                duration: SHIMMER_DURATION,
                // CSS `ease-in-out`：RN 的 Easing.inOut(Easing.ease) 就是 bezier(0.42, 0, 0.58, 1)
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: false,
            })
        );
        animation.start();
        return () => animation.stop();
    }, [progress]);

    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: ['-100%', '100%'] });

    return (
        <Animated.View
            aria-hidden
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
            testID={testID}
        >
            <Svg width="100%" height="100%">
                <Defs>
                    {/* CSS 渐变首尾是 `transparent`（= rgba(0,0,0,0)）。这里改成
                        中间色的 RGB + alpha 0 —— 视觉等价，但避免了 CSS 里
                        「透明黑 → 彩色」插值常见的灰边。 */}
                    <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={SHIMMER_MID} stopOpacity={0} />
                        <Stop offset="0.25" stopColor={SHIMMER_MID} stopOpacity={0.18} />
                        <Stop offset="0.5" stopColor={SHIMMER_LIGHT} stopOpacity={0.55} />
                        <Stop offset="0.75" stopColor={SHIMMER_MID} stopOpacity={0.18} />
                        <Stop offset="1" stopColor={SHIMMER_MID} stopOpacity={0} />
                    </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
            </Svg>
        </Animated.View>
    );
};

const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

/** 三个衍生组件共用的流光层（`active && styles.active` 的对应物） */
const shimmerFor = (active: boolean, testID?: string) =>
    active ? <Shimmer testID={testID === undefined ? undefined : `${testID}-shimmer`} /> : null;

export const Skeleton: React.FC<SkeletonProps> = ({
    loading = true,
    variant = 'text',
    active = true,
    rows = 3,
    width,
    rowWidths,
    widthValue,
    heightValue,
    style,
    testID,
    children,
}) => {
    if (!loading && children) {
        // 上游直接 `return <>{children}</>`。RN 里裸字符串不能作为 View 的子节点，
        // 所以文本要包一层 <Text>（样式与上游一致：这一分支不套用 `style`）。
        return <>{isTextual(children) ? <Text>{children}</Text> : children}</>;
    }

    const shimmer = shimmerFor(active, testID);

    if (variant === 'paragraph') {
        const widths = Array.isArray(rowWidths) ? rowWidths : DEFAULT_PARAGRAPH_WIDTHS;
        const rowCount = Math.max(1, rows);
        return (
            // 注意：上游段落根节点**没有** `aria-hidden`（只有 text / circle / rect 有）。
            // 另外上游还叠了一个 `.paragraphBlock`（只声明 `background: none`），
            // 与 `.vt-paragraph` 的 `background: none` 重复，属于死代码，未复制。
            <View style={[styles.skeleton, styles.vtParagraph, style]} testID={testID}>
                {shimmer}
                {Array.from({ length: rowCount }, (_, i) => {
                    const w = widths[i] ?? widths[widths.length - 1] ?? '100%';
                    return <View key={i} style={[styles.line, { width: w }]} />;
                })}
            </View>
        );
    }

    if (variant === 'circle') {
        const size = widthValue ?? heightValue ?? 44;
        return (
            // `.vt-circle { border-radius: 50% }` —— RN 0.87 的 `borderRadius` 类型就是
            // `number | string`（而非 `DimensionValue`），百分比是受支持的写法，逐字照搬。
            <View
                aria-hidden
                style={[styles.skeleton, styles.vtCircle, { width: size, height: size }, style]}
                testID={testID}
            >
                {shimmer}
            </View>
        );
    }

    if (variant === 'rect') {
        return (
            <View
                aria-hidden
                style={[
                    styles.skeleton,
                    styles.vtRect,
                    { width: widthValue ?? '100%', height: heightValue ?? 120 },
                    style,
                ]}
                testID={testID}
            >
                {shimmer}
            </View>
        );
    }

    // text (default)
    return (
        <View
            aria-hidden
            style={[styles.skeleton, styles.vtText, { width: width ?? '100%', height: heightValue ?? 16 }, style]}
            testID={testID}
        >
            {shimmer}
        </View>
    );
};

Skeleton.displayName = 'Skeleton';

// ============================================
// Skeleton.Button — 按钮骨架屏
// ============================================
export interface SkeletonButtonProps {
    size?: 'small' | 'middle' | 'large';
    active?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

const BTN_SIZE: Record<string, { width: number; height: number }> = {
    small: { width: 80, height: 32 },
    middle: { width: 100, height: 45 },
    large: { width: 130, height: 48 },
};

export const SkeletonButton: React.FC<SkeletonButtonProps> = ({ size = 'middle', active = true, style, testID }) => {
    const dim = BTN_SIZE[size];
    return (
        // `.skeleton-btn { border-radius: 50px }`（覆盖 .skeleton 的 12px）+
        // 行内 `borderRadius: 50`，两者同值。
        <View
            aria-hidden
            style={[styles.skeleton, styles.pill, { width: dim.width, height: dim.height }, style]}
            testID={testID}
        >
            {shimmerFor(active, testID)}
        </View>
    );
};

SkeletonButton.displayName = 'SkeletonButton';

// ============================================
// Skeleton.Input — 输入框骨架屏
// ============================================
export interface SkeletonInputProps {
    size?: 'small' | 'middle' | 'large';
    active?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

const INPUT_SIZE: Record<string, { width: number; height: number }> = {
    small: { width: 160, height: 32 },
    middle: { width: 200, height: 40 },
    large: { width: 240, height: 48 },
};

export const SkeletonInput: React.FC<SkeletonInputProps> = ({ size = 'middle', active = true, style, testID }) => {
    const dim = INPUT_SIZE[size];
    return (
        // 上游这里没有 `.skeleton-btn` 类，圆角来自行内的 `borderRadius: 50`（同值）。
        <View
            aria-hidden
            style={[styles.skeleton, styles.pill, { width: dim.width, height: dim.height }, style]}
            testID={testID}
        >
            {shimmerFor(active, testID)}
        </View>
    );
};

SkeletonInput.displayName = 'SkeletonInput';

// ============================================
// Skeleton.Avatar — 头像骨架屏
// ============================================
export interface SkeletonAvatarProps {
    size?: 'small' | 'middle' | 'large';
    shape?: 'circle' | 'square';
    active?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}

const AVATAR_SIZE: Record<string, number> = {
    small: 32,
    middle: 44,
    large: 56,
};

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
    size = 'middle',
    shape = 'circle',
    active = true,
    style,
    testID,
}) => {
    const px = AVATAR_SIZE[size];
    return (
        <View
            aria-hidden
            style={[
                styles.skeleton,
                // 上游 `borderRadius: shape === 'circle' ? '50%' : 12`
                shape === 'circle' ? styles.avatarCircle : styles.avatarSquare,
                { width: px, height: px },
                style,
            ]}
            testID={testID}
        >
            {shimmerFor(active, testID)}
        </View>
    );
};

SkeletonAvatar.displayName = 'SkeletonAvatar';

const styles = StyleSheet.create({
    // `.skeleton`：background @bg-base / border-radius 12px / display inline-block /
    //            position relative / overflow hidden / vertical-align middle / flex-shrink 0
    // 丢弃的声明：
    //   - `line-height: 1` —— 容器上无意义（RN 的 View 不排版文字）。
    //   - `vertical-align: middle` —— RN 没有行内排版。
    //   - `position: relative` —— RN 的 View 默认就是相对定位，绝对定位子节点已相对它解析。
    // 注意 `overflow: hidden` 必须保留：流光层是绝对定位的，要靠它裁在圆角内。
    skeleton: {
        backgroundColor: BG_BASE,
        borderRadius: RADIUS_SM,
        overflow: 'hidden',
        flexShrink: 0,
        // Web 的 `display: inline-block`：RN 的 View 在 column 父容器里默认拉伸，
        // 想「按内容宽度收缩」必须显式 flex-start（paragraph 变体会再改回 stretch）。
        alignSelf: 'flex-start',
    },
    // `.vt-text { border-radius: 12px; height: 16px; margin-bottom: 8px }`
    vtText: {
        borderRadius: RADIUS_SM,
        height: 16,
        marginBottom: 8,
    },
    // `.vt-rect { border-radius: 18px }`
    vtRect: {
        borderRadius: RADIUS_BASE,
    },
    // `.vt-circle { border-radius: 50% }`（覆盖 .skeleton 的 12px）
    vtCircle: {
        borderRadius: '50%',
    },
    // `.skeleton-btn { border-radius: 50px }`；SkeletonInput 的圆角来自行内的
    // `borderRadius: 50`，两者同值，共用一个条目。
    pill: {
        borderRadius: 50,
    },
    // SkeletonAvatar：`borderRadius: shape === 'circle' ? '50%' : 12`
    avatarCircle: {
        borderRadius: '50%',
    },
    avatarSquare: {
        borderRadius: RADIUS_SM,
    },
    // `.vt-paragraph`：display flex / column / gap 10px / border-radius 0 / background none
    // `display: flex` 是块级 flex 容器 → 占满整行，所以这里把 alignSelf 改回 stretch。
    vtParagraph: {
        flexDirection: 'column',
        gap: 10,
        borderRadius: 0,
        backgroundColor: 'transparent',
        alignSelf: 'stretch',
    },
    // `.line`：height 14px / border-radius 12px / background @bg-line
    // 上游还有 `.line:last-child { width: 60% }`，但每行的宽度是**行内样式**给的，
    // 行内样式优先级高于类 → 那条规则在 Web 上根本不会生效，属于死代码，未复制。
    line: {
        height: LINE_HEIGHT,
        borderRadius: RADIUS_SM,
        backgroundColor: BG_LINE,
    },
});
