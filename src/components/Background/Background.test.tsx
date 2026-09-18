/// <reference types="node" />
import React from 'react';
import { View, processColor } from 'react-native';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react-native';
import { Background, type BackgroundType } from './Background';
import { BACKGROUND_PATTERN_SPEC, SCENE_BASE_COLOR } from './patterns';
import type { TestInstance } from 'test-renderer';

/**
 * RN 版测试，对应 Web 版 `Background.test.tsx` 的 7 个用例。
 *
 * **被丢弃 / 改写的 Web 用例**：
 *   - 「根节点带 `className`（`styles.background` / `styles['bg-*']`）」—— RN 无类名系统。
 *     改写为断言**等价的可观测结果**：根 `View` 的 `backgroundColor`（= CSS `background`
 *     简写里最后那个颜色）+ 图案层里真实的 pattern 几何（尺寸 / 点阵 / 线色）。
 *   - `className` 透传 —— RN 无 className（保留 `style` / `testID` 断言）。
 *   - 「`type=sweet-corner` 时 `style.backgroundImage` 的 url 里含 `sweet-corner.svg`」
 *     —— RN 没有 URL（没有 svg loader、没有 CSS 背景），这条**没有直接对应物**。
 *     改写为一条更强的检查：场景组件真的被渲染出来了，且渲染出的 `<Use>` 数量
 *     与源 `.svg` 里 `<use>` 的数量**逐一相等**（证明整棵 SVG 树都转过去了、没漏节点）。
 *     两张图的 `<use>` 数量不同（2100 vs 408），所以这条同时钉住了「type 映射到了正确的图」。
 *   - 上游 `BackgroundProps extends React.HTMLAttributes<HTMLDivElement>` 的 `{...rest}`
 *     DOM 属性透传（`onClick` / `id` / `data-*` …）—— RN 没有 DOM 属性，整块丢弃。
 *
 * **新增的 RN 专有覆盖**：图案层 `pointerEvents="none"` + `aria-hidden`（补回
 * 「CSS 背景不拦触摸、不进无障碍树」）、18 种 type 的渲染冒烟、sprinkles 三层 tile 的
 * 偏移/尺寸/绘制顺序、`<Svg>` 根节点上 `preserveAspectRatio` 的分解结果。
 *
 * **宿主 props 的真实形状**（实测，非推断 —— 写断言前务必知道）：
 *   - `react-native-svg` 把 `fill` / `stroke` **预处理**掉了：纯色变成
 *     `{ type: 0, payload: processColor(...) }`，`url(#x)` 变成
 *     `{ type: 1, brushRef: 'x' }`，`fill="none"` 变成 `null`。
 *     所以颜色断言要用 `processColor()` 比对，不能直接比字符串。
 *   - `<Stop>` 不产生宿主节点，会被折进 `<LinearGradient>` 的 `gradient` 扁平数组
 *     （`[offset, color, offset, color, …]`）。
 *   - `preserveAspectRatio` 不落到宿主上，而是被拆成 `align` + `meetOrSlice`
 *     （`slice` = 1）。`viewBox` 被拆成 `minX/minY/vbWidth/vbHeight`。
 *   - `<Use href="#b">` 的 `#` 被去掉，宿主上是 `href: 'b'`。
 *   - 根 `<Svg>` 在宿主侧是 `RNSVGSvgView`，其下还有一层 `RNSVGGroup` 包装。
 *
 * **注意 RNTL 的查询限制**：图案层带 `aria-hidden`，RNTL 默认把「对无障碍隐藏」的
 * 子树排除在查询之外，所以查层内节点要显式带 `includeHiddenElements: true`。
 *
 * **测不到的**：pattern 是否**真的平铺**、`meetOrSlice` 的实际裁切效果、以及一切视觉
 * 效果 —— 测试渲染器里没有原生布局与绘制。这里只能断言「属性已按预期传到宿主节点」，
 * 真实观感必须在真机 / 模拟器上确认。
 */
const HIDDEN = { includeHiddenElements: true } as const;

const child = (node: unknown) => node as TestInstance;

/** 深度遍历宿主树，收集所有 `type` 等于给定名字的节点 */
const collect = (node: TestInstance, type: string): TestInstance[] => {
    const found: TestInstance[] = [];
    const walk = (n: TestInstance) => {
        if (n.type === type) found.push(n);
        for (const c of n.children) {
            if (typeof c !== 'string') walk(c as TestInstance);
        }
    };
    walk(node);
    return found;
};

const count = (node: TestInstance, type: string) => collect(node, type).length;

