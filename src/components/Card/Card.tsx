import React, { useId } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type GestureResponderEvent,
    type PressableStateCallbackType,
    type Role,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

export type CardType = 'default' | 'dashed';

export type CardColor =
    | 'default'
    | 'app-pink'
    | 'purple'
    | 'app-blue'
    | 'app-yellow'
    | 'app-orange'
    | 'app-teal'
    | 'app-green'
    | 'app-red'
    | 'lime-green'
    | 'yellow-green'
    | 'brown'
    | 'warm-peach-pink';

export type CardPattern =
    | 'none'
    | 'default'
    | 'app-pink'
    | 'purple'
    | 'app-blue'
    | 'app-yellow'
    | 'app-orange'
    | 'app-teal'
    | 'app-green'
    | 'app-red'
    | 'lime-green'
    | 'yellow-green'
    | 'brown'
    | 'warm-peach-pink';

export interface CardProps {
    /** 卡片类型 */
    type?: CardType;
    /** 背景颜色类型 */
    color?: CardColor;
    /** 背景花纹类型 */
    pattern?: CardPattern;
    /**
     * 是否启用「可交互」外观。
     *
     * Web 版语义是 hover 效果（`cursor: pointer` + hover 时 `translateY(-2px)`）。
     * **触摸设备没有 hover**，RN 也没有对应事件，所以这套反馈改挂在**按下态**上
     * （`pressed`）—— 即手指按住时上浮 2px；`type="dashed"` 时按 Web 的
     * `.card-hoverable.card-dashed:hover` 只换边框色、不做位移。
     * 只有同时传了 `onPress`（可交互）时按下态才有意义。
     * @default false
     */
    hoverable?: boolean;
    /** 自定义内容 */
    children?: React.ReactNode;
    /**
     * 点击回调。
     * 对应 Web 版经 `...rest` 透传的原生 `onClick`；RN 里就是 `Pressable` 的 `onPress`。
     * 传了才会把根节点渲染成 `Pressable`（否则是纯容器 `View`）。
     */
    onPress?: (e: GestureResponderEvent) => void;
    /** 自定义样式（作用于最外层容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /** 无障碍角色。对应 Web 版经 `...rest` 透传的 `role`（上游自身不设角色） */
    role?: Role;
    /** 可访问名。对应 Web 版经 `...rest` 透传的 `aria-label` */
    'aria-label'?: string;
    /** 关联的可访问名来源。对应 Web 版经 `...rest` 透传的 `aria-labelledby` */
    'aria-labelledby'?: string;
}

/** 一层「面」：View 侧的背景/边框 + Text 侧的文字色 */
type Face = {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: 'solid' | 'dashed';
    color?: string;
    transformY?: number;
};

/** `.card-dashed` —— border: 2px dashed #e8dcc8; background: rgb(250, 248, 242) */
const DASHED_FACE: Face = {
    backgroundColor: 'rgb(250, 248, 242)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#e8dcc8',
};
// 注：`.card-dashed { box-shadow: none }` 在 Web 上是空操作（`.card` 本来就没有阴影），
// RN 侧同样不设 boxShadow，故这里不写。

/** `.card-hoverable.card-dashed:hover { border-color: #d4c4a8 }` */
const DASHED_PRESSED_FACE: Face = { borderColor: '#d4c4a8' };

/** `.card-hoverable:hover { transform: translateY(-2px) }` —— 改挂按下态，见 CardProps.hoverable */
const HOVERABLE_PRESSED_FACE: Face = { transformY: -2 };

/**
 * 颜色变体 —— 逐条对应 `.card-{color}`（background + color）。
 *
 * ⚠️ Web 的层叠顺序（同优先级按样式表顺序，见 card.module.less）：
 *   `.card` → `.card-dashed` → `.card-{color}` → `.pattern-{pattern}`
 * 所以 `pattern` 会盖掉 `color` 的背景与文字色。RN 侧用同样的覆盖顺序。
 */
