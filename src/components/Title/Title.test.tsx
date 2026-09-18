import React from 'react';
import { processColor } from 'react-native';
import { render } from '@testing-library/react-native';
import { Title, type TitleColor, type TitleSize, type TitleVariant } from './Title';

/**
 * RN 版测试，对应 Web 版 `Title.test.tsx` 的 10 个用例。
 *
 * **被丢弃的 Web 用例及原因**：
 *   - 「应用 className」—— RN 无 className（`style` 部分保留）。
 *   - 所有 `container.querySelector('.' + styles.xxx)` —— RN 没有类名、没有 `querySelector`，
 *     统一改用组件派生的 `testID`（`${testID}-layer` / `-layer-front` / `-tab` / `-tab-text`
 *     / `-ribbon` / `-ribbon-text`，与 Button 的 `${testID}-loading-icon` 同一约定）。
 *   - `color` 的类名断言（`toHaveClass(styles['color-app-pink'])`）—— RN 没有 CSS 变量
 *     `--rf/--rb/--rk/--rt`，改为断言**色板真的落到了具体节点上**（比断言类名更强）。
 *   - `fontSize` 的断言节点从 `.layer` / `.tab` 换成 `-layer-front` / `-tab-text`：
 *     Web 把 `fontSize` 注入到变体**容器**上（CSS 再靠继承 / em 往下传），
 *     RN 的 `<View>` 不能承载文本样式，`fontSize` 只能落在 `<Text>` 上。
 *   - `container.firstChild` 之类的 DOM 结构断言 —— RN 无对应物（派生 testID 已覆盖）。
 *
 * 另外**新增**了 Web 版完全没覆盖的 `variant="ribbon"` 用例（上游 10 个用例里一个都没有），
 * 以及全部 13 个配色的色板断言。
 *
 * RNTL v14 的 `render` 是**异步**的，所有用例都要 `await`。
 */

/**
 * 宿主节点的最小结构类型。
 *
 * 刻意**不** `import type { TestInstance } from 'test-renderer'`：本文件在 node16 解析下
 * 属于 CJS，而 `test-renderer` 是纯 ESM 包，会触发 TS1541（要求 `with { 'resolution-mode': 'import' }`）。
 * Divider / Button 的测试文件用的是那个导入，也确实会被验收用的独立 tsc 命令判红 ——
 * 既有问题，不必在新文件里复制。
 */
type HostInstance = {
    type: unknown;
    props: Record<string, unknown>;
    children: unknown[];
};

const child = (node: unknown) => node as HostInstance;

