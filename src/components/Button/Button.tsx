import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Pressable,
    processColor,
    StyleSheet,
    Text,
    View,
    type GestureResponderEvent,
    type PressableStateCallbackType,
    type PressableProps,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';
import { DonutIcon } from '../../icons';
import { boxShadow, colors, controlHeight, fontSize, radius, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';

export type ButtonType = 'primary' | 'default' | 'dashed' | 'text' | 'link';
export type ButtonSize = 'small' | 'middle' | 'large';

export interface ButtonProps {
    /** 按钮类型 */
    type?: ButtonType;
    /** 按钮尺寸 */
    size?: ButtonSize;
    /** 是否危险按钮 */
    danger?: boolean;
    /** 是否幽灵按钮（透明背景） */
    ghost?: boolean;
    /** 是否块级按钮 */
    block?: boolean;
    /** 加载状态 */
    loading?: boolean;
    /** 禁用状态 */
    disabled?: boolean;
    /** 图标（置于文案左侧） */
    icon?: React.ReactNode;
    /** 按钮文案 */
    children?: React.ReactNode;
    /** 点击回调（对应 Web 的 `onClick`） */
    onPress?: (e: GestureResponderEvent) => void;
    /** 长按回调（RN 专有，Web 无对应） */
    onLongPress?: (e: GestureResponderEvent) => void;
    /** 自定义样式（作用于最外层 Pressable） */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
    /** 可访问名；纯图标按钮必须传 */
    accessibilityLabel?: string;
    /** Host accessibility semantics (for example a disclosure's expanded state). */
    accessibilityRole?: PressableProps['accessibilityRole'];
    accessibilityState?: PressableProps['accessibilityState'];
    /** Typography only; layout belongs on style. */
    textStyle?: StyleProp<TextStyle>;
    /** Extend a compact visual control's accessible touch target. */
    hitSlop?: PressableProps['hitSlop'];
}

/** 尺寸规格 —— 对应 .btn-small / .btn-middle / .btn-large */
const SIZE_SPEC = {
    small: {
        height: controlHeight.sm,
        paddingHorizontal: spacing.lg,
        fontSize: fontSize.sm,
        borderRadius: radius.sm,
    },
    middle: {
        height: 45,
        paddingHorizontal: 20,
        fontSize: fontSize.base,
        borderRadius: 50,
    },
    large: {
        height: controlHeight.lg,
        paddingHorizontal: 32,
        fontSize: fontSize.lg,
        borderRadius: radius.lg,
    },
} as const;

type Face = {
    color: string;
    backgroundColor: string;
    borderColor: string;
    borderStyle?: 'solid' | 'dashed';
    boxShadow?: string;
};

/** 静止态 —— 对应各 `.btn-*` 的默认声明 */
const TYPE_SPEC: Record<ButtonType, Face> = {
    default: {
        color: colors.text,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        boxShadow: boxShadow.sm,
    },
    primary: {
        color: colors.text,
        backgroundColor: colors.bg,
        borderColor: colors.bg,
        boxShadow: '0 5px 0 0 #bdaea0',
    },
    dashed: {
        color: colors.text,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderStyle: 'dashed',
        boxShadow: boxShadow.sm,
    },
    text: {
        color: colors.text,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
    },
    link: {
        color: colors.primary,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
    },
};

type FacePatch = Partial<Face> & { transformY?: number };

/**
 * 按下态 —— 对应 Web 各 `.btn-*:active:not(:disabled)`。
 *
 * ⚠️ Web 另有一整套 `:hover` 态（如 default 悬浮时文字/描边转主题色并上浮 1px）。
 * 触摸设备没有 hover，RN 也没有对应事件，所以**这套被丢弃**；按下态取的是 Web 的
 * `:active`（手指按住时的「压下去」反馈）。见 RN-PORT.md「API 差异」。
 */
const PRESSED_SPEC: Record<ButtonType, FacePatch> = {
    default: { color: colors.primaryActive, borderColor: colors.primaryActive, transformY: 0 },
    primary: {
        backgroundColor: colors.bg,
        borderColor: colors.bg,
        boxShadow: '0 1px 0 0 #bdaea0',
        transformY: 2,
    },
    dashed: { color: colors.primaryActive, borderColor: colors.primaryActive, transformY: 0 },
    text: { backgroundColor: '#e9ddc6' }, // darken(@bg-color-secondary, 5%)
    link: { color: colors.primaryActive },
};

const DANGER_FACE: FacePatch = { color: colors.error, borderColor: colors.error };
const DANGER_PRIMARY_FACE: FacePatch = {
    color: '#fff',
    backgroundColor: colors.error,
    borderColor: colors.error,
    boxShadow: `0 5px 0 0 ${colors.errorActive}`,
};
const DANGER_PRIMARY_PRESSED: FacePatch = {
    backgroundColor: colors.errorActive,
    borderColor: colors.errorActive,
    boxShadow: `0 1px 0 0 ${colors.errorActive}`,
    transformY: 2,
};
const DANGER_TEXT_FACE: FacePatch = { color: '#fff' };

const GHOST_FACE: FacePatch = { backgroundColor: 'transparent', boxShadow: undefined };
const GHOST_PRIMARY_FACE: FacePatch = { color: colors.primary, backgroundColor: 'transparent' };
const GHOST_PRIMARY_PRESSED: FacePatch = {
    color: colors.primaryHover,
    borderColor: colors.primaryHover,
    backgroundColor: 'rgba(25, 200, 185, 0.08)',
};

/** `.btn-loading` —— 压过 type / danger / ghost */
const LOADING_FACE: FacePatch = {
    backgroundColor: '#0ec4b6',
    borderColor: '#4de2da',
    color: '#fff',
    boxShadow: undefined,
};

/** 加载状态必须可读：保留青绿底，按实际底色选择文字/图标色，而不是恒白或恒深绿。 */
function readableLoadingFace(background: string, fallback: string): FacePatch {
    const luminance = (color: string): number | undefined => {
        const value = processColor(color);
        // 半透明/动态色的最终底色取决于宿主；loading 改用本主题的实心表面。
        if (typeof value !== 'number') return undefined;
        const argb = value < 0 ? value + 2 ** 32 : value;
        if (Math.floor(argb / 2 ** 24) !== 255) return undefined;
        const channels = [16, 8, 0].map((shift) => {
            const channel = (Math.floor(argb / 2 ** shift) % 256) / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const requestedLuminance = luminance(background);
    const backgroundColor = requestedLuminance === undefined ? fallback : background;
    const backgroundLuminance = requestedLuminance ?? luminance(fallback) ?? 1;
    // 常规青绿底仍用深绿；中间亮度的自定义色必要时用更深的墨绿（非纯黑）。
    const color = ['#173c32', '#fff', '#030604'].find((candidate) => {
        const foreground = luminance(candidate)!;
        return (
            (Math.max(foreground, backgroundLuminance) + 0.05) / (Math.min(foreground, backgroundLuminance) + 0.05) >=
            4.5
        );
    })!;
    return { backgroundColor, color, boxShadow: undefined };
}

/** 把 Face 拆成 View 样式与 Text 样式两部分（RN 的布局/文字样式分属两个 props） */
const toViewStyle = (face: FacePatch): ViewStyle => {
    // ViewStyle 的属性是 readonly，先攒到可变对象再断言
    const style: Record<string, unknown> = {};
    if (face.backgroundColor !== undefined) style.backgroundColor = face.backgroundColor;
    if (face.borderColor !== undefined) style.borderColor = face.borderColor;
    if (face.borderStyle !== undefined) style.borderStyle = face.borderStyle;
    if (face.boxShadow !== undefined) style.boxShadow = face.boxShadow;
    if (face.transformY !== undefined) style.transform = [{ translateY: face.transformY }];
    return style as ViewStyle;
};

const toTextStyle = (face: FacePatch): TextStyle => (face.color === undefined ? {} : { color: face.color });

export const Button: React.FC<ButtonProps> = ({
    type = 'default',
    size = 'middle',
    danger = false,
    ghost = false,
    block = false,
    loading = false,
    disabled = false,
    icon,
    children,
    onPress,
    onLongPress,
    style,
    testID,
    accessibilityLabel,
    accessibilityRole = 'button',
    accessibilityState,
    textStyle,
    hitSlop,
}) => {
    const { mode, theme, reducedMotion } = useTheme();
    // loading 时不可交互（对应 Web 的 pointer-events: none）
    const interactive = !disabled && !loading;

    // ---------- 旋转指示器：@keyframes animal-btn-spin，2.5s linear 逆时针无限循环 ----------
    const spin = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!loading || reducedMotion) {
            spin.setValue(0);
            return undefined;
        }
        const animation = Animated.loop(
            Animated.timing(spin, {
                toValue: 1,
                duration: 2500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        animation.start();
        return () => animation.stop();
    }, [loading, reducedMotion, spin]);
    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

    const sizeSpec = SIZE_SPEC[size];

    // ---------- 静止态合成（顺序对齐 CSS：type → danger → ghost → loading）----------
    const face: FacePatch = { ...TYPE_SPEC[type] };
    if (danger) {
        if (type === 'primary') Object.assign(face, DANGER_PRIMARY_FACE);
        else if (type === 'default' || type === 'dashed') Object.assign(face, DANGER_FACE);
        else Object.assign(face, DANGER_TEXT_FACE);
    }
    if (ghost) {
        Object.assign(face, GHOST_FACE);
        if (type === 'primary') Object.assign(face, GHOST_PRIMARY_FACE);
    }
    if (loading) Object.assign(face, LOADING_FACE);
    if (disabled) face.boxShadow = undefined; // CSS `.btn:disabled { box-shadow: none }`

    // ---------- 按下态合成 ----------
    const pressedFace: FacePatch = { ...PRESSED_SPEC[type] };
    if (danger) {
        if (type === 'primary') Object.assign(pressedFace, DANGER_PRIMARY_PRESSED);
        else if (type === 'default' || type === 'dashed')
            Object.assign(pressedFace, { color: colors.error, borderColor: colors.errorActive });
        else Object.assign(pressedFace, { color: '#fff' });
    }
    if (ghost && type === 'primary') Object.assign(pressedFace, GHOST_PRIMARY_PRESSED);

    if (mode === 'dark') {
        const transparent = ghost || type === 'text' || type === 'link';
        Object.assign(face, {
            color: type === 'link' ? theme.colors.primary : theme.colors.text,
            backgroundColor: transparent ? 'transparent' : theme.colors.bg,
            borderColor: transparent ? 'transparent' : theme.colors.border,
            boxShadow: type === 'primary' && !ghost ? `0 5px 0 0 ${theme.roles.buttonPrimaryShadow}` : undefined,
        });
        Object.assign(pressedFace, {
            color: theme.colors.primary,
            backgroundColor: transparent ? theme.colors.bgSecondary : theme.colors.bg,
            borderColor: theme.colors.primary,
            boxShadow: type === 'primary' && !ghost ? `0 1px 0 0 ${theme.roles.buttonPrimaryShadow}` : undefined,
        });
        if (danger) {
            face.color = theme.colors.error;
            pressedFace.color = theme.colors.error;
            if (type === 'primary' && !ghost) {
                Object.assign(face, {
                    backgroundColor: theme.colors.error,
                    borderColor: theme.colors.error,
                    color: '#3d3428',
                });
                Object.assign(pressedFace, { backgroundColor: theme.colors.errorHover, color: '#3d3428' });
            }
        }
        if (disabled) face.boxShadow = undefined;
    }
    if (type === 'link' && !danger) face.color = theme.colors.primary;
    if (loading) {
        Object.assign(
            face,
            readableLoadingFace(mode === 'dark' ? theme.colors.primary : LOADING_FACE.backgroundColor!, theme.colors.bg)
        );
    }

    const faceStyle = toViewStyle(face);
    const faceTextStyle = toTextStyle(face);
    const pressedStyle = toViewStyle(pressedFace);
    const pressedTextStyle = toTextStyle(pressedFace);

    const renderPressableStyle = ({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> => [
        styles.base,
        {
            height: sizeSpec.height,
            paddingHorizontal: sizeSpec.paddingHorizontal,
            borderRadius: sizeSpec.borderRadius,
        },
        block ? styles.block : styles.inline,
        faceStyle,
        loading && styles.loading,
        disabled && !loading && styles.disabled,
        pressed && interactive ? pressedStyle : null,
        style,
    ];

    const labelStyle: StyleProp<TextStyle> = [
        {
            fontSize: sizeSpec.fontSize,
            lineHeight: sizeSpec.fontSize, // CSS line-height: 1
            letterSpacing: 0.02 * sizeSpec.fontSize, // CSS letter-spacing: 0.02em
            fontWeight: '600', // CSS .btn { font-weight: 600 }
        },
        faceTextStyle,
    ];

    return (
        // 图标容器用 `aria-hidden` 而不是 `accessible={false}`：前者在 iOS/Android
        // 上都会把整个子树移出无障碍树，后者只表示「这个 View 本身不是无障碍元素」，
        // 其内部的 Text 仍会被读出来。装饰性图标要的是前者（与 Web 版一致）。
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityState={{ ...accessibilityState, disabled: disabled || loading, busy: loading }}
            accessibilityLabel={accessibilityLabel}
            hitSlop={hitSlop}
            disabled={!interactive}
            pointerEvents={loading ? 'none' : 'auto'}
            onPress={interactive ? onPress : undefined}
            onLongPress={interactive ? onLongPress : undefined}
            style={renderPressableStyle}
            testID={testID}
        >
            {({ pressed }) => (
                <>
                    {loading ? (
                        <Animated.View
                            aria-hidden
                            style={[styles.icon, { transform: [{ rotate }] }]}
                            testID={testID ? `${testID}-loading-icon` : undefined}
                        >
                            {/* 图标和文案共用经过对比度检查的 loading 前景色。 */}
                            <DonutIcon size={28} color={face.color} />
                        </Animated.View>
                    ) : (
                        icon != null && (
                            <View aria-hidden style={styles.icon}>
                                {icon}
                            </View>
                        )
                    )}
                    {children != null && children !== false && (
                        <Text
                            numberOfLines={1}
                            style={[labelStyle, pressed && interactive ? pressedTextStyle : null, textStyle]}
                        >
                            {children}
                        </Text>
                    )}
                </>
            )}
        </Pressable>
    );
};

Button.displayName = 'Button';

const styles = StyleSheet.create({
    base: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm, // CSS gap: 8px
        borderWidth: 2,
        borderColor: 'transparent',
    },
    // Web 的 `display: inline-flex`：RN 的 View 在 column 父容器里默认拉伸，
    // 想「按内容宽度收缩」必须显式 flex-start。
    inline: {
        alignSelf: 'flex-start',
    },
    // Web 的 .btn-block
    block: {
        alignSelf: 'stretch',
        width: '100%',
    },
    loading: {
        borderWidth: 4,
    },
    disabled: {
        opacity: 0.5,
    },
    icon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
