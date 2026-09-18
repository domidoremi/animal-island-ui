/**
 * ImageIcon —— 图片占位图。Image 组件的加载失败 / 空态用它。
 * 路径取自 naive-icons@1.0.3 `svg/image.svg`（MIT）。
 */
import React from 'react';
import { Circle, Path, Rect } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const ImageIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Rect x={6} y={10} width={36} height={28} rx={3} fill={naivePalette.cream} />
        <Circle cx={16} cy={20} r={3} fill={naivePalette.yellow} />
        <Path d="M10 36 L20 24 L28 32 L36 22 L42 36 Z" fill={naivePalette.teal} />
        <Path d="M10 36 L42 36" stroke={naivePalette.ink} />
    </BaseIcon>
);

ImageIcon.displayName = 'ImageIcon';
