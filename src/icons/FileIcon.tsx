// Artwork: naive-icons 1.6.0, MIT. Full notice in base.tsx.
import React from 'react';
import { Path } from 'react-native-svg';
import { BaseIcon, naivePalette, scaledStroke, type IconProps } from './base';

export const FileIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M12 6 L12 42 L36 42 L36 18 L24 6 Z" fill={naivePalette.cream} />
        <Path d="M24 6 L24 18 L36 18" fill={naivePalette.pink} />
        <Path d="M16 26 L32 26" stroke={naivePalette.ink} strokeWidth={scaledStroke(props.strokeWidth, 2)} />
        <Path d="M16 32 L28 32" stroke={naivePalette.ink} strokeWidth={scaledStroke(props.strokeWidth, 2)} />
    </BaseIcon>
);

FileIcon.displayName = 'FileIcon';
