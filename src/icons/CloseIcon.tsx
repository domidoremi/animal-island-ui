// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, scaledStroke, type IconProps } from './base';

export const CloseIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Circle cx={24} cy={24} r={17} fill={naivePalette.cream} />
        <Path d="M17 17 L 31 31" stroke={naivePalette.orange} strokeWidth={scaledStroke(props.strokeWidth, 4.5)} />
        <Path d="M31 17 L 17 31" stroke={naivePalette.orange} strokeWidth={scaledStroke(props.strokeWidth, 4.5)} />
    </BaseIcon>
);

CloseIcon.displayName = 'CloseIcon';
