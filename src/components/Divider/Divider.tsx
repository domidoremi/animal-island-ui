import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

export type DividerType = 'dashed-brown' | 'thin' | 'hairline' | 'wave-yellow' | 'squiggle';

export interface DividerProps {
    /** 分隔线类型（type 与 icon 二选一，icon 优先） */
    type?: DividerType;
    /** 传入图标元素（如 `<FishIcon size={24} />`）；传入时渲染「图标 + 连接线」循环相连的装饰分割线，铺满整行 */
    icon?: React.ReactNode;
    /** 图标大小（px），默认 24 */
    iconSize?: number;
    /** 图标间距（px），即相邻图标之间连接线的长度，默认 8 */
    iconGap?: number;
    /** 自定义样式 */
    style?: StyleProp<ViewStyle>;
    /** 测试标识（RN 里 `className` 的对应物） */
    testID?: string;
}

/**
 * 实心 / 虚线类。Web 版用的是 CSS `linear-gradient(...) repeat-x` 做破折线，
 * RN 没有 repeating-gradient，改用 react-native-svg 的 `strokeDasharray` 复刻：
 *   dashed-brown: `12px 周期 / 6px 实 + 6px 空 / 2px 粗` → dasharray "6 6", strokeWidth 2
 *   hairline:     `6px 周期 / 3px 实 + 3px 空 / 1px 粗` → dasharray "3 3", strokeWidth 1
 *   thin:         纯实心 1px
 */
const LINE_SPEC = {
    'dashed-brown': { height: 12, stroke: '#c4b89e', strokeWidth: 2, dash: '6 6' },
    thin: { height: 1, stroke: '#e8dec7', strokeWidth: 1, dash: undefined },
    hairline: { height: 1, stroke: '#d5c3a2', strokeWidth: 1, dash: '3 3' },
} as const;

/**
 * 波浪类。SVG path 原样搬自 Web 版的 data-URI，按 `tileWidth` 平铺
 * （等价于 CSS 的 `background-repeat: repeat-x`）。
 */
const TILE_SPEC = {
    'wave-yellow': {
        height: 14,
        tileWidth: 40,
        stroke: '#f5d04a',
        strokeWidth: 2.5,
        path: 'M0 7 Q10 0 20 7 T40 7',
    },
    squiggle: {
        height: 10,
        tileWidth: 120,
        stroke: '#19c8b9',
        strokeWidth: 5,
        path: 'M0 2.5 C 30 2.5, 30 7.5, 60 7.5 C 90 7.5, 90 2.5, 120 2.5',
    },
} as const;

export const Divider: React.FC<DividerProps> = ({
    type = 'dashed-brown',
    icon,
    iconSize = 24,
    iconGap = 8,
    style,
    testID,
}) => {
    const [width, setWidth] = useState(0);
    const onLayout = useCallback((e: LayoutChangeEvent) => {
        setWidth(e.nativeEvent.layout.width);
    }, []);

    // ---- 图标模式：图标 + 连接线循环铺满 ----
    // Web 版靠 ResizeObserver + clientWidth；RN 用 onLayout（尺寸变化时同样会回调）
    if (icon) {
        const cycleWidth = iconSize + iconGap;
        // 与 Web 版一致：未测量到宽度前先渲染 1 个周期，避免首帧空白。
        const cycles = width > 0 ? Math.max(1, Math.floor(width / cycleWidth)) : 1;
        return (
            <View style={[styles.iconDivider, style]} onLayout={onLayout} testID={testID} aria-hidden>
                {Array.from({ length: cycles }).map((_, c) => (
                    <View key={c} style={styles.iconCycle}>
                        {icon}
                        {c < cycles - 1 && (
                            <View style={[styles.iconGap, { width: iconGap }]}>
                                <View style={styles.iconLine} />
                            </View>
                        )}
                    </View>
                ))}
            </View>
        );
    }

    // ---- 波浪类 ----
    if (type === 'wave-yellow' || type === 'squiggle') {
        const spec = TILE_SPEC[type];
        const count = width > 0 ? Math.ceil(width / spec.tileWidth) : 0;
        return (
            <View
                style={[styles.divider, { height: spec.height }, style]}
                onLayout={onLayout}
                testID={testID}
                aria-hidden
            >
                {count > 0 && (
                    <Svg width={width} height={spec.height}>
                        {Array.from({ length: count }).map((_, i) => (
                            <Path
                                key={i}
                                d={spec.path}
                                fill="none"
                                stroke={spec.stroke}
                                strokeWidth={spec.strokeWidth}
                                strokeLinecap="round"
                                transform={`translate(${i * spec.tileWidth}, 0)`}
                            />
                        ))}
                    </Svg>
                )}
            </View>
        );
    }

    // ---- 实心 / 虚线类 ----
    const spec = LINE_SPEC[type];
    return (
        <View style={[styles.divider, { height: spec.height }, style]} onLayout={onLayout} testID={testID} aria-hidden>
            {width > 0 && (
                <Svg width={width} height={spec.height}>
                    <Line
                        x1={0}
                        y1={spec.height / 2}
                        x2={width}
                        y2={spec.height / 2}
                        stroke={spec.stroke}
                        strokeWidth={spec.strokeWidth}
                        strokeDasharray={spec.dash}
                    />
                </Svg>
            )}
        </View>
    );
};

Divider.displayName = 'Divider';

const styles = StyleSheet.create({
    divider: {
        width: '100%',
    },
    iconDivider: {
        flexDirection: 'row',
        width: '100%',
        overflow: 'hidden',
        alignItems: 'center',
        minHeight: 20,
    },
    iconCycle: {
        flexDirection: 'row',
        flexGrow: 0,
        flexShrink: 0,
        alignItems: 'center',
    },
    iconGap: {
        flexGrow: 0,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconLine: {
        width: 4,
        height: 2,
        backgroundColor: '#c4b89e',
    },
});
