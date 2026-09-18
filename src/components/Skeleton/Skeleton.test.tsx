import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Skeleton, SkeletonAvatar, SkeletonButton, SkeletonInput } from './Skeleton';

/**
 * RN 版测试，对应 Web 版 `Skeleton.test.tsx` 的 11 个用例（**全部保留**）。
 *
 * **被改写的用例**：Web 版 11 条断言全是 `expect(container.firstChild).toBeInTheDocument()`
 * —— 只能证明「渲染出来了」，证明不了任何取值。RN 侧全部改成 `toHaveStyle` /
 * 结构断言（尺寸、圆角、底色、行数、行宽、流光层的渐变与位移），覆盖更严而不是更松。
 * `className` 断言（`active 类默认应用` 那条其实没断言类）换成 `testID` + 结构。
 *
 * **没有丢弃任何 Web 用例**：Skeleton 上游没有键盘 / hover / DOM 测量相关的用例。
 *
 * **RN 专有补充**：
 *   - `@keyframes animal-skeleton-shimmer` → `Animated.loop` + `Easing.inOut(Easing.ease)`，
 *     用**假定时器**驱动并断言位移确实在前进（JS 驱动的 Animated 会逐帧触发 React
 *     更新，不用假定时器会刷一屏 "not wrapped in act(...)"，见 RN-PORT.md）。
 *   - CSS `linear-gradient` → `react-native-svg` 的 `<LinearGradient>` + `<Rect>`，
 *     断言 5 个 stop 的 offset / 颜色 / 透明度。
 *   - `loading=false` 时文本 children 会被包进 `<Text>`（RN 不允许裸字符串作为 View 的子节点）。
 *
 * **无法在此覆盖**：流光的**视觉**效果（需要真机/模拟器），以及 `useNativeDriver: false`
 * 这个选择的性能影响（见 Skeleton.tsx 的 Shimmer 注释）。
 */
const child = (node: unknown) => node as TestInstance;

/** 流光层与骨架根节点都带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

/** 取节点上展开后的样式对象（`toHaveStyle` 只做子集匹配，读值要用这个） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** 读 Animated 插值当前的取值（`__getValue` 是 Animated 的内部求值方法） */
const animatedValue = (value: unknown): string | number | undefined => {
    if (typeof value === 'string' || typeof value === 'number') return value;
    const v = value as { __getValue?: () => string | number } | null;
    return typeof v?.__getValue === 'function' ? v.__getValue() : undefined;
};

/** 把 `'-100%'` 这类插值结果取成数字，方便比较 */
const percentOf = (value: unknown): number => {
    const v = animatedValue(value);
    if (typeof v === 'number') return v;
    return typeof v === 'string' ? parseFloat(v) : NaN;
};

/**
 * react-native-svg 把颜色解析成 ARGB 整数（可能是负数，按 32 位有符号存）。
 * 这里还原成 `rgba(r, g, b, a)`，用来校验 CSS 里写死的色标（含 alpha）。
 * alpha 的量化误差（`round(a * 255)`）与 CSS 写法一致，能逐字对回。
 */
const decodeArgb = (payload: number) => {
    const u = payload < 0 ? payload + 0x100000000 : payload;
    // 用除法取字节（而不是位运算）以避开 eslint 的 no-bitwise
    const a = Math.floor(u / 0x1000000) % 0x100;
    const r = Math.floor(u / 0x10000) % 0x100;
    const g = Math.floor(u / 0x100) % 0x100;
    const b = u % 0x100;
    return `rgba(${r}, ${g}, ${b}, ${Number((a / 255).toFixed(2))})`;
};

/** 流光层的位移（`style={[absoluteFill, { transform: [{ translateX }] }]}`） */
const shimmerOffset = (shimmer: TestInstance): number => {
    const transform = styleOf(shimmer).transform as { translateX: unknown }[] | undefined;
    return percentOf(transform?.[0]?.translateX);
};

/**
 * 流光层里的渐变。
 *
 * 结构（实测）：`<Animated.View>` → `<RNSVGSvgView>` → `<RNSVGGroup>` →
 * `[<RNSVGDefs>, <RNSVGRect>]`；`Defs` → `[<RNSVGLinearGradient>]`。
 *
 * ⚠️ react-native-svg **不把 `<Stop>` 留在渲染树里**：它把子节点收进
 * `LinearGradient` 的 `gradient` prop —— 一个扁平的 `[offset, argb, offset, argb, ...]`。
 * 所以色标要在这里按「成对」拆开再断言。
 */
