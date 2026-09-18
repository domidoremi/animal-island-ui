import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

/**
 * Background 的「图案层」—— 上游 Web 版是靠 CSS 的 `background` 简写实现的
 * （`radial-gradient` 平铺 / `linear-gradient` 平铺 / data-URI SVG 平铺），
 * RN 既没有 CSS 背景也没有 repeating-gradient，所以整层改用 `react-native-svg`
 * 的 `<Pattern patternUnits="userSpaceOnUse">` 复刻：一个 pattern = CSS 里的一层
 * `background-image` + `background-size`，pattern 的 `x`/`y` = `background-position`。
 *
 * ⚠️ 本文件里所有颜色 / 尺寸都是**逐字照抄** `background.module.less` 的硬编码值。
 * `src/theme/tokens.ts` 里没有对应条目（上游这 16 种壁纸的颜色本来就不走变量），
 * 所以这里也不硬塞 token。
 */

/**
 * 图案类 type（= 上游 `BackgroundType` 里除两张场景图外的全部）。
 *
 * 顺序与上游 `BackgroundType` 一致，便于对照。
 */
export type BackgroundPatternType =
    | 'default'
    | 'grid'
    | 'dots-dark-green'
    | 'sprinkles'
    | 'dots-pink'
    | 'dots-purple'
    | 'dots-blue'
    | 'dots-yellow'
    | 'dots-orange'
    | 'dots-teal'
    | 'dots-green'
    | 'dots-red'
    | 'dots-lime-green'
    | 'dots-yellow-green'
    | 'dots-brown'
    | 'dots-warm-peach-pink';

export type BackgroundPatternSpec =
    /** 两层错位波点：`strong` 是大点（1.5px / 28px 网格），`weak` 是小点（1px / 14px 网格） */
    | { kind: 'dots'; base: string; strong: string; weak: string }
    /** 24px 网格线 */
    | { kind: 'grid'; base: string; line: string }
    /** 圆柱形彩色针糖（三层互质 tile 平铺） */
    | { kind: 'sprinkles'; base: string };

/**
 * 上游 `background.module.less` 的 16 个图案类，逐个搬过来。
 *
 * 波点类的两条 `radial-gradient(...) 0 0 / 28px 28px` 与 `... 7px 7px / 14px 14px`
 * 在 CSS 里是**两层**；这里合并成**一个** 28×28 的 pattern（见 `DotsPattern`），
 * 视觉完全等价（推导见那里的注释）。
 */
export const BACKGROUND_PATTERN_SPEC: Record<BackgroundPatternType, BackgroundPatternSpec> = {
    default: { kind: 'dots', base: '#f7f3df', strong: 'rgba(196, 184, 158, 0.15)', weak: 'rgba(196, 184, 158, 0.1)' },
    grid: { kind: 'grid', base: '#f7f3df', line: '#c4b89e' },
    'dots-dark-green': {
        kind: 'dots',
        base: '#bfe3bf',
        strong: 'rgba(90, 160, 90, 0.22)',
        weak: 'rgba(140, 200, 140, 0.15)',
    },
    sprinkles: { kind: 'sprinkles', base: '#fdf3e3' },
    'dots-pink': {
        kind: 'dots',
        base: '#fde4e8',
        strong: 'rgba(248, 166, 178, 0.18)',
        weak: 'rgba(255, 200, 210, 0.12)',
    },
    'dots-purple': {
        kind: 'dots',
        base: '#f0e8ff',
        strong: 'rgba(183, 125, 238, 0.18)',
        weak: 'rgba(220, 180, 255, 0.12)',
    },
    'dots-blue': {
        kind: 'dots',
        base: '#e8edff',
        strong: 'rgba(136, 157, 240, 0.18)',
        weak: 'rgba(180, 195, 255, 0.12)',
    },
    'dots-yellow': {
        kind: 'dots',
        base: '#fff8e0',
        strong: 'rgba(247, 205, 103, 0.18)',
        weak: 'rgba(255, 230, 160, 0.12)',
    },
    'dots-orange': {
        kind: 'dots',
        base: '#fff0e8',
        strong: 'rgba(229, 146, 102, 0.18)',
        weak: 'rgba(255, 190, 150, 0.12)',
    },
    'dots-teal': {
        kind: 'dots',
        base: '#e8faf5',
        strong: 'rgba(130, 213, 187, 0.18)',
        weak: 'rgba(170, 235, 210, 0.12)',
    },
    'dots-green': {
        kind: 'dots',
        base: '#e8f5e8',
        strong: 'rgba(138, 198, 138, 0.18)',
        weak: 'rgba(180, 220, 180, 0.12)',
    },
    'dots-red': {
        kind: 'dots',
        base: '#ffe8e8',
        strong: 'rgba(252, 115, 109, 0.18)',
        weak: 'rgba(255, 160, 155, 0.12)',
    },
    'dots-lime-green': {
        kind: 'dots',
        base: '#f5f8e0',
        strong: 'rgba(209, 218, 73, 0.18)',
        weak: 'rgba(230, 240, 130, 0.12)',
    },
    'dots-yellow-green': {
        kind: 'dots',
        base: '#fffde8',
        strong: 'rgba(236, 223, 82, 0.18)',
        weak: 'rgba(255, 245, 140, 0.12)',
    },
    'dots-brown': {
        kind: 'dots',
        base: '#f5f0e0',
        strong: 'rgba(154, 131, 90, 0.18)',
        weak: 'rgba(190, 165, 120, 0.12)',
    },
    'dots-warm-peach-pink': {
        kind: 'dots',
        base: '#fff0e8',
        strong: 'rgba(225, 140, 111, 0.18)',
        weak: 'rgba(255, 185, 160, 0.12)',
    },
};

