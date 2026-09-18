/// <reference types="node" />
import React from 'react';
import { View } from 'react-native';
import fs from 'fs';
import path from 'path';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Progress } from './Progress';
import { colors } from '../../theme/tokens';

/**
 * RN 版测试，对应 Web 版 `Progress.test.tsx` 的 16 个用例。
 *
 * **被丢弃 / 改写的 Web 用例**：
 *   - `forwards className and style` —— `className` 在 RN 里不存在，只保留 `style` / `testID`。
 *   - 3 个 `size=* applies size-* class to track` —— RN 无类名。改为断言轨道**实际高度**
 *     （14 / 24 / 32），比类名断言更贴近真实结果。
 *   - `duration=0 applies noTransition class to fill` —— RN 无类名。改为断言**行为**：
 *     改 percent 时 fill 宽度立刻到位、不经过中间帧。
 *   - `duration applies as transition-duration style on fill` —— CSS 的 `transition-duration`
 *     在 RN 里不存在。改为断言「动画真的按 duration 播放」：推进一半时间时宽度在中间值，
 *     推进到 duration 后到达目标值。
 *   - `default fill carries the fill class (CSS-defined)` —— 类名不存在，改为断言
 *     fill 节点存在且携带位置/圆角等 `.fill` 的几何声明。
 *   - `renders percent text after the track` 里用 `querySelector` 找 `styles.right` ——
 *     改为断言 DOM 结构（row 的两个子节点顺序：轨道在前、百分比在后）。
 *   - 其余全部保留（含 4 条 clamp/round/NaN 的数值边界、aria 透传、info 文案与 size 枚举）。
 *
 * **新增的 RN 专有覆盖**：`prefers-reduced-motion` → `AccessibilityInfo.isReduceMotionEnabled`
 * 的对应实现、场景图按轨道宽度铺满（替代 `background-size: <trackW>px auto`）、
 * 4 个 variant 各自渲染出正确的场景图（用 `<use>` 数量核对）、以及 a11y 属性在宿主上的形态。
 *
 * **宿主 props 的真实形状**（实测，非推断）：
 *   - `aria-valuemin/max/now/text` 写在 `<View>` 上时，**真机**的 `View.js` 会把它们折进
 *     `accessibilityValue: { min, max, now, text }`；但 jest preset 把 `View` 整个 mock 掉了，
 *     所以测试里看到的是**原始**的 `aria-valuenow` 等。断言按原始值写，并在此注明差异。
 *   - 根节点显式设了 `accessible`，所以 `getByRole('progressbar')` **可用**
 *     （RNTL 的 `isAccessibilityElement` 闸门要求显式 `accessible`；Collapse 的面板没设，
 *     所以那边的 `getByRole('region')` 恒为 null）。
 *
 * **测不到的**：轨道宽度来自 `onLayout`，测试里靠 `fireEvent(track, 'layout', …)` 伪造；
 * 真机上的实际布局、`boxShadow: inset …` 的渲染、以及进度动画的流畅度都必须上真机看。
 */
const HIDDEN = { includeHiddenElements: true } as const;

type TestInstance = Awaited<ReturnType<typeof render>>['container'];

const child = (node: unknown) => node as TestInstance;

const layout = (width: number, height = 24) => ({
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

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

/** 取节点上展开后的样式对象 */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/**
 * 读 fill 的宽度。宽度是 `Animated.Value.interpolate(...)` 出来的百分比字符串，
 * 所以不能直接 `toHaveStyle`，要用 Animated 内部的 `__getValue()` 求值。
 */
const fillWidth = (node: TestInstance): string | undefined => {
    const w = styleOf(node).width;
    if (typeof w === 'string') return w;
    const v = w as { __getValue?: () => unknown } | null;
    return typeof v?.__getValue === 'function' ? String(v.__getValue()) : undefined;
};

const widthPercent = (node: TestInstance) => Number.parseFloat(fillWidth(node) ?? 'NaN');

/** 等动画跑完（JS 驱动的 Animated 需要假定时器，见 Collapse.test.tsx 的说明） */
const settle = (ms: number) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

/** 读源 `.svg`，数出其中 `<use>` 的个数 */
const assetUseCount = (file: string) => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'image', file), 'utf8');
    return (svg.match(/<use /g) ?? []).length;
};

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
    // 还原 hook 读到的系统开关，避免上一条用例的 mockResolvedValue(true) 泄漏
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
});

