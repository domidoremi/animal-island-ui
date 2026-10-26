/**
 * RN 图标基础件。
 *
 * 上游 Web 版用 `naive-icons`（一个 **DOM-only** 的 SVG 图标库，直接渲染
 * `<svg>` 元素），RN 里用不了。这里用 `react-native-svg` 复刻。
 *
 * Artwork comes from naive-icons 1.0.3 (Donut/Fish/Image) and 1.6.0
 * (User/Close/Upload/Rocket/File/Check/Eye/Star). Only used icons are ported.
 *
 * 与上游 `normalizeIconProps` 的默认值保持一致：
 *   size = 24、color = '#2A2A2A'、strokeWidth = 3.5、fill = 'none'，
 *   且 `stroke` 是设在 **SVG 根节点**上、由子元素继承的 —— 这一点很关键：
 *   Web 版 Button 传 `color="currentColor"`，在 loading 态按钮 `color: #fff`
 *   的上下文里，甜甜圈的描边实际是**白色**。所以 RN 版必须把 color 透传下去，
 *   不能写死深色。
 *
 * MIT License
 * Copyright (c) 2026 Naive Icons
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import React from 'react';
import { Platform } from 'react-native';
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

const resolveStrokeWidth = (value?: number) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 3.5;

export const scaledStroke = (value: number | undefined, designed: number): number =>
    Math.round(((designed * resolveStrokeWidth(value)) / 3.5) * 100) / 100;

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
        strokeWidth={resolveStrokeWidth(strokeWidth)}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
        testID={testID}
        accessible={Platform.OS === 'web' ? undefined : false}
        aria-hidden
    >
        {children}
    </Svg>
);
