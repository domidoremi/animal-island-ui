// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const RocketIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M18 32 L24 42.5 L30 32 Z" fill={naivePalette.orange} />
        <Path d="M24 6 C 16 6 14 16 14 25 L 14 34 L 34 34 L 34 25 C 34 16 32 6 24 6 Z" fill={naivePalette.cream} />
        <Path d="M14 28 L8 34 L8 40 L14 36 Z" fill={naivePalette.orange} />
        <Path d="M34 28 L40 34 L40 40 L34 36 Z" fill={naivePalette.orange} />
        <Circle cx={24} cy={20} r={5} fill={naivePalette.teal} />
    </BaseIcon>
);

RocketIcon.displayName = 'RocketIcon';
