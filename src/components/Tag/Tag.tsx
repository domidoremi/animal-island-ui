import React, { useCallback } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    type GestureResponderEvent,
    type PressableStateCallbackType,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';

export type TagSize = 'small' | 'medium' | 'large';

export type TagVariant = 'solid' | 'outlined' | 'dashed' | 'soft';

export type TagColor =
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

export interface TagProps {
    /** 标签内容 */
    children?: React.ReactNode;
    /** 尺寸 */
    size?: TagSize;
    /** 风格变体：solid 填充、outlined 描边、dashed 虚线 */
    variant?: TagVariant;
    /** 颜色 */
    color?: TagColor;
    /** 是否可关闭 */
    closable?: boolean;
    /** 关闭回调（对应 Web 的 `onClose`，事件类型换成 RN 的 `GestureResponderEvent`） */
    onClose?: (e: GestureResponderEvent) => void;
    /** 点击回调（对应 Web 的 `onClick`）；传了且未 disabled 时标签才可点击 */
    onPress?: (e: GestureResponderEvent) => void;
    /** 禁用状态 */
    disabled?: boolean;
    /** 自定义样式（作用于最外层容器） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/** 一层「面」：View 侧的背景/边框 + Text 侧的文字色 */
type Face = {
    backgroundColor?: string;
    borderColor?: string;
    borderStyle?: 'solid' | 'dashed';
    color?: string;
};

/**
 * 尺寸 —— 逐条对应 `.size-small` / `.size-medium` / `.size-large`。
 * 注释来自上游：height 取 8px 等差(24/32/40)，font-size 取 12/14/16；
 * 垂直居中交给 flex 的 `alignItems: center`，`line-height: 1` 由 `.tag` 统一管理。
 */
const SIZE_SPEC = {
    small: { height: 24, paddingHorizontal: 10, fontSize: 12 },
    medium: { height: 32, paddingHorizontal: 12, fontSize: 14 },
    large: { height: 40, paddingHorizontal: 16, fontSize: 16 },
} as const;

/** 变体 —— 逐条对应 `.variant-{variant}` */
const VARIANT_SPEC: Record<TagVariant, Face> = {
    solid: { backgroundColor: 'rgb(247, 243, 223)', color: '#8f734f', borderColor: '#d4c4a8' },
    outlined: { backgroundColor: 'transparent', color: '#8f734f', borderColor: '#c4b89e' },
    dashed: { backgroundColor: 'transparent', color: '#8f734f', borderColor: '#c4b89e', borderStyle: 'dashed' },
    soft: { backgroundColor: '#f5f0e6', color: '#8f734f', borderColor: 'transparent' },
};

/**
 * 颜色 —— 逐条对应 `.color-{color}-{variant}`。
 *
 * `outlined` 与 `dashed` 在 Less 里是同一条规则（`.color-x-outlined, .color-x-dashed`），
 * 取值完全相同，所以这里合成一个 `outline`。
 *
 * 注：上游 `COLOR_CLASS` 写了 `styles[`color-${color}-solid`] || styles[`color-${color}`]`
 * 的兜底，但 Less 里**没有** `.color-{color}` 这个类，兜底分支永远取不到值 —— 属于死代码，
 * 这里不复制。
 */
const COLOR_SPEC: Record<Exclude<TagColor, 'default'>, { solid: Face; soft: Face; outline: Face }> = {
    'app-pink': {
        solid: { backgroundColor: '#f8a6b2', borderColor: '#f8a6b2', color: '#fff' },
        soft: { backgroundColor: '#fce4ec', color: '#c2185b' },
        outline: { color: '#f8a6b2', borderColor: '#f8a6b2' },
    },
    purple: {
        solid: { backgroundColor: '#b77dee', borderColor: '#b77dee', color: '#fff' },
        soft: { backgroundColor: '#f3e5f5', color: '#7b1fa2' },
        outline: { color: '#b77dee', borderColor: '#b77dee' },
    },
    'app-blue': {
        solid: { backgroundColor: '#889df0', borderColor: '#889df0', color: '#fff' },
        soft: { backgroundColor: '#e6f0ff', color: '#1565c0' },
        outline: { color: '#889df0', borderColor: '#889df0' },
    },
    'app-yellow': {
        solid: { backgroundColor: '#f7cd67', borderColor: '#f7cd67', color: '#fff' },
        soft: { backgroundColor: '#fff8e1', color: '#f9a825' },
        outline: { color: '#f7cd67', borderColor: '#f7cd67' },
    },
    'app-orange': {
        solid: { backgroundColor: '#e59266', borderColor: '#e59266', color: '#fff' },
        soft: { backgroundColor: '#fff3e0', color: '#e65100' },
        outline: { color: '#e59266', borderColor: '#e59266' },
    },
    'app-teal': {
        solid: { backgroundColor: '#82d5bb', borderColor: '#82d5bb', color: '#fff' },
        soft: { backgroundColor: '#e0f2f1', color: '#00695c' },
        outline: { color: '#82d5bb', borderColor: '#82d5bb' },
    },
    'app-green': {
        solid: { backgroundColor: '#8ac68a', borderColor: '#8ac68a', color: '#fff' },
        soft: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
        outline: { color: '#8ac68a', borderColor: '#8ac68a' },
    },
    'app-red': {
        solid: { backgroundColor: '#fc736d', borderColor: '#fc736d', color: '#fff' },
        soft: { backgroundColor: '#ffebee', color: '#c62828' },
        outline: { color: '#fc736d', borderColor: '#fc736d' },
    },
    'lime-green': {
        solid: { backgroundColor: '#d1da49', borderColor: '#d1da49', color: '#fff' },
        soft: { backgroundColor: '#f1f8e9', color: '#558b2f' },
        outline: { color: '#d1da49', borderColor: '#d1da49' },
    },
    'yellow-green': {
        solid: { backgroundColor: '#ecdf52', borderColor: '#ecdf52', color: '#fff' },
        soft: { backgroundColor: '#f9fbe7', color: '#827717' },
        outline: { color: '#ecdf52', borderColor: '#ecdf52' },
    },
    brown: {
        solid: { backgroundColor: '#9a835a', borderColor: '#9a835a', color: '#fff' },
        soft: { backgroundColor: '#efebe9', color: '#4e342e' },
        outline: { color: '#9a835a', borderColor: '#9a835a' },
    },
    'warm-peach-pink': {
        solid: { backgroundColor: '#e18c6f', borderColor: '#e18c6f', color: '#fff' },
        soft: { backgroundColor: '#fbe9e7', color: '#bf360c' },
        outline: { color: '#e18c6f', borderColor: '#e18c6f' },
    },
};

/** `.is-clickable:active { transform: translateY(0) }` */
const CLICKABLE_PRESSED: ViewStyle = { transform: [{ translateY: 0 }] };

/** 只把 Face 里属于 ViewStyle 的键取出来 */
const toViewStyle = (face: Face | undefined): ViewStyle => {
    // ViewStyle 的属性是 readonly，先攒到可变对象再断言
    const style: Record<string, unknown> = {};
    if (face === undefined) return style as ViewStyle;
    if (face.backgroundColor !== undefined) style.backgroundColor = face.backgroundColor;
    if (face.borderColor !== undefined) style.borderColor = face.borderColor;
    if (face.borderStyle !== undefined) style.borderStyle = face.borderStyle;
    return style as ViewStyle;
};

const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

export const Tag: React.FC<TagProps> = ({
    children,
    size = 'medium',
    variant = 'soft',
    color = 'default',
    closable = false,
    onClose,
    onPress,
    disabled = false,
    style,
    testID,
}) => {
    // ---------- 合成（顺序对齐 CSS 层叠：.tag → .size-* → .variant-* → .color-* → .is-disabled）----------
    const variantFace = VARIANT_SPEC[variant];
    const colorFace =
        color === 'default'
            ? undefined
            : variant === 'solid'
              ? COLOR_SPEC[color].solid
              : variant === 'soft'
                ? COLOR_SPEC[color].soft
                : COLOR_SPEC[color].outline;

    // CSS 的文字色靠继承落到 `.text` 上；RN 的文字色**不会**从父 View 继承，
    // 所以 `color` 要直接写在 <Text> 上（关闭按钮的 `color: inherit` 同理）。
    const textColor = colorFace?.color ?? variantFace.color;

    const sizeSpec = SIZE_SPEC[size];

    /**
     * 可交互 = 传了 `onPress` 且未 disabled —— 与上游 `!!onClick && !disabled` 一致。
     * 不可交互时根节点是纯容器 `View`（上游渲染的是不带 role 的 `<span>`）。
     */
    const interactive = onPress != null && !disabled;

    const handleClose = useCallback(
        (e: GestureResponderEvent) => {
            e.stopPropagation();
            if (disabled) return;
            onClose?.(e);
        },
        [disabled, onClose]
    );

    const textStyle: StyleProp<TextStyle> = {
        color: textColor,
        fontSize: sizeSpec.fontSize,
        lineHeight: sizeSpec.fontSize, // CSS `.tag { line-height: 1 }`
        fontWeight: '600', // CSS `.tag { font-weight: 600 }`
    };

    // 上游把 children 无条件包在 `<span className={styles.text}>` 里；RN 里裸字符串
    // 不能作为 View 的子节点，但 `<Text>` 又不能安全地包住任意节点（会破坏布局），
    // 所以只包文本/数字，节点原样透传。
    // `numberOfLines={1}` 对应 CSS 的 `white-space: nowrap`：RN 的 Text 默认会换行，
    // 而标签本就不该折行。代价是父容器过窄时会出现省略号（Web 是直接溢出）。
    const label = isTextual(children) ? (
        <Text numberOfLines={1} style={textStyle}>
            {children}
        </Text>
    ) : (
        children
    );

    const closeButton = closable ? (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="close"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={handleClose}
            style={styles.close}
            testID={testID === undefined ? undefined : `${testID}-close`}
        >
            {/* CSS `.close { color: inherit }` —— 继承标签文字色 */}
            <Text style={[styles.closeGlyph, { color: textColor }]}>×</Text>
        </Pressable>
    ) : null;

    const baseStyle: StyleProp<ViewStyle> = [
        styles.tag,
        { height: sizeSpec.height, paddingHorizontal: sizeSpec.paddingHorizontal },
        toViewStyle(variantFace),
        toViewStyle(colorFace),
        disabled && styles.disabled,
        style,
    ];

    if (interactive) {
        // ⚠️ Web 的 `:hover`（上浮 1px + 阴影）在 RN 里没有对应能力 —— 触摸设备没有
        // hover，见 RN-PORT.md。这里只保留 Web 的 `:active`：
        // `.is-clickable:active { transform: translateY(0) }`，相对静止态是**无视觉变化**
        // （Web 上之所以看得出来，是因为同时还有 hover 的 -1px）。忠实照搬上游规则，
        // 代价是可点击标签在触摸设备上没有按下反馈。
        const pressableStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
            baseStyle,
            pressed ? CLICKABLE_PRESSED : null,
        ];
        return (
            <Pressable accessibilityRole="button" onPress={onPress} style={pressableStyle} testID={testID}>
                {label}
                {closeButton}
            </Pressable>
        );
    }