describe('Progress', () => {
    describe('rendering', () => {
        it('role=progressbar，且 percent 会被夹到 [0, 100]（-10 → 0）', async () => {
            const { getByRole } = await render(<Progress percent={-10} />);
            const bar = getByRole('progressbar');
            expect(bar).toBeTruthy();
            expect(bar.props['aria-valuemin']).toBe(0);
            expect(bar.props['aria-valuemax']).toBe(100);
            expect(bar.props['aria-valuenow']).toBe(0);
        });

        it('percent > 100 夹到 100', async () => {
            const { getByRole } = await render(<Progress percent={150} />);
            expect(getByRole('progressbar').props['aria-valuenow']).toBe(100);
        });

        it('非整数 percent 四舍五入进 aria-valuenow（33.7 → 34）', async () => {
            const { getByRole } = await render(<Progress percent={33.7} />);
            expect(getByRole('progressbar').props['aria-valuenow']).toBe(34);
        });

        it('percent=NaN 时按 0 处理', async () => {
            const { getByRole } = await render(<Progress percent={Number.NaN} />);
            expect(getByRole('progressbar').props['aria-valuenow']).toBe(0);
        });

        it('透传 style 与 testID（Web 的 className 在 RN 无对应物）', async () => {
            const { getByTestId } = await render(<Progress percent={50} style={{ width: 320 }} testID="p" />);
            expect(getByTestId('p')).toHaveStyle({ width: 320 });
        });

        it('透传 aria-label 与 aria-labelledby 到 progressbar', async () => {
            const { getByRole, rerender } = await render(<Progress percent={50} aria-label="任务进度" />);
            const bar = getByRole('progressbar');
            expect(bar.props['aria-label']).toBe('任务进度');

            await rerender(<Progress percent={50} aria-labelledby="external-title-id" />);
            expect(getByRole('progressbar').props['aria-labelledby']).toBe('external-title-id');
        });

        it('aria-valuetext 取默认文案（字符串时才设）', async () => {
            const { getByRole } = await render(<Progress percent={42} />);
            expect(getByRole('progressbar').props['aria-valuetext']).toBe('42%');
        });

        it('infoFormat 返回非字符串时不设 aria-valuetext', async () => {
            const { getByRole } = await render(<Progress percent={42} infoFormat={() => <View testID="node" />} />);
            expect(getByRole('progressbar').props['aria-valuetext']).toBeUndefined();
        });
    });

    describe('info text', () => {
        it('默认显示带 % 后缀的百分比', async () => {
            const { getByText } = await render(<Progress percent={42} />);
            expect(getByText('42%')).toBeTruthy();
        });

        it('showInfo=false 时不渲染百分比文字', async () => {
            const { queryByText, queryByTestId } = await render(<Progress percent={50} showInfo={false} testID="p" />);
            expect(queryByText('50%')).toBeNull();
            expect(queryByTestId('p-info', HIDDEN)).toBeNull();
        });

        it('infoFormat 收到 percent 并渲染自定义内容', async () => {
            const { getByText } = await render(<Progress percent={7} infoFormat={(p) => `${Math.round(p)}/10`} />);
            expect(getByText('7/10')).toBeTruthy();
        });

        it('infoFormat 返回非文本节点时原样渲染', async () => {
            const { getByTestId } = await render(<Progress percent={7} infoFormat={() => <View testID="custom" />} />);
            expect(getByTestId('custom')).toBeTruthy();
        });
    });

    describe('size', () => {
        it('size=small → 轨道高度 14', async () => {
            const { getByTestId } = await render(<Progress percent={50} size="small" testID="p" />);
            expect(getByTestId('p-track', HIDDEN)).toHaveStyle({ height: 14 });
        });

        it('size=middle（默认）→ 轨道高度 24', async () => {
            const { getByTestId } = await render(<Progress percent={50} testID="p" />);
            expect(getByTestId('p-track', HIDDEN)).toHaveStyle({ height: 24 });
        });

        it('size=large → 轨道高度 32', async () => {
            const { getByTestId } = await render(<Progress percent={50} size="large" testID="p" />);
            expect(getByTestId('p-track', HIDDEN)).toHaveStyle({ height: 32 });
        });
    });

    describe('animation', () => {
        it('duration=0：percent 变化时宽度立即到位，不经过中间帧', async () => {
            const { getByTestId, rerender } = await render(<Progress percent={0} duration={0} testID="p" />);
            const fill = getByTestId('p-fill', HIDDEN);
            expect(widthPercent(fill)).toBe(0);

            await rerender(<Progress percent={50} duration={0} testID="p" />);
            expect(widthPercent(fill)).toBe(50);
        });

        it('duration=1.2：动画按 duration 播放（一半时间在中间值，结束后到达目标）', async () => {
            const { getByTestId, rerender } = await render(<Progress percent={0} duration={1.2} testID="p" />);
            const fill = getByTestId('p-fill', HIDDEN);

            await rerender(<Progress percent={80} duration={1.2} testID="p" />);
            // 动画还没跑：仍是旧值
            expect(widthPercent(fill)).toBe(0);

            await settle(600);
            const mid = widthPercent(fill);
            expect(mid).toBeGreaterThan(0);
            expect(mid).toBeLessThan(80);

            await settle(700);
            expect(widthPercent(fill)).toBeCloseTo(80, 3);
        });

        it('挂载时不动画（CSS transition 不会在首次渲染播放）', async () => {
            const { getByTestId } = await render(<Progress percent={65} duration={1.2} testID="p" />);
            expect(widthPercent(getByTestId('p-fill', HIDDEN))).toBe(65);
        });

        it('系统开启「减弱动态效果」时不动画（对应 @media (prefers-reduced-motion: reduce)）', async () => {
            (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
            const { getByTestId, rerender } = await render(<Progress percent={0} duration={1.2} testID="p" />);
            const fill = getByTestId('p-fill', HIDDEN);

            await rerender(<Progress percent={90} duration={1.2} testID="p" />);
            expect(widthPercent(fill)).toBe(90);
        });

        it('默认的 fill 节点带 .fill 的几何声明（圆角 + 绝对定位 + 裁剪）', async () => {
            const { getByTestId } = await render(<Progress percent={50} testID="p" />);
            expect(getByTestId('p-fill', HIDDEN)).toHaveStyle({
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                borderRadius: 999,
                overflow: 'hidden',
            });
        });
    });

    describe('fill width', () => {
        it('percent 换算成 fill 的百分比宽度', async () => {
            const { getByTestId } = await render(<Progress percent={42} testID="p" />);
            expect(fillWidth(getByTestId('p-fill', HIDDEN))).toBe('42%');
        });
    });

    describe('info position (right)', () => {
        it('百分比文字渲染在轨道之后（右侧），两者是 row 的兄弟节点', async () => {
            const { getByTestId } = await render(<Progress percent={50} testID="p" />);
            const row = child(getByTestId('p').children[0]);
            expect(child(row.children[0]).props.testID).toBe('p-track');
            expect(child(row.children[1]).props.testID).toBe('p-info');
            expect(getByTestId('p-info', HIDDEN)).toHaveStyle({ minWidth: 44, flexShrink: 0 });
        });

        it('showInfo=false 时 row 只剩轨道一个子节点', async () => {
            const { getByTestId } = await render(<Progress percent={50} showInfo={false} testID="p" />);
            expect(child(getByTestId('p').children[0]).children).toHaveLength(1);
        });
    });

    // ---------- RN 专有 ----------

    it('轨道自带奶油色波点底（复用 Background 的 default 图案）', async () => {
        const { getByTestId } = await render(<Progress percent={50} testID="p" />);
        const track = getByTestId('p-track', HIDDEN);
        // @track-bg: #f8f8f0 = tokens.colors.bg
        expect(track).toHaveStyle({ backgroundColor: colors.bg });
        // .track { box-shadow: inset 0 2px 4px @track-inner }
        expect(track).toHaveStyle({ boxShadow: 'inset 0 2px 4px rgba(114, 93, 66, 0.08)' });

        const patternLayer = getByTestId('p-track-pattern', HIDDEN);
        expect(collect(patternLayer, 'RNSVGPattern')).toHaveLength(1);
        expect(collect(patternLayer, 'RNSVGCircle')).toHaveLength(10); // 与 Background default 同款
    });

    it('测量到轨道宽度后，场景图按轨道宽度铺满（替代 background-size: <trackW>px auto）', async () => {
        const { getByTestId } = await render(<Progress percent={50} testID="p" />);
        const fill = getByTestId('p-fill', HIDDEN);
        // 未测量前不画图（见 Progress.tsx 的差异说明）
        expect(collect(fill, 'RNSVGSvgView')).toHaveLength(0);

        await fireEvent(getByTestId('p-track', HIDDEN), 'layout', layout(400, 24));

        const svgs = collect(getByTestId('p-fill', HIDDEN), 'RNSVGSvgView');
        expect(svgs).toHaveLength(1);
        // 宽 = 轨道宽 400；高 = 400 / (2560/1440) = 225，只露出上部
        expect(svgs[0].props.bbWidth).toBe(400);
        expect(Number(svgs[0].props.bbHeight)).toBeCloseTo(225, 3);
        expect(svgs[0].props.vbWidth).toBe(2560);
        expect(svgs[0].props.vbHeight).toBe(1440);
    });

    it('4 个 variant 各自渲染出正确的场景图（用 <use> 数量核对）', async () => {
        const variants = [
            ['sweet-corner', 'sweet-corner.svg'],
            ['forest-grove', 'forest-grove.svg'],
            ['starry-camp', 'starry-camp.svg'],
            ['coffee-break', 'coffee-break.svg'],
        ] as const;

        for (const [variant, file] of variants) {
            const { getByTestId, unmount } = await render(<Progress percent={50} variant={variant} testID="p" />);
            await fireEvent(getByTestId('p-track', HIDDEN), 'layout', layout(300, 24));
            const svgs = collect(getByTestId('p-fill', HIDDEN), 'RNSVGSvgView');
            expect(svgs).toHaveLength(1);
            expect(collect(svgs[0], 'RNSVGUse')).toHaveLength(assetUseCount(file));
            await unmount();
        }
    });

    it('a11y：role/aria-* 写在根节点上，可被 getByRole 命中（显式设了 accessible）', async () => {
        const { getByRole, getByTestId } = await render(<Progress percent={50} testID="p" aria-label="进度" />);
        const bar = getByRole('progressbar');
        expect(bar.props.role).toBe('progressbar');
        expect(bar.props.accessible).toBe(true);
        // jest preset mock 掉了 View，所以这里看到的是原始 aria-*；
        // 真机上 View.js 会把它们折进 accessibilityValue: { min, max, now, text }
        expect(bar.props['aria-valuenow']).toBe(50);
        expect(getByTestId('p')).toBe(bar);
    });

    it('数值边界：percent=0 / 100 也能正常渲染', async () => {
        const { getByTestId, getByText, unmount } = await render(<Progress percent={0} testID="p" />);
        expect(fillWidth(getByTestId('p-fill', HIDDEN))).toBe('0%');
        expect(getByText('0%')).toBeTruthy();
        await unmount();

        const { getByTestId: get100, getByText: text100 } = await render(<Progress percent={100} testID="p" />);
        expect(fillWidth(get100('p-fill', HIDDEN))).toBe('100%');
        expect(text100('100%')).toBeTruthy();
    });
});