const COLOR_SPEC: Record<Exclude<CardColor, 'default'>, Face> = {
    'app-pink': { backgroundColor: '#f8a6b2', color: '#fff' },
    purple: { backgroundColor: '#b77dee', color: '#fff' },
    'app-blue': { backgroundColor: '#889df0', color: '#fff' },
    'app-yellow': { backgroundColor: '#f7cd67', color: '#725d42' },
    'app-orange': { backgroundColor: '#e59266', color: '#fff' },
    'app-teal': { backgroundColor: '#82d5bb', color: '#fff' },
    'app-green': { backgroundColor: '#8ac68a', color: '#fff' },
    'app-red': { backgroundColor: '#fc736d', color: '#fff' },
    'lime-green': { backgroundColor: '#d1da49', color: '#3d5a1a' },
    'yellow-green': { backgroundColor: '#ecdf52', color: '#725d42' },
    brown: { backgroundColor: '#9a835a', color: '#fff' },
    'warm-peach-pink': { backgroundColor: '#e18c6f', color: '#fff' },
};

/**
 * 花纹变体 —— 逐条对应 `.pattern-{pattern}`。
 *
 * Web 用两层 CSS `radial-gradient` 点阵平铺（28px 网格上的 1.5px 大点 +
 * 14px 网格上偏移 (7,7) 的 1px 小点），外加底色、1.5px 实线描边与文字色。
 * **RN 没有渐变背景**，所以点阵改用 `react-native-svg` 的 `<Pattern>` 复刻：
 * 一个 tile 内画一个圆点，再平铺成 `<Rect>` 的 fill —— 等价于 CSS 的
 * `background-repeat: repeat`。几何换算见 DOT_PRIMARY / DOT_SECONDARY。
 */
type PatternSpec = Face & {
    /** 第一层（28px 网格、r=1.5）的点色 */
    dotPrimary: string;
    /** 第二层（14px 网格、r=1、偏移 7px）的点色 */
    dotSecondary: string;
};

/** `.pattern-default` 的两层点色与其他花纹不同（两个 alpha 是 .15 / .1，而非 .18 / .12） */
const PATTERN_SPEC: Record<Exclude<CardPattern, 'none'>, PatternSpec> = {
    default: {
        backgroundColor: 'rgb(247, 243, 223)',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#d4c4a8',
        color: '#725d42',
        dotPrimary: 'rgba(196, 184, 158, 0.15)',
        dotSecondary: 'rgba(196, 184, 158, 0.1)',
    },
    'app-pink': {
        backgroundColor: '#fde4e8',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#f8a6b2',
        color: '#a85565',
        dotPrimary: 'rgba(248, 166, 178, 0.18)',
        dotSecondary: 'rgba(255, 200, 210, 0.12)',
    },
    purple: {
        backgroundColor: '#f0e8ff',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#b77dee',
        color: '#6a3a9a',
        dotPrimary: 'rgba(183, 125, 238, 0.18)',
        dotSecondary: 'rgba(220, 180, 255, 0.12)',
    },
    'app-blue': {
        backgroundColor: '#e8edff',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#889df0',
        color: '#4a5a8a',
        dotPrimary: 'rgba(136, 157, 240, 0.18)',
        dotSecondary: 'rgba(180, 195, 255, 0.12)',
    },
    'app-yellow': {
        backgroundColor: '#fff8e0',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#f7cd67',
        color: '#7a6528',
        dotPrimary: 'rgba(247, 205, 103, 0.18)',
        dotSecondary: 'rgba(255, 230, 160, 0.12)',
    },
    'app-orange': {
        backgroundColor: '#fff0e8',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#e59266',
        color: '#8a4a2a',
        dotPrimary: 'rgba(229, 146, 102, 0.18)',
        dotSecondary: 'rgba(255, 190, 150, 0.12)',
    },
    'app-teal': {
        backgroundColor: '#e8faf5',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#82d5bb',
        color: '#2a6b5a',
        dotPrimary: 'rgba(130, 213, 187, 0.18)',
        dotSecondary: 'rgba(170, 235, 210, 0.12)',
    },
    'app-green': {
        backgroundColor: '#e8f5e8',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#8ac68a',
        color: '#3a6b3a',
        dotPrimary: 'rgba(138, 198, 138, 0.18)',
        dotSecondary: 'rgba(180, 220, 180, 0.12)',
    },
    'app-red': {
        backgroundColor: '#ffe8e8',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#fc736d',
        color: '#9a3a3a',
        dotPrimary: 'rgba(252, 115, 109, 0.18)',
        dotSecondary: 'rgba(255, 160, 155, 0.12)',
    },
    'lime-green': {
        backgroundColor: '#f5f8e0',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#d1da49',
        color: '#5a6b28',
        dotPrimary: 'rgba(209, 218, 73, 0.18)',
        dotSecondary: 'rgba(230, 240, 130, 0.12)',
    },
    'yellow-green': {
        backgroundColor: '#fffde8',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#ecdf52',
        color: '#6a5a28',
        dotPrimary: 'rgba(236, 223, 82, 0.18)',
        dotSecondary: 'rgba(255, 245, 140, 0.12)',
    },
    brown: {
        backgroundColor: '#f5f0e0',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#9a835a',
        color: '#5a4a2a',
        dotPrimary: 'rgba(154, 131, 90, 0.18)',
        dotSecondary: 'rgba(190, 165, 120, 0.12)',
    },
    'warm-peach-pink': {
        backgroundColor: '#fff0e8',
        borderWidth: 1.5,
        borderStyle: 'solid',
        borderColor: '#e18c6f',
        color: '#8a4a2a',
        dotPrimary: 'rgba(225, 140, 111, 0.18)',
        dotSecondary: 'rgba(255, 185, 160, 0.12)',
    },
};