/** `.bg-sweet-corner` / `.bg-coffee-break` 的 `background-color` */
export const SCENE_BASE_COLOR = '#fdf3e3';

/** pattern 的 id。每个 `<Svg>` 自成命名空间，所以固定 id 不会互相串。 */
const PATTERN_ID = 'animal-bg-pattern';

/**
 * 波点的两套格子。
 *
 * CSS 原式（以 default 为例）：
 *   radial-gradient(circle, rgba(196,184,158,.15) 1.5px, transparent 1.5px) 0 0 / 28px 28px,
 *   radial-gradient(circle, rgba(196,184,158,.1)  1px,   transparent 1px)   7px 7px / 14px 14px,
 *   rgb(247,243,223)
 *
 * 第 1 层：28×28 的 tile、左上角贴 (0,0)，点落在 tile 中心 → 绝对坐标 (14+28i, 14+28j)。
 * 第 2 层：14×14 的 tile、左上角贴 (7,7)，点落在 tile 中心 → 绝对坐标 (14+14i, 14+14j)，
 *        也就是一条**完整的 14px 方格点阵**（含 (0,0)、(14,0)、(28,0)…）。
 *
 * 两层都是 14px 点阵的周期性图案，所以可以用**一个 28×28 的 pattern** 精确表示：
 * 在 tile 内画满 3×3 个 14px 格点（大点覆盖中心那一个）。tile 边缘的点会被相邻
 * tile 重复绘制，但位置完全重合，视觉无差别。
 */
const DOT_LATTICE = [0, 14, 28] as const;

const DotsPattern: React.FC<{ id: string; spec: Extract<BackgroundPatternSpec, { kind: 'dots' }> }> = ({
    id,
    spec,
}) => (
    <Pattern id={id} width={28} height={28} patternUnits="userSpaceOnUse">
        {/* 第 2 层（弱）：1px 小点，14px 方格点阵 */}
        {DOT_LATTICE.map((cx) =>
            DOT_LATTICE.map((cy) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1} fill={spec.weak} />)
        )}
        {/* 第 1 层（强）：1.5px 大点，压在 28px 网格的中心上 */}
        <Circle cx={14} cy={14} r={1.5} fill={spec.strong} />
    </Pattern>
);

const GridPattern: React.FC<{ id: string; spec: Extract<BackgroundPatternSpec, { kind: 'grid' }> }> = ({
    id,
    spec,
}) => (
    // CSS: linear-gradient(#c4b89e 1px, transparent 1px) + linear-gradient(90deg, …) / 24px 24px
    // → tile 的**上边**与**左边**各一条 1px 实线。线宽 1，所以线心放在 0.5 才不会被 tile 边界裁掉一半。
    <Pattern id={id} width={24} height={24} patternUnits="userSpaceOnUse">
        <Path d="M0 0.5 H24 M0.5 0 V24" stroke={spec.line} strokeWidth={1} fill="none" />
    </Pattern>
);

