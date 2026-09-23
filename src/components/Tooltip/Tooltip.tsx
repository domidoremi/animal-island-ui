import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { borderWidth, boxShadow, duration, easing, fontSize, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import {
    bubbleStyle,
    splitPlacement,
    verticalCenterTop,
    arrowStyle,
    ISLAND_BG,
    ISLAND_STROKE,
    TOOLTIP_BG,
    TOOLTIP_BORDER,
} from './geometry';

export type TooltipPlacement =
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end';

/**
 * 触发方式。
 *
 * ⚠️ `hover` 在 RN 里**没有对应物**（没有指针悬停），映射为**按下显示 / 松开隐藏** ——
 * 这是触摸端最接近 hover 的语义（按住看、松手收）。
 * `focus` 靠 `onFocus` / `onBlur` 透传，只有**可聚焦的子元素**（`TextInput`）才会真触发。
 */
export type TooltipTrigger = 'hover' | 'focus' | 'click';

/** default 标准矩形；island 动物主题不规则有机气泡 */
export type TooltipVariant = 'default' | 'island';

const ISLAND_CLIP_PATH =
    'M0.501,0.005 L0.501,0.005 L0.523,0.005 L0.549,0.006 C0.704,0.01,0.796,0.017,0.825,0.027 L0.827,0.028 C0.872,0.045,0.939,0.044,0.978,0.17 C1,0.254,1,0.365,0.99,0.505 L0.988,0.513 C0.979,0.558,0.971,0.598,0.965,0.633 C0.956,0.689,0.979,0.77,0.964,0.865 C0.953,0.928,0.921,0.966,0.869,0.979 C0.821,0.986,0.773,0.992,0.726,0.995 L0.712,0.996 L0.694,0.997 C0.648,1,0.586,1,0.507,1 L0.501,1 L0.464,1 C0.385,1,0.325,0.998,0.283,0.995 C0.234,0.992,0.184,0.987,0.133,0.979 C0.081,0.966,0.05,0.928,0.039,0.865 C0.023,0.77,0.047,0.689,0.037,0.633 C0.031,0.595,0.023,0.552,0.013,0.505 C-0.006,0.365,-0.002,0.254,0.024,0.17 C0.064,0.045,0.13,0.045,0.174,0.028 L0.175,0.028 C0.204,0.017,0.303,0.009,0.474,0.005 L0.501,0.005';

const HIDE_DELAY_MS = 100;

export interface TooltipProps {
    /** 提示内容。Web 版允许 ReactNode；RN 里只能放 `<Text>` 能渲染的东西（含 `\n` 换行）。 */
    title: React.ReactNode;
    /** 位置，默认 `'top'` */
    placement?: TooltipPlacement;
    /** 触发方式，默认 `'hover'`（RN 上映射为按住显示 / 松开隐藏，见 `TooltipTrigger`） */
    trigger?: TooltipTrigger;
    /** 视觉风格：default 标准矩形 / island 治愈海岛有机气泡 */
    variant?: TooltipVariant;
    /** 是否显示边框（含箭头描边） */
    bordered?: boolean;
    /**
     * 子元素（触发器）。
     * ⚠️ `hover` / `click` 两种触发方式要求子元素是**可按压**的（`Pressable` / `Touchable*`
     * 或 `TextInput`）；RN 的 `View` 不接收 `onPress` 系列事件。
     */
    children: React.ReactElement;
    /** 自定义样式（替代 Web 的 `style`） */
    style?: ViewStyle;
    /** 测试 id，同时作为 `-bubble` / `-arrow` 的前缀 */
    testID?: string;
    /** Controlled visibility for host-owned focus/hover policies. */
    open?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
    title,
    placement = 'top',
    trigger = 'hover',
    variant = 'default',
    bordered = true,
    children,
    style,
    testID,
    open,
}) => {
    const { reducedMotion } = useTheme();
    const [innerVisible, setVisible] = useState(false);
    const visible = open ?? innerVisible;
    const [wrapperHeight, setWrapperHeight] = useState<number>();
    const [tipHeight, setTipHeight] = useState<number>();
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const opacity = useRef(new Animated.Value(0)).current;

    const show = useCallback(() => {
        clearTimeout(timerRef.current);
        setVisible(true);
    }, []);

    const hide = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    }, []);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    useEffect(() => {
        const anim = Animated.timing(opacity, {
            toValue: visible ? 1 : 0,
            duration: reducedMotion ? 0 : duration.base,
            easing: Easing.bezier(easing[0], easing[1], easing[2], easing[3]),
            useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
    }, [visible, opacity, reducedMotion]);

    const child = React.Children.only(children);
    const childProps = child.props as {
        onPress?: (e: unknown) => void;
        onPressIn?: (e: unknown) => void;
        onPressOut?: (e: unknown) => void;
        onFocus?: (e: unknown) => void;
        onBlur?: (e: unknown) => void;
    };

    const triggerProps: Record<string, unknown> = {};

    if (trigger === 'hover') {
        // 上游 `onMouseEnter` / `onMouseLeave` → 触摸端的 onPressIn / onPressOut
        triggerProps.onPressIn = (e: unknown) => {
            show();
            childProps.onPressIn?.(e);
        };
        triggerProps.onPressOut = (e: unknown) => {
            hide();
            childProps.onPressOut?.(e);
        };
    } else if (trigger === 'focus') {
        // 只有可聚焦的子元素（TextInput）会收到这两个回调
        triggerProps.onFocus = (e: unknown) => {
            show();
            childProps.onFocus?.(e);
        };
        triggerProps.onBlur = (e: unknown) => {
            hide();
            childProps.onBlur?.(e);
        };
    } else if (trigger === 'click') {
        // 上游 onClick 是 toggle
        triggerProps.onPress = (e: unknown) => {
            setVisible((v) => !v);
            childProps.onPress?.(e);
        };
    }

    const box = splitPlacement(placement);
    const isIsland = variant === 'island';

    const bubble: ViewStyle = {
        ...bubbleStyle(box),
        ...(box.side === 'left' || box.side === 'right'
            ? box.align === 'center'
                ? { top: verticalCenterTop(wrapperHeight, tipHeight) ?? 0 }
                : null
            : null),
    };

    return (
        <View
            style={[styles.wrapper, style]}
            onLayout={(e) => setWrapperHeight(e.nativeEvent.layout.height)}
            testID={testID}
        >
            {React.cloneElement(child, triggerProps)}
            <Animated.View
                // 上游是 `role="tooltip"` + `aria-hidden`；RN 0.87 的 Role union 含 'tooltip'。
                // 设 `accessible` 是因为 RNTL 的 getByRole 受 isAccessibilityElement 门控，
                // 裸 <View role="tooltip"> 查不到（与 Collapse 的 region 同款问题）。
                accessible
                role="tooltip"
                aria-hidden={!visible}
                pointerEvents={visible ? 'auto' : 'none'}
                onLayout={(e) => setTipHeight(e.nativeEvent.layout.height)}
                // ⚠️ 顺序照抄上游的层叠来源：`.tooltip:not(.island).bordered` ——
                // 描边**只对非 island 生效**，island 一律 `border: none`（L75）。
                // 所以这里不能写成「先 island 再 bordered」，那样 island 会被 bordered 覆盖。
                style={[
                    styles.bubble,
                    !isIsland && (bordered ? styles.bordered : styles.borderless),
                    isIsland && styles.island,
                    bubble,
                    { opacity },
                ]}
                testID={testID ? `${testID}-bubble` : undefined}
            >
                {isIsland ? (
                    <View style={[styles.islandBody, bordered && styles.islandBodyBordered]}>
                        {bordered && (
                            <Svg
                                viewBox="0 0 1 1"
                                preserveAspectRatio="none"
                                style={StyleSheet.absoluteFill}
                                testID={testID ? `${testID}-island-svg` : undefined}
                            >
                                <Path
                                    d={ISLAND_CLIP_PATH}
                                    fill={ISLAND_BG}
                                    stroke={ISLAND_STROKE}
                                    strokeWidth={borderWidth}
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            </Svg>
                        )}
                        <View
                            style={[styles.islandContent, !bordered && styles.islandContentSolid]}
                            testID={testID ? `${testID}-content` : undefined}
                        >
                            <Text style={[styles.content, styles.islandText]}>{title}</Text>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.content} testID={testID ? `${testID}-content` : undefined}>
                        {title}
                    </Text>
                )}
                {/* 上游的箭头是 `::after` 伪元素，RN 必须有真实节点 */}
                <View
                    aria-hidden
                    style={arrowStyle(box, variant, bordered)}
                    testID={testID ? `${testID}-arrow` : undefined}
                />
            </Animated.View>
        </View>
    );
};

