// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const UserIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Circle cx={24} cy={16} r={8.5} fill={naivePalette.orange} />
        <Path d="M7 43 C 7 33 14 29 24 29 C 34 29 41 33 41 43" fill={naivePalette.teal} />
        <Circle cx={21} cy={16} r={1.6} fill={naivePalette.ink} />
        <Circle cx={27} cy={16} r={1.6} fill={naivePalette.ink} />
        <Path d="M20.5 20 Q 24 23 27.5 20" stroke={naivePalette.ink} fill="none" />
    </BaseIcon>
);

UserIcon.displayName = 'UserIcon';
