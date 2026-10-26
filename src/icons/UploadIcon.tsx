// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Path, Rect } from 'react-native-svg';
import { BaseIcon, naivePalette, scaledStroke, type IconProps } from './base';

export const UploadIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M24 16 L24 40" stroke={naivePalette.ink} strokeWidth={scaledStroke(props.strokeWidth, 4)} />
        <Path d="M14 24 L24 14 L34 24" fill={naivePalette.orange} />
        <Rect x={8} y={38} width={32} height={6} rx={2} fill={naivePalette.teal} />
    </BaseIcon>
);

UploadIcon.displayName = 'UploadIcon';