/** 读源 `.svg`，数出其中 `<use>` 的个数（用于校验转换完整性） */
const assetUseCount = (file: string) => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'image', file), 'utf8');
    return (svg.match(/<use /g) ?? []).length;
};

/** 取根 View 上展开后的样式对象 */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** 纯色 brush 的宿主形态（react-native-svg 预处理后的结果） */
const solid = (color: string) => ({ type: 0, payload: processColor(color) });

describe('Background', () => {
    it('默认 type=default：底色为奶油色，图案层是「1 个大点 + 9 个小点」的 28px 波点', async () => {
        const { getByTestId } = await render(<Background testID="bg" />);
        // 根 View 的底色 = CSS `background` 简写里最后那个 rgb(247,243,223)
        expect(getByTestId('bg')).toHaveStyle({ backgroundColor: '#f7f3df' });

        const pattern = getByTestId('bg-pattern', HIDDEN);
        expect(pattern.type).toBe('RNSVGSvgView');

        // 一个 28×28 的 pattern，把 CSS 的两层波点（28px 大点 + 14px 小点）合成一层
        const patterns = collect(pattern, 'RNSVGPattern');
        expect(patterns).toHaveLength(1);
        expect(patterns[0].props).toMatchObject({
            name: 'animal-bg-pattern',
            width: 28,
            height: 28,
            patternUnits: 1, // userSpaceOnUse
        });

        const circles = collect(pattern, 'RNSVGCircle');
        expect(circles).toHaveLength(10); // 9 个小点 + 1 个大点
        const big = circles.filter((c) => c.props.r === 1.5);
        const small = circles.filter((c) => c.props.r === 1);
        expect(big).toHaveLength(1);
        expect(big[0].props).toMatchObject({ cx: 14, cy: 14, fill: solid('rgba(196, 184, 158, 0.15)') });
        expect(small).toHaveLength(9);
        // 14px 方格点阵：3×3 个格点（tile 边缘的点与相邻 tile 重合，视觉无差别）
        expect(small.map((c) => `${c.props.cx},${c.props.cy}`)).toEqual([
            '0,0',
            '0,14',
            '0,28',
            '14,0',
            '14,14',
            '14,28',
            '28,0',
            '28,14',
            '28,28',
        ]);
        expect(small.every((c) => c.props.fill.payload === processColor('rgba(196, 184, 158, 0.1)'))).toBe(true);

        // 铺满父容器的 rect 用这个 pattern 填色
        const rects = collect(pattern, 'RNSVGRect');
        expect(rects).toHaveLength(1);
        expect(rects[0].props).toMatchObject({
            width: '100%',
            height: '100%',
            fill: { type: 1, brushRef: 'animal-bg-pattern' },
        });
    });

    it('支持 type=sprinkles：三层互质 tile（3 个 pattern / 18 根糖针 / 36 个 rect）', async () => {
        const { getByTestId } = await render(<Background type="sprinkles" testID="bg" />);
        expect(getByTestId('bg')).toHaveStyle({ backgroundColor: '#fdf3e3' });

        const layer = getByTestId('bg-pattern', HIDDEN);

        const patterns = collect(layer, 'RNSVGPattern');
        expect(patterns).toHaveLength(3);
        // tile 尺寸 = CSS 的 background-size，x/y = background-position
        expect(patterns.map((p) => p.props.name)).toEqual([
            'animal-bg-pattern-a',
            'animal-bg-pattern-b',
            'animal-bg-pattern-c',
        ]);
        expect(patterns.map((p) => [p.props.x, p.props.y, p.props.width, p.props.height])).toEqual([
            [0, 0, 190, 170],
            [45, 30, 230, 195],
            [90, 60, 255, 215],
        ]);

        // 每根糖针都是一个带 transform 的 <g>（matrix 是 6 元列主序矩阵）；
        // 根 <Svg> 自带的那层 RNSVGGroup 没有 matrix，所以按 matrix 过滤正好 18 根。
        const sprinkleGroups = collect(layer, 'RNSVGGroup').filter((g) => Array.isArray(g.props.matrix));
        expect(sprinkleGroups).toHaveLength(18);
        expect(sprinkleGroups.every((g) => g.props.matrix.length === 6)).toBe(true);

        // 36 根胶囊 rect（底色 + 高光）+ 3 个铺满的 pattern 填色 rect
        const rects = collect(layer, 'RNSVGRect');
        expect(rects).toHaveLength(39);
        expect(rects.filter((r) => r.props.rx != null)).toHaveLength(36);

        // 三份高光渐变（上游 data-URI 里都叫 id='s'，同一个 Svg 内必须拆开）；
        // <Stop> 不产生宿主节点，被折进 gradient 扁平数组 = 3 stop × (offset, color)
        const gradients = collect(layer, 'RNSVGLinearGradient');
        expect(gradients.map((g) => g.props.name)).toEqual([
            'animal-bg-sprinkle-a',
            'animal-bg-sprinkle-b',
            'animal-bg-sprinkle-c',
        ]);
        for (const g of gradients) {
            expect(g.props.gradientUnits).toBe(0); // objectBoundingBox（= SVG 默认值）
            expect(g.props.gradient).toHaveLength(6);
            expect(g.props.gradient.filter((_: number, i: number) => i % 2 === 0)).toEqual([0, 0.45, 1]);
        }

        // CSS 里 A 在最上层 → 绘制顺序倒过来（C、B、A）
        const fills = rects.filter((r) => r.props.rx == null).map((r) => r.props.fill);
        expect(fills).toEqual([
            { type: 1, brushRef: 'animal-bg-pattern-c' },
            { type: 1, brushRef: 'animal-bg-pattern-b' },
            { type: 1, brushRef: 'animal-bg-pattern-a' },
        ]);
    });

    it('支持 type=grid（24px 网格，1px 线色 #c4b89e）', async () => {
        const { getByTestId } = await render(<Background type="grid" testID="bg" />);
        expect(getByTestId('bg')).toHaveStyle({ backgroundColor: '#f7f3df' });

        const layer = getByTestId('bg-pattern', HIDDEN);
        const patterns = collect(layer, 'RNSVGPattern');
        expect(patterns).toHaveLength(1);
        expect(patterns[0].props).toMatchObject({ width: 24, height: 24, patternUnits: 1 });

        // CSS 的两条 linear-gradient → tile 的上边 + 左边各一条 1px 实线
        const paths = collect(layer, 'RNSVGPath');
        expect(paths).toHaveLength(1);
        expect(paths[0].props).toMatchObject({
            d: 'M0 0.5 H24 M0.5 0 V24',
            stroke: solid('#c4b89e'),
            strokeWidth: 1,
            fill: null, // fill="none"
        });
    });

    it('支持 type=dots-dark-green（深绿波点）与 dots-* 底色对应 Card pattern 系列', async () => {
        const { getByTestId } = await render(<Background type="dots-dark-green" testID="bg" />);
        expect(getByTestId('bg')).toHaveStyle({ backgroundColor: '#bfe3bf' });
        const green = collect(getByTestId('bg-pattern', HIDDEN), 'RNSVGCircle').map((c) => c.props.fill.payload);
        expect(green).toContain(processColor('rgba(90, 160, 90, 0.22)'));
        expect(green).toContain(processColor('rgba(140, 200, 140, 0.15)'));

        const { getByTestId: getPink } = await render(<Background type="dots-pink" testID="bg" />);
        expect(getPink('bg')).toHaveStyle({ backgroundColor: '#fde4e8' });
        const pink = collect(getPink('bg-pattern', HIDDEN), 'RNSVGCircle').map((c) => c.props.fill.payload);
        expect(pink).toContain(processColor('rgba(248, 166, 178, 0.18)'));
    });

    it('场景图按 cover 铺满：底色 #fdf3e3 + preserveAspectRatio=xMidYMid slice，且整棵 SVG 树完整渲染', async () => {
        const { getByTestId } = await render(<Background type="sweet-corner" testID="bg" />);
        expect(getByTestId('bg')).toHaveStyle({ backgroundColor: SCENE_BASE_COLOR });

        const layer = getByTestId('bg-layer', HIDDEN);
        const svgs = collect(layer, 'RNSVGSvgView');
        expect(svgs).toHaveLength(1);
        // Web 版这里是 `background-size: cover; background-position: center`
        // → viewBox 拆成 minX/minY/vbWidth/vbHeight，preserveAspectRatio 拆成 align + meetOrSlice
        expect(svgs[0].props).toMatchObject({
            width: '100%',
            height: '100%',
            minX: 0,
            minY: 0,
            vbWidth: 2560,
            vbHeight: 1440,
            align: 'xMidYMid',
            meetOrSlice: 1, // slice = cover
        });
        // 场景图类型不再渲染 Background 自己的图案层（场景图内部自带一个点纹 pattern，
        // 所以不能简单断言「没有 pattern」，而是断言没有 Background 的那个 pattern id）
        expect(collect(layer, 'RNSVGPattern').some((p) => p.props.name === 'animal-bg-pattern')).toBe(false);

        // 转换完整性：渲染出的 <Use> 数量 == 源 .svg 里 <use> 的数量
        const uses = count(layer, 'RNSVGUse');
        expect(uses).toBe(assetUseCount('sweet-corner.svg'));
        expect(uses).toBeGreaterThan(0);
        // href 的 `#` 被 react-native-svg 去掉了
        expect(collect(layer, 'RNSVGUse').every((u) => !String(u.props.href).startsWith('#'))).toBe(true);

        const { getByTestId: getCoffee } = await render(<Background type="coffee-break" testID="bg" />);
        const coffeeLayer = getCoffee('bg-layer', HIDDEN);
        expect(getCoffee('bg')).toHaveStyle({ backgroundColor: SCENE_BASE_COLOR });
        const coffeeUses = count(coffeeLayer, 'RNSVGUse');
        expect(coffeeUses).toBe(assetUseCount('coffee-break.svg'));
        // 两张图确实是不同的资源（<use> 数量级不同），不是渲染了同一个组件
        expect(coffeeUses).not.toBe(uses);
    });

    it('渲染 children 于背景之上', async () => {
        const { getByTestId } = await render(
            <Background testID="bg">
                <View testID="content" />
            </Background>
        );
        expect(getByTestId('content')).toBeTruthy();
        // 背景层是第一个子节点，children 在其后（= 叠在上面）
        const root = getByTestId('bg');
        expect(child(root.children[0]).props.testID).toBe('bg-layer');
        expect(child(root.children[1]).props.testID).toBe('content');
    });

    it('应用 style 与 testID', async () => {
        const { getByTestId } = await render(<Background testID="bg" style={{ height: 100 }} />);
        const root = getByTestId('bg');
        expect(root).toHaveStyle({ height: 100 });
        // 基础样式：CSS `.background { width: 100%; min-height: 100% }`
        expect(root).toHaveStyle({ width: '100%', minHeight: '100%' });
    });

    // ---------- RN 专有 ----------

    it('图案层不拦触摸、不进无障碍树（对应「CSS 背景不参与命中测试」）', async () => {
        const { getByTestId, queryByTestId } = await render(<Background testID="bg" />);
        const layer = getByTestId('bg-layer', HIDDEN);
        expect(layer.props.pointerEvents).toBe('none');
        // jest preset 把 View 整个 mock 掉了，所以这里看到的是**原始** aria-hidden
        // （真机上 View.js 会把它改写成 accessibilityElementsHidden + importantForAccessibility）
        expect(layer.props['aria-hidden']).toBe(true);

        // 反证 aria-hidden 生效：不带 includeHiddenElements 时查不到图案层
        expect(queryByTestId('bg-layer')).toBeNull();
        expect(queryByTestId('bg-pattern')).toBeNull();
    });

    it('全部 18 种 type 都能渲染，且根节点都有底色', async () => {
        const types: BackgroundType[] = [
            'default',
            'grid',
            'dots-dark-green',
            'sprinkles',
            'sweet-corner',
            'coffee-break',
            'dots-pink',
            'dots-purple',
            'dots-blue',
            'dots-yellow',
            'dots-orange',
            'dots-teal',
            'dots-green',
            'dots-red',
            'dots-lime-green',
            'dots-yellow-green',
            'dots-brown',
            'dots-warm-peach-pink',
        ];
        expect(types).toHaveLength(18);

        for (const type of types) {
            const { getByTestId, unmount } = await render(<Background type={type} testID="bg" />);
            const bg = styleOf(getByTestId('bg')).backgroundColor;
            expect(typeof bg).toBe('string');
            if (type === 'sweet-corner' || type === 'coffee-break') expect(bg).toBe(SCENE_BASE_COLOR);
            expect(getByTestId('bg-layer', HIDDEN)).toBeTruthy();
            await unmount();
        }
    });

    it('16 个图案类在 spec 表里都有条目（type 与 spec 不会脱节）', () => {
        const patternTypes = Object.keys(BACKGROUND_PATTERN_SPEC);
        expect(patternTypes).toHaveLength(16);
        expect(patternTypes).not.toContain('sweet-corner');
        expect(patternTypes).not.toContain('coffee-break');
        for (const key of patternTypes) {
            expect(typeof BACKGROUND_PATTERN_SPEC[key as keyof typeof BACKGROUND_PATTERN_SPEC].base).toBe('string');
        }
    });

    it('children 可选：不传时只有背景层一个子节点', async () => {
        const { getByTestId } = await render(<Background testID="bg" />);
        expect(getByTestId('bg').children).toHaveLength(1);
    });
});