const shimmerGradient = (shimmer: TestInstance) => {
    const svg = child(shimmer.children[0]);
    const group = child(svg.children[0]);
    const [defs, rect] = group.children.map(child);
    const gradient = child(defs.children[0]);
    const flat = gradient.props.gradient as number[];
    const stops: { offset: number; color: string }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
        stops.push({ offset: flat[i], color: decodeArgb(flat[i + 1]) });
    }
    return { gradient, stops, rect };
};

/** paragraph 变体的行（根节点的子节点，`active=false` 时不含流光层） */
const rowsOf = (root: TestInstance) => root.children.map(child);

beforeEach(() => {
    // 流光用 JS 驱动的 Animated（见 Skeleton.tsx 的 Shimmer 注释），
    // 不换成假定时器的话，动画帧会落在 act 作用域之外。
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('Skeleton', () => {
    it('variant=text 渲染默认骨架：宽 100% / 高 16 / 圆角 12 / 下间距 8', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" />);
        const root = getByTestId('s', HIDDEN);
        expect(root).toHaveStyle({
            width: '100%',
            height: 16,
            borderRadius: 12,
            marginBottom: 8,
            backgroundColor: '#eae5db',
            flexShrink: 0,
            alignSelf: 'flex-start',
            overflow: 'hidden',
        });
        expect(root.props['aria-hidden']).toBe(true);
    });

    it('variant=text 可被 width / heightValue 覆盖', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" width={200} heightValue={24} />);
        expect(getByTestId('s', HIDDEN)).toHaveStyle({ width: 200, height: 24 });
    });

    it('variant=circle 渲染圆形：默认 44×44、圆角 50%', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="circle" />);
        const root = getByTestId('s', HIDDEN);
        expect(root).toHaveStyle({ width: 44, height: 44, borderRadius: '50%' });
        // .vt-circle 覆盖 .skeleton 的 12px
        expect(styleOf(root).borderRadius).toBe('50%');
    });

    it('variant=circle 的尺寸优先级：widthValue ?? heightValue ?? 44', async () => {
        const a = await render(<Skeleton testID="s" variant="circle" widthValue={60} heightValue={80} />);
        expect(a.getByTestId('s', HIDDEN)).toHaveStyle({ width: 60, height: 60 });
        await a.unmount();

        const b = await render(<Skeleton testID="s" variant="circle" heightValue={80} />);
        expect(b.getByTestId('s', HIDDEN)).toHaveStyle({ width: 80, height: 80 });
        await b.unmount();
    });

    it('variant=rect 渲染矩形：默认 100% × 120、圆角 18', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="rect" />);
        const root = getByTestId('s', HIDDEN);
        expect(root).toHaveStyle({ width: '100%', height: 120, borderRadius: 18, backgroundColor: '#eae5db' });
    });

    it('variant=rect 可被 widthValue / heightValue 覆盖', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="rect" widthValue={200} heightValue={90} />);
        expect(getByTestId('s', HIDDEN)).toHaveStyle({ width: 200, height: 90 });
    });

    it('variant=paragraph 渲染 rows 行（默认 3 行），行高 14、圆角 12、行底色 #dfd9ce', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="paragraph" active={false} />);
        const rows = rowsOf(getByTestId('s', HIDDEN));
        expect(rows).toHaveLength(3);
        for (const row of rows) {
            expect(row).toHaveStyle({ height: 14, borderRadius: 12, backgroundColor: '#dfd9ce' });
        }
    });

    it('variant=paragraph 的容器：column / gap 10 / 圆角 0 / 透明底 / 占满整行', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="paragraph" active={false} />);
        const root = getByTestId('s', HIDDEN);
        expect(root).toHaveStyle({
            flexDirection: 'column',
            gap: 10,
            borderRadius: 0,
            backgroundColor: 'transparent',
            // `.vt-paragraph { display: flex }` 是块级 flex → 覆盖 .skeleton 的 inline-block
            alignSelf: 'stretch',
        });
        // 段落根节点**没有** aria-hidden（上游只在 text / circle / rect 上设置）
        expect(root.props['aria-hidden']).toBeUndefined();
    });

    it('variant=paragraph 的默认行宽序列 100% / 92% / 84% / 76% / 68%', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="paragraph" rows={5} active={false} />);
        const widths = rowsOf(getByTestId('s', HIDDEN)).map((row) => styleOf(row).width);
        expect(widths).toEqual(['100%', '92%', '84%', '76%', '68%']);
    });

    it('variant=paragraph 行数超出宽度序列时复用最后一个宽度', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="paragraph" rows={7} active={false} />);
        const widths = rowsOf(getByTestId('s', HIDDEN)).map((row) => styleOf(row).width);
        expect(widths).toHaveLength(7);
        expect(widths.slice(4)).toEqual(['68%', '68%', '68%']);
    });

    it('variant=paragraph rows<1 时至少渲染 1 行（Math.max(1, rows)）', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" variant="paragraph" rows={0} active={false} />);
        expect(rowsOf(getByTestId('s', HIDDEN))).toHaveLength(1);
    });

    it('variant=paragraph 可传 rowWidths 覆盖默认宽度', async () => {
        const { getByTestId } = await render(
            <Skeleton testID="s" variant="paragraph" rows={2} rowWidths={[30, '55%']} active={false} />
        );
        const widths = rowsOf(getByTestId('s', HIDDEN)).map((row) => styleOf(row).width);
        expect(widths).toEqual([30, '55%']);
    });

    it('loading=false 时渲染 children（文本被包进 Text）', async () => {
        const { getByText, queryByTestId } = await render(
            <Skeleton testID="s" loading={false}>
                内容
            </Skeleton>
        );
        expect(getByText('内容')).toBeTruthy();
        expect(queryByTestId('s', HIDDEN)).toBeNull();
    });

    it('loading=false 但无 children 时仍然渲染骨架（上游条件为 !loading && children）', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" loading={false} />);
        expect(getByTestId('s', HIDDEN)).toHaveStyle({ height: 16 });
    });

    it('loading=false 且 children 为节点时原样渲染', async () => {
        const { getByTestId } = await render(
            <Skeleton loading={false}>
                <Skeleton testID="inner" />
            </Skeleton>
        );
        expect(getByTestId('inner', HIDDEN)).toBeTruthy();
    });

    it('active 默认 true：渲染流光层', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" />);
        const shimmer = getByTestId('s-shimmer', HIDDEN);
        expect(shimmer).toBeTruthy();
        expect(shimmer.props['aria-hidden']).toBe(true);
        expect(shimmer.props.pointerEvents).toBe('none');
        // 流光层绝对定位铺满骨架
        expect(styleOf(shimmer)).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 });
    });

    it('active=false 时不渲染流光层', async () => {
        const { queryByTestId } = await render(<Skeleton testID="s" active={false} />);
        expect(queryByTestId('s-shimmer', HIDDEN)).toBeNull();
    });

    it('流光是循环位移：初始 -100%，推进半程后接近 0%（替代 @keyframes）', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" />);
        const shimmer = getByTestId('s-shimmer', HIDDEN);
        expect(shimmerOffset(shimmer)).toBe(-100);

        // 假定时器：帧的推进完全由 advanceTimersByTime 控制，且被包在 act 里
        await act(async () => {
            jest.advanceTimersByTime(800); // 1.6s 的一半
        });
        const half = shimmerOffset(shimmer);
        expect(half).toBeGreaterThan(-50);
        expect(half).toBeLessThan(50);
    });

    it('流光层的渐变与 Less 的 5 个色标一致', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" />);
        const { gradient, stops, rect } = shimmerGradient(getByTestId('s-shimmer', HIDDEN));

        expect(gradient.props.name).toMatch(/^animal-skeleton-shimmer-/);
        expect(stops).toHaveLength(5);
        expect(stops.map((s) => s.offset)).toEqual([0, 0.25, 0.5, 0.75, 1]);
        // CSS：transparent / @shimmer-mid / @shimmer-light / @shimmer-mid / transparent
        // （首尾的 `transparent` 换成 @shimmer-mid 的 RGB + alpha 0，避免灰边 —— 见 Skeleton.tsx）
        expect(stops.map((s) => s.color)).toEqual([
            'rgba(255, 250, 235, 0)',
            'rgba(255, 250, 235, 0.18)',
            'rgba(255, 252, 242, 0.55)',
            'rgba(255, 250, 235, 0.18)',
            'rgba(255, 250, 235, 0)',
        ]);
        // 渐变方向：CSS 的 90deg（左 → 右）
        expect([gradient.props.x1, gradient.props.y1, gradient.props.x2, gradient.props.y2]).toEqual([
            '0',
            '0',
            '1',
            '0',
        ]);

        // 一个铺满的 <Rect> 引用这层渐变
        expect(rect.props.width).toBe('100%');
        expect(rect.props.height).toBe('100%');
        expect(rect.props.fill.brushRef).toBe(gradient.props.name);
    });

    it('style 与 testID 透传（style 覆盖变体尺寸）', async () => {
        const { getByTestId } = await render(<Skeleton testID="s" style={{ marginTop: 4, height: 40 }} />);
        const root = getByTestId('s', HIDDEN);
        expect(root).toHaveStyle({ marginTop: 4, height: 40 });
    });
});