/** 一根糖针：底色胶囊 + 共享的高光渐变胶囊（原 SVG 是两个共用 transform 的 `<rect>`） */
type SprinkleItem = {
    x: number;
    y: number;
    angle: number;
    w: number;
    h: number;
    fill: string;
};

/**
 * 三层互质 tile，逐字搬自 `background.module.less` 的 `.bg-sprinkles`。
 * 每层的 `offset` 就是 CSS 里的 `background-position`，也就是 pattern 的 `x`/`y`。
 */
const SPRINKLE_TILES: ReadonlyArray<{
    key: 'a' | 'b' | 'c';
    /** tile 尺寸 = `background-size` */
    width: number;
    height: number;
    /** tile 起点 = `background-position` */
    offsetX: number;
    offsetY: number;
    items: ReadonlyArray<SprinkleItem>;
}> = [
    {
        key: 'a',
        width: 190,
        height: 170,
        offsetX: 0,
        offsetY: 0,
        items: [
            { x: 18, y: 26, angle: 24, w: 17, h: 4.6, fill: '#f8a6b2' },
            { x: 120, y: 32, angle: -38, w: 15, h: 4.4, fill: '#f5d04a' },
            { x: 72, y: 76, angle: 76, w: 14, h: 4.2, fill: '#8ecae6' },
            { x: 148, y: 108, angle: 12, w: 18, h: 4.8, fill: '#95d5b2' },
            { x: 30, y: 128, angle: -55, w: 15, h: 4.4, fill: '#f4a261' },
            { x: 104, y: 148, angle: 100, w: 13, h: 4.2, fill: '#c9a7f5' },
        ],
    },
    {
        key: 'b',
        width: 230,
        height: 195,
        offsetX: 45,
        offsetY: 30,
        items: [
            { x: 26, y: 30, angle: -15, w: 16, h: 4.6, fill: '#95d5b2' },
            { x: 142, y: 22, angle: 52, w: 14, h: 4.2, fill: '#f8a6b2' },
            { x: 198, y: 68, angle: -70, w: 15, h: 4.4, fill: '#f5d04a' },
            { x: 60, y: 98, angle: 33, w: 17, h: 4.6, fill: '#c9a7f5' },
            { x: 168, y: 128, angle: -8, w: 16, h: 4.6, fill: '#8ecae6' },
            { x: 96, y: 162, angle: 118, w: 14, h: 4.2, fill: '#f4a261' },
        ],
    },
    {
        key: 'c',
        width: 255,
        height: 215,
        offsetX: 90,
        offsetY: 60,
        items: [
            { x: 30, y: 26, angle: 65, w: 16, h: 4.6, fill: '#f4a261' },
            { x: 152, y: 38, angle: -30, w: 15, h: 4.4, fill: '#c9a7f5' },
            { x: 222, y: 88, angle: 15, w: 17, h: 4.8, fill: '#f8a6b2' },
            { x: 82, y: 118, angle: -95, w: 14, h: 4.2, fill: '#f5d04a' },
            { x: 186, y: 158, angle: 48, w: 15, h: 4.4, fill: '#95d5b2' },
            { x: 42, y: 184, angle: 10, w: 16, h: 4.6, fill: '#8ecae6' },
        ],
    },
];

/** 上游三份 data-URI 里的 `id='s'`；同一个 `<Svg>` 内 id 必须唯一，所以按 tile 拆开 */
const sprinkleGradientId = (key: 'a' | 'b' | 'c') => `animal-bg-sprinkle-${key}`;

/**
 * 原式：
 *   <linearGradient id='s' x1='0' y1='0' x2='0' y2='1'>
 *     <stop offset='0'   stop-color='#fff' stop-opacity='.55'/>
 *     <stop offset='.45' stop-color='#fff' stop-opacity='0'/>
 *     <stop offset='1'   stop-color='#000' stop-opacity='.25'/>
 *   </linearGradient>
 * `gradientUnits` 不写 = objectBoundingBox（react-native-svg 的默认值也是它），
 * 所以 x1/y1/x2/y2 的 0/1 就是 0%/100%，与 SVG 语义一致。
 */
