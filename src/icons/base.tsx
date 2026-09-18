/**
 * RN 图标基础件。
 *
 * 上游 Web 版用 `naive-icons`（一个 **DOM-only** 的 SVG 图标库，直接渲染
 * `<svg>` 元素），RN 里用不了。这里用 `react-native-svg` 复刻。
 *
 * 路径数据取自 `naive-icons@1.0.3`（**MIT**，见其 LICENSE），
 * 只搬运本库自身实际用到的图标（全库仅 3 个：Donut / Fish / Image）。
 *
 * 与上游 `normalizeIconProps` 的默认值保持一致：
 *   size = 24、color = '#2A2A2A'、strokeWidth = 3.5、fill = 'none'，
 *   且 `stroke` 是设在 **SVG 根节点**上、由子元素继承的 —— 这一点很关键：
 *   Web 版 Button 传 `color="currentColor"`，在 loading 态按钮 `color: #fff`
 *   的上下文里，甜甜圈的描边实际是**白色**。所以 RN 版必须把 color 透传下去，
 *   不能写死深色。
 */
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Svg } from 'react-native-svg';

/** naive 风格调色板（取自 naive-icons 的 NAIVE_PALETTE，MIT） */
export const naivePalette = {
    ink: '#2A2A2A',
    navy: '#264653',
    orange: '#E76F51',
    yellow: '#E9C46A',
    pink: '#F4A6A4',
    green: '#588157',
    teal: '#2A9D8F',
    brown: '#8B5E3C',
    cream: '#FAEDCD',
} as const;

export interface IconProps {
    /** 图标尺寸（宽高相同），默认 24 */
    size?: number;
    /** 描边色，默认 `naivePalette.ink`；会作为 `stroke` 设在根节点上被子元素继承 */
    color?: string;
    /** 描边粗细，默认 3.5 */
    strokeWidth?: number;
    /** 根节点填充色，默认 `'none'`（各子元素自带 fill） */
    fill?: string;
    /** 自定义样式 */
    style?: StyleProp<ViewStyle>;
    /** 测试标识 */
    testID?: string;
}

/** 所有图标共用的 48×48 画布与根节点属性 */
export const BaseIcon: React.FC<IconProps & { children: React.ReactNode }> = ({
    size = 24,
    color = naivePalette.ink,
    strokeWidth = 3.5,
    fill = 'none',
    style,
    testID,
    children,
}) => (
    <Svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill={fill}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        testID={testID}
    >
        {children}
    </Svg>
);
