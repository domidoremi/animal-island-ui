// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, scaledStroke, type IconProps } from './base';

export const CheckIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Circle cx={24} cy={24} r={17} fill={naivePalette.green} />
        <Path
            d="M15 24.5 L21 30.5 L32 18.5"
            stroke="#FFFFFF"
            strokeWidth={scaledStroke(props.strokeWidth, 4.5)}
            fill="none"
        />
    </BaseIcon>
);

CheckIcon.displayName = 'CheckIcon';
