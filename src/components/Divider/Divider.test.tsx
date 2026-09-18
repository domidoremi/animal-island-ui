import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Divider } from './Divider';

/**
 * RN 版测试，对应 Web 版 `Divider.test.tsx` 的 7 个用例并做了 RN 化的补充。
 *
 * 与 Web 版的差异：
 *   - Web 用 `className` + `.module.less` 断言；RN 用 `testID` + `toHaveStyle`。
 *   - Web 靠 mock `HTMLElement.prototype.clientWidth` 让 cycles > 1；
 *     RN 靠 `fireEvent(root, 'layout', ...)` 触发 `onLayout`。
 *   - RNTL v14 的 `render` / `fireEvent` 都是**异步**的（React 19 的 async act），
 *     所有用例必须 `await`。
 *   - 分隔线是纯装饰元素，根节点带 `aria-hidden`；RNTL 默认把「对无障碍隐藏」的
 *     节点排除在查询之外，所以查询要显式带 `includeHiddenElements: true`。
 */
const HIDDEN = { includeHiddenElements: true } as const;

const layout = (width: number, height = 20) => ({
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

const child = (node: unknown) => node as TestInstance;

describe('Divider', () => {
    it('默认 type=dashed-brown：渲染根节点，高度 12', async () => {
        const { getByTestId } = await render(<Divider testID="d" />);
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ width: '100%', height: 12 });
    });

    it('支持 thin 细线 type（高度 1）', async () => {
        const { getByTestId } = await render(<Divider type="thin" testID="d" />);
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ height: 1 });
    });

    it('支持 hairline 1px 虚线 type（高度 1）', async () => {
        const { getByTestId } = await render(<Divider type="hairline" testID="d" />);
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ height: 1 });
    });

    it('支持 wave-yellow 波浪线 type（高度 14）', async () => {
        const { getByTestId } = await render(<Divider type="wave-yellow" testID="d" />);
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ height: 14 });
    });

    it('支持 squiggle 波浪线 type（高度 10）', async () => {
        const { getByTestId } = await render(<Divider type="squiggle" testID="d" />);
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ height: 10 });
    });

    it('应用 style（后置覆盖默认的 width: 100%）', async () => {
        const { getByTestId } = await render(<Divider testID="d" style={{ width: 100 }} />);
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ width: 100 });
    });

    it('未测量到宽度时不绘制 svg（首帧无残留）', async () => {
        const { getByTestId } = await render(<Divider testID="d" />);
        expect(getByTestId('d', HIDDEN).children).toHaveLength(0);
    });

    it('测量到宽度后绘制 svg 分隔线', async () => {
        const { getByTestId } = await render(<Divider testID="d" />);
        const root = getByTestId('d', HIDDEN);
        await fireEvent(root, 'layout', layout(300));
        expect(root.children).toHaveLength(1);
    });

    it('波浪线按 tileWidth 平铺：300px 宽 / 40px 周期 → 8 段 path，偏移 0/40/…/280', async () => {
        const { getByTestId } = await render(<Divider type="wave-yellow" testID="d" />);
        const root = getByTestId('d', HIDDEN);
        await fireEvent(root, 'layout', layout(300, 14));

        const svg = child(root.children[0]);
        expect(svg.props.width).toBe(300);
        expect(svg.props.height).toBe(14);

        // react-native-svg 会把 Svg 的子节点包一层 RNSVGGroup，
        // Path 的 `transform="translate(i * tileWidth, 0)"` 在宿主侧表现为
        // `matrix: [1, 0, 0, 1, tx, 0]`，故用 matrix[4] 取水平偏移。
        const group = child(svg.children[0]);
        const offsets = group.children.map((p) => child(p).props.matrix[4]);
        // 平铺数量 = ceil(300 / 40) = 8，等价于 CSS 的 background-repeat: repeat-x
        expect(offsets).toEqual([0, 40, 80, 120, 160, 200, 240, 280]);
    });

    it('icon 模式下未测量前先渲染 1 个周期（与 Web 版初值一致）', async () => {
        const { getAllByTestId } = await render(<Divider icon={<View testID="fish" />} testID="d" />);
        expect(getAllByTestId('fish', HIDDEN)).toHaveLength(1);
    });

    it('icon 模式下按容器宽度循环拼接：400px / (24+8) → 12 个图标、11 条连接线', async () => {
        const { getByTestId, getAllByTestId } = await render(<Divider icon={<View testID="fish" />} testID="d" />);
        const root = getByTestId('d', HIDDEN);
        await fireEvent(root, 'layout', layout(400, 20));

        expect(getAllByTestId('fish', HIDDEN)).toHaveLength(12);
        expect(root.children).toHaveLength(12);
        // 每个周期 = 图标 +（除最后一个外）连接线
        expect(child(root.children[0]).children).toHaveLength(2);
        expect(child(root.children[11]).children).toHaveLength(1);
    });

    it('icon 优先于 type', async () => {
        const { getByTestId } = await render(<Divider icon={<View testID="fish" />} type="thin" testID="d" />);
        // 走 icon 分支：minHeight 20，而不是 thin 的 height 1
        expect(getByTestId('d', HIDDEN)).toHaveStyle({ minHeight: 20 });
    });
});
