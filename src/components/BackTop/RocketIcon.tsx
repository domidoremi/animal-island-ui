/**
 * RocketIcon —— 返回顶部的火箭。
 *
 * 上游 Web 版是 `import rocketIcon from './rocket.svg'`（Vite 把 svg 当图片 URL，
 * 渲染成 `<img src=... alt="返回顶部">`）。RN 没有 svg 资源导入，按约定改用
 * `react-native-svg` 复刻 `rocket.svg` 的路径 —— 它本来就是 48×48 画布、描边
 * `#2A2A2A` / 3.5 / round，与 `src/icons` 的 `BaseIcon` 默认值完全一致，所以直接复用。
 *
 * `src/icons/` 里没有火箭，所以这个图标放在组件目录内；将来若有第二个组件需要，
 * 再提升到 `src/icons/` 即可。
 */
import React from 'react';
import { Circle, Path } from 'react-native-svg';
import { BaseIcon, naivePalette, type IconProps } from '../../icons';

export const RocketIcon: React.FC<IconProps> = (props) => (
    <BaseIcon {...props}>
        <Path d="M24 6 C 16 6 14 18 14 26 L14 38 L34 38 L34 26 C 34 18 32 6 24 6 Z" fill={naivePalette.cream} />
        <Circle cx={24} cy={22} r={5} fill={naivePalette.teal} />
        <Path d="M14 30 L8 36 L8 42 L14 38" fill={naivePalette.orange} />
        <Path d="M34 30 L40 36 L40 42 L34 38" fill={naivePalette.orange} />
        <Path d="M18 42 L24 46 L30 42" fill={naivePalette.orange} />
    </BaseIcon>
);

RocketIcon.displayName = 'RocketIcon';