/** 取节点上展开后的样式对象（`toHaveStyle` 只做子集匹配，要读值就得自己拍平） */
const styleOf = (node: HostInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** em 换算，与 Title.tsx 的 `emOf` / `round2` 同一定义 */
const em = (n: number, fontSize: number) => Math.round(n * fontSize * 100) / 100;

/** 与 Title.tsx 的 `svgSize` 同一定义：`react-native-svg` 会把盒子尺寸向下取整 */
const svgSize = (n: number) => Math.floor(n);

/** 0.9em × √2 —— 135° 渐变切角在两条边上的落点，见 Title.tsx 中 Tab 的注释 */
const cutOf = (fontSize: number) => svgSize(0.9 * Math.SQRT2 * fontSize);

/**
 * react-native-svg 把 `<Polygon>` 编译成 `<RNSVGPath>`，`points` 变成 `d`。
 * 格式是 `M x y x y … z`，所以下面用同一个点表重建期望值。
 */
const polyD = (...points: [number, number][]) => `M${points.map(([x, y]) => `${x} ${y}`).join(' ')}z`;

const tailLeftD = (t: number) => polyD([t, 0], [t, t], [0, t], [t * 0.3, t * 0.5], [0, 0]);
const tailRightD = (t: number) => polyD([0, 0], [t, 0], [t * 0.7, t * 0.5], [t, t], [0, t]);

/** 深度优先收集所有 `<RNSVGPath>`（`<Svg>` → `<RNSVGGroup>` → `<RNSVGPath>`） */
const svgPaths = (node: HostInstance): HostInstance[] => {
    const out: HostInstance[] = [];
    const walk = (n: unknown) => {
        if (typeof n !== 'object' || n === null) return;
        const i = child(n);
        if (i.type === 'RNSVGPath') out.push(i);
        (i.children ?? []).forEach(walk);
    };
    walk(node);
    return out;
};

/**
 * react-native-svg 会把 `fill` 预处理成 `{ type: 0, payload: <processColor 的结果> }`，
 * 所以不能直接跟 hex 字符串比，要跟 `processColor(hex)` 比。
 */
const fillOf = (path: HostInstance) => (path.props.fill as { payload?: unknown } | undefined)?.payload;

const ALL_COLORS: TitleColor[] = [
    'default',
    'app-pink',
    'purple',
    'app-blue',
    'app-yellow',
    'app-orange',
    'app-teal',
    'app-green',
    'app-red',
    'lime-green',
    'yellow-green',
    'brown',
    'warm-peach-pink',
];

describe('Title', () => {
    it('渲染 children 文本', async () => {
        const { getByText } = await render(<Title>Hello</Title>);
        expect(getByText('Hello')).toBeTruthy();
    });

    it('默认 size=middle 字号 20', async () => {
        const { getByTestId } = await render(<Title testID="t">X</Title>);
        expect(getByTestId('t-layer-front')).toHaveStyle({ fontSize: 20 });
    });

    it('size 全部枚举（small 14 / middle 20 / large 28）', async () => {
        const sizes: [TitleSize, number][] = [
            ['small', 14],
            ['middle', 20],
            ['large', 28],
        ];
        for (const [size, expected] of sizes) {
            const { getByTestId, unmount } = await render(
                <Title size={size} testID="t">
                    X
                </Title>
            );
            expect(getByTestId('t-layer-front')).toHaveStyle({ fontSize: expected });
            await unmount();
        }
    });

    it('size=large 字号 28', async () => {
        const { getByTestId } = await render(
            <Title size="large" testID="t">
                X
            </Title>
        );
        expect(getByTestId('t-layer-front')).toHaveStyle({ fontSize: 28 });
    });

    it('默认 variant=layer 渲染双层纸结构', async () => {
        const { getByTestId } = await render(<Title testID="t">X</Title>);
        const layer = getByTestId('t-layer');
        // [背层纸片(.layer::before), 正面(.layerFront)]
        expect(layer.children).toHaveLength(2);
        expect(getByTestId('t-layer-front')).toHaveTextContent('X');
    });

    it('variant=layer 几何：em 全部由 fontSize 推出（large=28）', async () => {
        const { getByTestId } = await render(
            <Title size="large" testID="t">
                X
            </Title>
        );
        const layer = getByTestId('t-layer');
        expect(layer).toHaveStyle({ height: em(2.1, 28) }); // .layer { height: 2.1em }
        // .layer::before { left: -0.26em; top: -0.3em; right: 0.65em; bottom: 0 }
        expect(child(layer.children[0])).toHaveStyle({
            left: em(-0.26, 28),
            top: em(-0.3, 28),
            right: em(0.65, 28),
            bottom: 0,
        });
        // .layerFront { height: 2.1em; padding: 0 1.55em; border-radius: 0.35em }
        expect(getByTestId('t-layer-front')).toHaveStyle({
            height: em(2.1, 28),
            paddingHorizontal: em(1.55, 28),
            borderRadius: em(0.35, 28),
        });
    });

    it('color 非 default 时应用色板（layer：背层 / 正面 / 文字三处颜色都换）', async () => {
        const { getByTestId } = await render(
            <Title color="app-pink" testID="t">
                X
            </Title>
        );
        const layer = getByTestId('t-layer');
        // .color-app-pink { --rf: #f8a6b2; --rb: #e06880; --rt: #fff }
        expect(child(layer.children[0])).toHaveStyle({ backgroundColor: '#e06880' });
        expect(getByTestId('t-layer-front')).toHaveStyle({ backgroundColor: '#f8a6b2', color: '#fff' });
    });

    it('variant=layer 应用 color 到 layer 元素（对应 Web 的重复用例）', async () => {
        const { getByTestId } = await render(
            <Title variant="layer" color="app-pink" testID="t">
                X
            </Title>
        );
        expect(getByTestId('t-layer-front')).toHaveStyle({ backgroundColor: '#f8a6b2' });
    });

    it('variant=tab 渲染折角便签结构', async () => {
        const { getByTestId } = await render(
            <Title variant="tab" testID="t">
                Tab
            </Title>
        );
        const tab = getByTestId('t-tab');
        expect(tab).toHaveStyle({ height: 40 }); // .tab { height: 2em }，middle=20 → 40
        const text = getByTestId('t-tab-text');
        expect(text).toHaveTextContent('Tab');
        // .tabText 继承 .title 的 line-height: 1
        expect(text).toHaveStyle({ fontSize: 20, lineHeight: 20 });
    });

    it('variant=tab 几何：135° 渐变切角 = 0.9em × √2、折角 = 0.9em', async () => {
        const { getByTestId } = await render(
            <Title variant="tab" size="large" testID="t">
                Tab
            </Title>
        );
        const tab = getByTestId('t-tab');
        expect(tab).toHaveStyle({
            height: em(2, 28),
            paddingHorizontal: em(1.5, 28),
            borderRadius: em(0.32, 28),
        });

        const cut = cutOf(28);
        const fold = svgSize(em(0.9, 28));
        // [切角三角形 Svg, 右上块, 下半块, 折角 Svg, 文字]
        expect(tab.children).toHaveLength(5);
        expect(child(tab.children[0])).toHaveStyle({ width: cut, height: cut, left: 0, top: 0 });
        expect(child(tab.children[1])).toHaveStyle({ left: cut, height: cut });
        expect(child(tab.children[2])).toHaveStyle({ top: cut, bottom: 0 });
        expect(child(tab.children[3])).toHaveStyle({ width: fold, height: fold, right: 0, bottom: 0 });

        // 切角三角形 = {(cut,0), (cut,cut), (0,cut)}；折角 = {(0,0), (0,0.9em), (0.9em,0.9em)}
        const paths = svgPaths(tab);
        expect(paths).toHaveLength(2);
        expect(paths[0].props.d).toBe(polyD([cut, 0], [cut, cut], [0, cut]));
        expect(paths[1].props.d).toBe(polyD([0, 0], [0, fold], [fold, fold]));
    });

    it('variant=tab 应用 color 到 tab 元素', async () => {
        const { getByTestId } = await render(
            <Title variant="tab" color="lime-green" testID="t">
                X
            </Title>
        );
        const tab = getByTestId('t-tab');
        // .color-lime-green { --rf: #d1da49; --rk: #485800; --rt: #3d5a1a }
        expect(child(tab.children[1])).toHaveStyle({ backgroundColor: '#d1da49' });
        expect(child(tab.children[2])).toHaveStyle({ backgroundColor: '#d1da49' });
        expect(getByTestId('t-tab-text')).toHaveStyle({ color: '#3d5a1a' });
        // 折角三角形用 --rk
        const paths = svgPaths(tab);
        expect(fillOf(paths[1])).toBe(processColor('#485800'));
    });

    it('应用 style 与 testID 到根节点（className 无对应，已丢弃）', async () => {
        const { getByTestId } = await render(
            <Title testID="t" style={{ marginLeft: 4 }}>
                X
            </Title>
        );
        const root = getByTestId('t');
        expect(root).toHaveStyle({ marginLeft: 4 });
        // .title { display: inline-block; user-select: none }
        expect(root).toHaveStyle({ alignSelf: 'flex-start', userSelect: 'none' });
    });

    // ---------- RN 专有：Web 版没有覆盖的 ribbon 变体 ----------

    it('variant=ribbon 渲染飘带结构：4 块装饰 + 正面 + 文字', async () => {
        const { getByTestId } = await render(
            <Title variant="ribbon" testID="t">
                Ribbon
            </Title>
        );
        const ribbon = getByTestId('t-ribbon');
        // [左燕尾, 右燕尾, 左折角, 右折角, 正面主体, 文字]
        expect(ribbon.children).toHaveLength(6);
        expect(getByTestId('t-ribbon-text')).toHaveTextContent('Ribbon');
        expect(ribbon).toHaveStyle({
            height: 40, // .ribbon { height: 2em }
            paddingHorizontal: 32, // padding: 0 1.6em
        });
    });

    it('variant=ribbon 几何：燕尾 1.7em、折角 0.95em × 0.45em、正面 inset 0.1em', async () => {
        const { getByTestId } = await render(
            <Title variant="ribbon" size="large" testID="t">
                R
            </Title>
        );
        const ribbon = getByTestId('t-ribbon');
        const f = 28;
        const tail = svgSize(em(1.7, f));
        const foldW = svgSize(em(0.95, f));
        const foldH = svgSize(em(0.45, f));

        // 左燕尾：left: -0.6em; bottom: -0.4em; 1.7em 见方
        expect(child(ribbon.children[0])).toHaveStyle({
            width: tail,
            height: tail,
            left: em(-0.6, f),
            bottom: em(-0.4, f),
        });
        // 右燕尾：right: -0.6em
        expect(child(ribbon.children[1])).toHaveStyle({ right: em(-0.6, f), bottom: em(-0.4, f) });
        // 折角：0.95em × 0.45em；Web 的 top: calc(100% - 0.05em) → RN 的 bottom: -0.4em
        expect(child(ribbon.children[2])).toHaveStyle({
            width: foldW,
            height: foldH,
            left: em(0.15, f),
            bottom: em(-0.4, f),
        });
        expect(child(ribbon.children[3])).toHaveStyle({ right: em(0.16, f), bottom: em(-0.4, f) });
        // 正面：inset: 0 0.1em
        expect(child(ribbon.children[4])).toHaveStyle({ left: em(0.1, f), right: em(0.1, f) });

        // 文字：height 2em + padding-top 0.11em + 行盒 (2em - 0.11em)
        expect(getByTestId('t-ribbon-text')).toHaveStyle({
            fontSize: 28,
            height: em(2, f),
            paddingTop: em(0.11, f),
            lineHeight: em(2, f) - em(0.11, f),
        });

        // 四块装饰的多边形点表
        const paths = svgPaths(ribbon);
        expect(paths).toHaveLength(4);
        expect(paths[0].props.d).toBe(tailLeftD(tail));
        expect(paths[1].props.d).toBe(tailRightD(tail));
        expect(paths[2].props.d).toBe(polyD([0, 0], [foldW, 0], [foldW, foldH]));
        expect(paths[3].props.d).toBe(polyD([foldW, 0], [0, 0], [0, foldH]));
    });

    it('variant=ribbon 应用 color（燕尾 = --rb、折角 = --rk、正面 = --rf、文字 = --rt）', async () => {
        const { getByTestId } = await render(
            <Title variant="ribbon" color="app-blue" testID="t">
                R
            </Title>
        );
        const ribbon = getByTestId('t-ribbon');
        // .color-app-blue { --rf: #889df0; --rb: #5068d8; --rk: #2030a0; --rt: #fff }
        // 前四块是 <Svg>，颜色在 fill 上（宿主节点的 backgroundColor 恒为 transparent），
        // 见下面的 fill 断言；这里只断言正面主体与文字。
        expect(child(ribbon.children[4])).toHaveStyle({ backgroundColor: '#889df0' });
        expect(getByTestId('t-ribbon-text')).toHaveStyle({ color: '#fff' });

        // SVG 那四块的 fill 来自同一个色板（燕尾 = --rb，折角 = --rk）
        const paths = svgPaths(ribbon);
        expect(paths.map(fillOf)).toEqual([
            processColor('#5068d8'),
            processColor('#5068d8'),
            processColor('#2030a0'),
            processColor('#2030a0'),
        ]);
    });

    it('13 个配色都能解析到色板（背层与正面必须不同色）', async () => {
        for (const color of ALL_COLORS) {
            const { getByTestId, unmount } = await render(
                <Title color={color} testID="t">
                    X
                </Title>
            );
            const front = styleOf(getByTestId('t-layer-front'));
            const back = styleOf(child(getByTestId('t-layer').children[0]));
            expect(typeof front.backgroundColor).toBe('string');
            expect(typeof front.color).toBe('string');
            // 背层与正面不同色，否则双层纸看不出层次
            expect(back.backgroundColor).not.toBe(front.backgroundColor);
            await unmount();
        }
    });

    it('variant 全部枚举都能渲染出对应结构', async () => {
        const variants: [TitleVariant, string][] = [
            ['ribbon', 't-ribbon'],
            ['layer', 't-layer'],
            ['tab', 't-tab'],
        ];
        for (const [variant, expectedTestID] of variants) {
            const { getByTestId, unmount } = await render(
                <Title variant={variant} testID="t">
                    X
                </Title>
            );
            expect(getByTestId(expectedTestID)).toBeTruthy();
            await unmount();
        }
    });
});