const SprinkleGradients: React.FC = () => (
    <>
        {SPRINKLE_TILES.map((tile) => (
            <LinearGradient key={tile.key} id={sprinkleGradientId(tile.key)} x1={0} y1={0} x2={0} y2={1}>
                <Stop offset={0} stopColor="#fff" stopOpacity={0.55} />
                <Stop offset={0.45} stopColor="#fff" stopOpacity={0} />
                <Stop offset={1} stopColor="#000" stopOpacity={0.25} />
            </LinearGradient>
        ))}
    </>
);

const Sprinkle: React.FC<{ item: SprinkleItem; gradientId: string }> = ({ item, gradientId }) => (
    <G transform={`translate(${item.x} ${item.y}) rotate(${item.angle})`}>
        {/* 原 SVG 里 rx 恒等于 h / 2（4.6→2.3、4.4→2.2、4.2→2.1、4.8→2.4），这里直接算 */}
        <Rect width={item.w} height={item.h} rx={item.h / 2} fill={item.fill} />
        <Rect width={item.w} height={item.h} rx={item.h / 2} fill={`url(#${gradientId})`} />
    </G>
);

const SprinklesDefs: React.FC = () => (
    <>
        {SPRINKLE_TILES.map((tile) => (
            <Pattern
                key={tile.key}
                id={`${PATTERN_ID}-${tile.key}`}
                x={tile.offsetX}
                y={tile.offsetY}
                width={tile.width}
                height={tile.height}
                patternUnits="userSpaceOnUse"
            >
                {tile.items.map((item, i) => (
                    <Sprinkle key={i} item={item} gradientId={sprinkleGradientId(tile.key)} />
                ))}
            </Pattern>
        ))}
    </>
);

export interface BackgroundPatternLayerProps {
    spec: BackgroundPatternSpec;
    /** 测试标识 */
    testID?: string;
}

/**
 * 图案层本体：一个铺满父容器的 `<Svg>`，里面只有一个填满的 `<Rect>`（用 pattern 填色）。
 *
 * 底色（`base`）**不在这里画** —— 它由 `Background` 直接设在根 View 的
 * `backgroundColor` 上，对应 CSS `background` 简写里最后那个颜色。
 */
export const BackgroundPatternLayer: React.FC<BackgroundPatternLayerProps> = ({ spec, testID }) => {
    if (spec.kind === 'dots') {
        return (
            <Svg width="100%" height="100%" testID={testID}>
                <Defs>
                    <DotsPattern id={PATTERN_ID} spec={spec} />
                </Defs>
                <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${PATTERN_ID})`} />
            </Svg>
        );
    }

    if (spec.kind === 'grid') {
        return (
            <Svg width="100%" height="100%" testID={testID}>
                <Defs>
                    <GridPattern id={PATTERN_ID} spec={spec} />
                </Defs>
                <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${PATTERN_ID})`} />
            </Svg>
        );
    }

    // sprinkles：CSS 里 A 在最上层，所以这里**倒序**绘制（C → B → A）
    return (
        <Svg width="100%" height="100%" testID={testID}>
            <Defs>
                <SprinkleGradients />
                <SprinklesDefs />
            </Defs>
            {[...SPRINKLE_TILES].reverse().map((tile) => (
                <Rect key={tile.key} x={0} y={0} width="100%" height="100%" fill={`url(#${PATTERN_ID}-${tile.key})`} />
            ))}
        </Svg>
    );
};

BackgroundPatternLayer.displayName = 'BackgroundPatternLayer';

/**
 * 图案层的外层容器：绝对定位铺满、`pointerEvents="none"`、`aria-hidden`。
 *
 * 对应 Web 版的「根 div 的 CSS 背景」——CSS 背景不参与命中测试、也不进无障碍树，
 * 所以 RN 侧用 `pointerEvents="none"` + `aria-hidden` 把这两点补回来。
 * 场景图（Background 的 sweet-corner / coffee-break）复用同一个容器。
 */
export const BackgroundLayer: React.FC<{ testID?: string; children?: React.ReactNode }> = ({ testID, children }) => (
    <View style={styles.layer} pointerEvents="none" aria-hidden testID={testID}>
        {children}
    </View>
);

BackgroundLayer.displayName = 'BackgroundLayer';

const styles = StyleSheet.create({
    layer: {
        // 等价于 `StyleSheet.absoluteFillObject` —— RN 0.87 的 `types_generated` 只导出了
        // `absoluteFill`（已注册的样式），没有导出 `absoluteFillObject`，所以这里显式写出来。
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
});
