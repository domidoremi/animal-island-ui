/**
 * DonutIcon —— 甜甜圈。Button 的 loading 态用它做旋转指示器。
 * 路径取自 naive-icons@1.0.3 `svg/donut.svg`（MIT）。
 */
import React from 'react';
import { Circle, Rect } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from './base';

export const DonutIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Circle cx={24} cy={24} r={15} fill={naivePalette.pink} />
        <Circle cx={24} cy={24} r={6} fill="#FFFFFF" />
        <Rect x={17} y={13} width={4.5} height={1.8} rx={0.9} transform="rotate(25 19 14)" fill={naivePalette.yellow} />
        <Rect x={27} y={12} width={4.5} height={1.8} rx={0.9} transform="rotate(-20 29 13)" fill={naivePalette.teal} />
        <Rect x={32} y={19} width={4.5} height={1.8} rx={0.9} transform="rotate(45 34 20)" fill={naivePalette.navy} />
        <Rect
            x={13}
            y={22}
            width={4.5}
            height={1.8}
            rx={0.9}
            transform="rotate(-35 15 23)"
            fill={naivePalette.yellow}
        />
        <Rect x={30} y={30} width={4.5} height={1.8} rx={0.9} transform="rotate(15 32 31)" fill={naivePalette.teal} />
        <Rect x={17} y={31} width={4.5} height={1.8} rx={0.9} transform="rotate(60 19 32)" fill={naivePalette.navy} />
    </BaseIcon>
);

DonutIcon.displayName = 'DonutIcon';
