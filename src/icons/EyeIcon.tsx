// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const EyeIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M5 24 C 11 13 37 13 43 24 C 37 35 11 35 5 24 Z" fill={naivePalette.cream} />
        <Circle cx={24} cy={24} r={6.5} fill={naivePalette.teal} />
        <Circle cx={24} cy={24} r={3} fill={naivePalette.ink} />
        <Circle cx={26} cy={22} r={1.2} fill="#FFFFFF" />
    </BaseIcon>
);

EyeIcon.displayName = 'EyeIcon';