/**
 * 点阵几何 —— 对应 CSS `background-size` / `background-position`。
 *
 * CSS 的 `radial-gradient(circle, ...)` 圆心默认落在**每个 tile 的中心**
 * （不是 tile 左上角），所以 SVG `<Pattern>` 里的圆心 = `offset + tile / 2`。
 * 两层算下来圆心都是 (14, 14)：28px 网格上的点每 28px 一个，14px 网格上的点
 * 每 14px 一个（相对前者偏移半个 tile）。
 */
const DOT_PRIMARY = { tile: 28, radius: 1.5, offset: 0 } as const;
const DOT_SECONDARY = { tile: 14, radius: 1, offset: 7 } as const;

/** 只把 Face 里属于 ViewStyle 的键取出来（`Object.assign` 会带上点色等额外键） */
const toViewStyle = (face: Face): ViewStyle => {
    // ViewStyle 的属性是 readonly，先攒到可变对象再断言
    const style: Record<string, unknown> = {};
    if (face.backgroundColor !== undefined) style.backgroundColor = face.backgroundColor;
    if (face.borderColor !== undefined) style.borderColor = face.borderColor;
    if (face.borderWidth !== undefined) style.borderWidth = face.borderWidth;
    if (face.borderStyle !== undefined) style.borderStyle = face.borderStyle;
    if (face.transformY !== undefined) style.transform = [{ translateY: face.transformY }];
    return style as ViewStyle;
};

const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