describe('SkeletonButton', () => {
    it('渲染按钮骨架：默认 middle 100×45、圆角 50、带流光', async () => {
        const { getByTestId } = await render(<SkeletonButton testID="b" />);
        const root = getByTestId('b', HIDDEN);
        expect(root).toHaveStyle({
            width: 100,
            height: 45,
            borderRadius: 50,
            backgroundColor: '#eae5db',
        });
        expect(root.props['aria-hidden']).toBe(true);
        expect(getByTestId('b-shimmer', HIDDEN)).toBeTruthy();
    });

    it('应用 size（small / middle / large）', async () => {
        const sizes = [
            { size: 'small', width: 80, height: 32 },
            { size: 'middle', width: 100, height: 45 },
            { size: 'large', width: 130, height: 48 },
        ] as const;
        for (const spec of sizes) {
            const { getByTestId, unmount } = await render(<SkeletonButton testID="b" size={spec.size} />);
            expect(getByTestId('b', HIDDEN)).toHaveStyle({ width: spec.width, height: spec.height });
            await unmount();
        }
    });

    it('active=false 时不渲染流光层', async () => {
        const { queryByTestId } = await render(<SkeletonButton testID="b" active={false} />);
        expect(queryByTestId('b-shimmer', HIDDEN)).toBeNull();
    });
});

