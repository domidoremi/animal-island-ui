import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type BadgeSize = 'small' | 'medium';

export type BadgeColor =
    | 'app-red'
    | 'app-pink'
    | 'app-orange'
    | 'app-yellow'
    | 'app-teal'
    | 'app-green'
    | 'app-blue'
    | 'purple'
    | 'lime-green'
    | 'yellow-green'
    | 'brown'
    | 'warm-peach-pink';

export interface BadgeProps extends ViewProps {
    /** 展示的内容：数字 / 字符串，或任意 ReactNode（如 naive-icons 图标） */
    count?: React.ReactNode;
    /** 展示封顶的数字值，超过时显示为 `${overflowCount}+` */
    overflowCount?: number;
    /** 数值为 0 时是否展示 */
    showZero?: boolean;
    /** 不展示数字，只展示一个小圆点 */
    dot?: boolean;
    /** 尺寸，仅对数字角标生效（dot 尺寸固定） */
    size?: BadgeSize;
    /** 颜色，与 Card / Tag 调色板一致 */
    color?: BadgeColor;
    /** Accessible full count, even when the visible number is capped. */
    title?: string;
    /** 徽标包裹的元素；不传即为独立使用 */
    children?: React.ReactNode;
}

/** 纯数字或纯数字字符串才参与封顶换算，ReactNode 内容原样展示 */
const toNumeric = (value: React.ReactNode): number | null => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
    return null;
};

/** 全角 / CJK 字符在正圆里会顶破圆直径：CJK 部首与汉字、兼容汉字、全角与半角形式 */
const FULLWIDTH = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

/** 1 到 99 这类 1–2 位内容锁成正圆；「100」「99+」等 3 位以上、以及两格全角字回退为胶囊 */
const CIRCLE_MAX_LENGTH = 2;

const fitsCircle = (value: React.ReactNode): boolean => {
    // 数字按其显示文本量长度，这样 100 / 1000 自动落回胶囊，与字符串走同一套判定
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : null;
    if (text === null || text.length === 0 || text.length > CIRCLE_MAX_LENGTH) return false;
    return !(text.length === CIRCLE_MAX_LENGTH && FULLWIDTH.test(text));
};

export const Badge: React.FC<BadgeProps> = ({
    count = null,
    overflowCount = 99,
    showZero = false,
    dot = false,
    size = 'medium',
    color = 'app-red',
    children,
    title,
    style,
    testID,
    ...rest
}) => {
    const { theme, reducedMotion } = useTheme();
    const numeric = toNumeric(count);
    // 封顶：仅数字参与换算，100 → "99+"
    const displayCount = numeric !== null && numeric > overflowCount ? `${overflowCount}+` : count;
    const isZero = displayCount === 0 || displayCount === '0';
    const showAsDot = dot && !isZero;
    // 空字符串（含纯空白）与 null / undefined 一样视为无内容，避免渲染出空心胶囊
    const isEmpty = count === null || count === undefined || (typeof count === 'string' && count.trim() === '');
    // 无内容，或数值为 0 且未开启 showZero，且不是小圆点时整体隐藏
    const isHidden = !showAsDot && (isEmpty || (isZero && !showZero));
    // 不传 children 即独立使用：角标不再相对某元素定位
    const isStandalone = children === undefined || children === null;

    // 原生 tooltip：未显式传 title 时用真实数值，封顶后仍是完整数字
    const indicatorTitle =
        title ?? (!showAsDot && (typeof count === 'number' || typeof count === 'string') ? String(count) : undefined);

    const height = showAsDot ? 10 : size === 'small' ? 16 : 20;
    const [indicatorWidth, setIndicatorWidth] = useState(height);
    const scale = useRef(new Animated.Value(1)).current;
    const face = theme.brand[color];
    useEffect(() => {
        if (isHidden || reducedMotion) {
            scale.setValue(1);
            return;
        }
        scale.setValue(0.6);
        const animation = Animated.timing(scale, {
            toValue: 1,
            duration: 250,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [isHidden, reducedMotion, scale]);
    return (
        <View {...rest} testID={testID} style={[styles.badge, style]}>
            {typeof children === 'string' || typeof children === 'number' ? <Text>{children}</Text> : children}
            {!isHidden ? (
                <Animated.View
                    accessible
                    accessibilityLabel={indicatorTitle ?? (showAsDot ? 'New activity' : undefined)}
                    testID={testID ? `${testID}-indicator` : undefined}
                    onLayout={(event) => setIndicatorWidth(event.nativeEvent.layout.width)}
                    style={[
                        styles.indicator,
                        {
                            minHeight: height,
                            minWidth: height,
                            width: showAsDot || fitsCircle(displayCount) ? height : undefined,
                            paddingHorizontal: showAsDot || fitsCircle(displayCount) ? 0 : size === 'small' ? 4 : 6,
                            backgroundColor: face.solidBg,
                            borderColor: isStandalone ? 'transparent' : theme.colors.bg,
                            position: isStandalone ? 'relative' : 'absolute',
                            top: isStandalone ? undefined : -height / 2,
                            right: isStandalone ? undefined : -indicatorWidth / 2,
                            transform: [{ scale }],
                        },
                    ]}
                >
                    {showAsDot ? null : typeof displayCount === 'string' || typeof displayCount === 'number' ? (
                        <Text style={{ color: face.onSolid, fontWeight: '700', fontSize: size === 'small' ? 9 : 10 }}>
                            {displayCount}
                        </Text>
                    ) : (
                        displayCount
                    )}
                </Animated.View>
            ) : null}
        </View>
    );
};

Badge.displayName = 'Badge';

const styles = StyleSheet.create({
    badge: { alignSelf: 'flex-start', position: 'relative' },
    indicator: { borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});