    return (
        <View style={baseStyle} pointerEvents={disabled ? 'none' : 'auto'} testID={testID}>
            {label}
            {closeButton}
        </View>
    );
};

Tag.displayName = 'Tag';

const styles = StyleSheet.create({
    // `.tag`：inline-flex / align-items center / gap 4px / line-height 1 / font-weight 600
    //        border-radius 999px / border 1.5px solid transparent
    // 丢弃的声明：
    //   - `box-sizing: border-box` —— RN 默认即 border-box。
    //   - `font-family: inherit` —— RN 不支持字体继承（见 tokens.ts 的 fontFamily 注释）。
    //   - `user-select: none` —— RN 的 Text 默认不可选中。
    //   - `transition: all 0.2s ease` —— RN 没有 CSS 过渡。
    //   - `white-space: nowrap` —— RN 无对应声明，改用 <Text numberOfLines={1}>（见下）。
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        borderWidth: 1.5,
        // CSS `.tag { border: 1.5px solid transparent }` —— 简写里的 `solid` 也要还原，
        // 否则 border-style 默认是 none，实线变体会画不出边框。
        borderStyle: 'solid',
        borderColor: 'transparent',
        // Web 的 `display: inline-flex`：RN 的 View 在 column 父容器里默认拉伸，
        // 想「按内容宽度收缩」必须显式 flex-start（同 Button 的 .inline）。
        alignSelf: 'flex-start',
    },
    disabled: {
        opacity: 0.5,
    },
    // `.close`：16×16 圆形、半透明底、margin-left 2px / margin-right -4px
    // 丢弃：`:hover { background: rgba(0,0,0,.18) }` —— 触摸设备没有 hover。
    close: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 2,
        marginRight: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: 'rgba(149, 143, 143, 0.08)',
    },
    closeGlyph: {
        fontSize: 14,
        lineHeight: 14, // CSS line-height: 1
    },
});