describe('SkeletonInput', () => {
    it('渲染输入框骨架：默认 middle 200×40、圆角 50、带流光', async () => {
        const { getByTestId } = await render(<SkeletonInput testID="i" />);
        const root = getByTestId('i', HIDDEN);
        expect(root).toHaveStyle({ width: 200, height: 40, borderRadius: 50 });
        expect(getByTestId('i-shimmer', HIDDEN)).toBeTruthy();
    });

    it('应用 size（small / middle / large）', async () => {
        const sizes = [
            { size: 'small', width: 160, height: 32 },
            { size: 'middle', width: 200, height: 40 },
            { size: 'large', width: 240, height: 48 },
        ] as const;
        for (const spec of sizes) {
            const { getByTestId, unmount } = await render(<SkeletonInput testID="i" size={spec.size} />);
            expect(getByTestId('i', HIDDEN)).toHaveStyle({ width: spec.width, height: spec.height });
            await unmount();
        }
    });
});

describe('SkeletonAvatar', () => {
    it('渲染头像骨架：默认 middle 44×44、圆形', async () => {
        const { getByTestId } = await render(<SkeletonAvatar testID="a" />);
        const root = getByTestId('a', HIDDEN);
        expect(root).toHaveStyle({ width: 44, height: 44, borderRadius: '50%' });
        expect(getByTestId('a-shimmer', HIDDEN)).toBeTruthy();
    });

    it('shape=square 时圆角为 12（而非 50%）', async () => {
        const { getByTestId } = await render(<SkeletonAvatar testID="a" shape="square" />);
        expect(getByTestId('a', HIDDEN)).toHaveStyle({ borderRadius: 12 });
    });

    it('应用 size（small / middle / large）', async () => {
        const sizes = [
            { size: 'small', px: 32 },
            { size: 'middle', px: 44 },
            { size: 'large', px: 56 },
        ] as const;
        for (const spec of sizes) {
            const { getByTestId, unmount } = await render(<SkeletonAvatar testID="a" size={spec.size} />);
            expect(getByTestId('a', HIDDEN)).toHaveStyle({ width: spec.px, height: spec.px });
            await unmount();
        }
    });

    it('active=false 时不渲染流光层', async () => {
        const { queryByTestId } = await render(<SkeletonAvatar testID="a" active={false} />);
        expect(queryByTestId('a-shimmer', HIDDEN)).toBeNull();
    });
});