Tooltip.displayName = 'Tooltip';

const styles = StyleSheet.create({
    // `.tooltipWrapper { position: relative; display: inline-flex; vertical-align: middle }`
    wrapper: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    // `.tooltip { position: absolute; z-index: 100; padding: 6px 12px; ... }`
    bubble: {
        position: 'absolute',
        zIndex: 100,
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: TOOLTIP_BG,
        borderRadius: radius.sm,
        boxShadow: boxShadow.base,
        maxWidth: 240,
    },
    bordered: {
        borderWidth,
        borderColor: TOOLTIP_BORDER,
    },
    borderless: {},
    content: {
        color: '#725d42',
        fontSize: fontSize.sm,
        fontWeight: '500',
        lineHeight: Math.round(fontSize.sm * 1.5),
        letterSpacing: 0.12,
    },
    // `.island { background: transparent; border: none; box-shadow: none; padding: 0; max-width: 280px }`
    island: {
        backgroundColor: 'transparent',
        paddingVertical: 0,
        paddingHorizontal: 0,
        borderWidth: 0,
        boxShadow: undefined,
        maxWidth: 280,
    },
    islandBody: {},
    // `.island.bordered .islandBody { padding: 2px; filter: drop-shadow(...) }`
    // ⚠️ `filter: drop-shadow` 在 RN 里没有对应物（没有 filter），丢弃；
    //    有机轮廓的投影只能靠 SVG 自身画，这里没有还原。
    islandBodyBordered: {
        padding: 2,
    },
    // `.islandContent { padding: 12px 20px }`
    islandContent: {
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    // `.island.borderless .islandContent { background: @tooltip-bg }`
    islandContentSolid: {
        backgroundColor: TOOLTIP_BG,
        borderRadius: radius.sm,
    },
    // `.island .islandContent .content { font-weight: 600; line-height: 1.55; text-align: center }`
    islandText: {
        fontWeight: '600',
        lineHeight: Math.round(fontSize.sm * 1.55),
        textAlign: 'center',
    },
});
