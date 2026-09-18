/**
 * FishIcon —— 小鱼。Collapse 的展开指示器用它。
 * 路径取自 naive-icons@1.0.3 `svg/fish.svg`（MIT）。
 */
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const FishIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M6 24 C 8 14 22 10 30 14 C 38 18 38 30 30 34 C 22 38 8 34 6 24 Z" fill={naivePalette.teal} />
        <Path d="M30 24 L42 14 L42 34 Z" fill={naivePalette.orange} />
        <Circle cx={14} cy={22} r={2} fill="#FFFFFF" />
        <Circle cx={14} cy={22} r={1} fill={naivePalette.ink} />
    </BaseIcon>
);

FishIcon.displayName = 'FishIcon';
