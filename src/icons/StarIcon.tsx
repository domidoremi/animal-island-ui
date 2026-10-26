// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const StarIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M24 6 L29 18 L42 19 L32 28 L35 41 L24 34 L13 41 L16 28 L6 19 L19 18 Z" fill={naivePalette.yellow} />
        <Circle cx={20} cy={22} r={1.3} fill={naivePalette.ink} />
        <Circle cx={28} cy={22} r={1.3} fill={naivePalette.ink} />
    </BaseIcon>
);

StarIcon.displayName = 'StarIcon';