export const Card: React.FC<CardProps> = ({
    type = 'default',
    color = 'default',
    pattern = 'none',
    hoverable = false,
    children,
    onPress,
    style,
    testID,
    role,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
}) => {
    // 花纹的 <Pattern> id 必须全局唯一，否则同一屏里的多张卡片会互相串色。
    // useId 的原始串带 `«»` / `:` 这类字符，`url(#...)` 里不安全，先滤掉。
    const patternId = `animal-card-pattern-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

    /** 传了 onPress 才算可交互 —— 否则根节点是纯容器 View（不合并无障碍子节点） */
    const interactive = onPress != null;
    const patternSpec = pattern === 'none' ? undefined : PATTERN_SPEC[pattern];

    // ---------- 静止态合成（顺序对齐 CSS 层叠，见 COLOR_SPEC 注释）----------
    const face: Face = {};
    if (type === 'dashed') Object.assign(face, DASHED_FACE);
    if (color !== 'default') Object.assign(face, COLOR_SPEC[color]);
    if (patternSpec !== undefined) Object.assign(face, patternSpec);

    // ---------- 按下态（替代 Web 的 :hover，见 CardProps.hoverable）----------
    const pressedFace: Face = type === 'dashed' ? DASHED_PRESSED_FACE : HOVERABLE_PRESSED_FACE;

    const faceStyle = toViewStyle(face);
    const pressedStyle = toViewStyle(pressedFace);
    // CSS `.card { font-weight: 500; color: #725d42 }` 靠继承落到文字上；RN 的文字色
    // **不会**从父 View 继承，所以这两个属性得直接写在包住文本的 <Text> 上。
    const textStyle: StyleProp<TextStyle> = [styles.text, face.color !== undefined && { color: face.color }];

    // RN 里裸字符串不能作为 View 的子节点（会抛 "Text strings must be rendered
    // within a <Text> component"），所以文本子节点要包一层 <Text>。
    const content = React.Children.map(children, (child) =>
        isTextual(child) ? <Text style={textStyle}>{child}</Text> : child
    );

    // 花纹层：绝对定位铺满，`pointerEvents="none"` 不挡触摸，`aria-hidden` 是纯装饰。
    // 加 `overflow: hidden` + 同值圆角，是为了让点阵被裁进卡片的圆角里
    // （CSS 的 background 本来就被 border-radius 裁切）—— 这样也不必给根节点加
    // `overflow: hidden`，卡片里的内容仍可像 Web 版一样溢出。
    const patternLayer =
        patternSpec === undefined ? null : (
            <View
                style={[StyleSheet.absoluteFill, styles.patternLayer]}
                pointerEvents="none"
                aria-hidden
                testID={testID === undefined ? undefined : `${testID}-pattern`}
            >
                <Svg width="100%" height="100%">
                    <Defs>
                        <Pattern
                            id={`${patternId}-primary`}
                            x={DOT_PRIMARY.offset}
                            y={DOT_PRIMARY.offset}
                            width={DOT_PRIMARY.tile}
                            height={DOT_PRIMARY.tile}
                            patternUnits="userSpaceOnUse"
                        >
                            <Circle
                                cx={DOT_PRIMARY.offset + DOT_PRIMARY.tile / 2}
                                cy={DOT_PRIMARY.offset + DOT_PRIMARY.tile / 2}
                                r={DOT_PRIMARY.radius}
                                fill={patternSpec.dotPrimary}
                            />
                        </Pattern>
                        <Pattern
                            id={`${patternId}-secondary`}
                            x={DOT_SECONDARY.offset}
                            y={DOT_SECONDARY.offset}
                            width={DOT_SECONDARY.tile}
                            height={DOT_SECONDARY.tile}
                            patternUnits="userSpaceOnUse"
                        >
                            <Circle
                                cx={DOT_SECONDARY.offset + DOT_SECONDARY.tile / 2}
                                cy={DOT_SECONDARY.offset + DOT_SECONDARY.tile / 2}
                                r={DOT_SECONDARY.radius}
                                fill={patternSpec.dotSecondary}
                            />
                        </Pattern>
                    </Defs>
                    <Rect width="100%" height="100%" fill={`url(#${patternId}-primary)`} />
                    <Rect width="100%" height="100%" fill={`url(#${patternId}-secondary)`} />
                </Svg>
            </View>
        );

    if (interactive) {
        // ⚠️ Pressable 默认 `accessible`，会把整张卡片的子节点合并成一个无障碍节点。
        // Web 版同样是一个带 onClick 的 div（也没有 role），所以行为一致；
        // 需要语义时由使用方传 `role` / `aria-label`。
        const pressableStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
            styles.card,
            faceStyle,
            hoverable && pressed ? pressedStyle : null,
            style,
        ];

        return (
            <Pressable
                role={role}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                onPress={onPress}
                style={pressableStyle}
                testID={testID}
            >
                {patternLayer}
                {content}
            </Pressable>
        );
    }

    return (
        <View
            role={role}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            style={[styles.card, faceStyle, style]}
            testID={testID}
        >
            {patternLayer}
            {content}
        </View>
    );
};

Card.displayName = 'Card';

const styles = StyleSheet.create({
    // `.card`：border-radius 20px / background rgb(247,243,223) / padding 16px 24px
    // 注：`transition: all 0.3s ease` 被丢弃 —— RN 里没有 CSS 过渡，按下态是瞬时切换的。
    card: {
        borderRadius: 20,
        backgroundColor: 'rgb(247, 243, 223)',
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    text: {
        color: '#725d42',
        fontWeight: '500',
    },
    patternLayer: {
        borderRadius: 20,
        overflow: 'hidden',
    },
});
