import React from 'react';
import { ScrollView, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Carousel } from './Carousel';
import { clampIndex, indexFromOffset, normalizeIndex, snapOffset } from './geometry';

/**
 * RN 版测试，对应 Web 版 `Carousel.test.tsx` 的 8 个用例。
 *
 * **被丢弃的用例**：
 *   - 「键盘方向键、Home 和 End 可导航」—— RN 没有 DOM 键盘事件，也没有
 *     `tabIndex` 意义上的焦点遍历。整条丢弃，没有等价物（宿主可用硬件键盘事件
 *     自己调 `onChange`）。
 *   - 「焦点进入后暂停，并可从播放控制显式恢复」里的 `user.tab()` / `toHaveFocus()`
 *     / `user.keyboard('{Enter}')` —— 同上。**但这条用例的核心行为被保留了**：
 *     暂停 → 播放控制恢复，改由 `pauseOnHover`（RN 映射为「手指按住」）触发。
 *   - `className` 断言 —— RN 无 className，改为断言 style。
 *   - `aria-roledescription` 断言 —— **RN 0.87 没有这个属性**（`ViewAccessibility`
 *     里不存在，`accessibilityRole` 也没有 `carousel` / `slide`），只能整条丢。
 *   - 圆点的 `aria-current` 断言 —— RN 没有 `aria-current`，改用 `aria-selected`。
 *
 * **RN 侧新增**：
 *   - `onMomentumScrollEnd` 按偏移量回写索引（Web 版没有拖拽，所以没有这条）。
 *   - `ScrollView.scrollTo` 的**命令式调用参数**断言。
 *   - `geometry.ts` 的纯函数单测（`describe('Carousel geometry')`）。
 *
 * ⚠️ **读断言前必须知道：jest preset 把 `View` / `ScrollView` 都 mock 掉了**
 *   - `View` 的 mock 把 props **原样**透传，不做 RN 的 aria-* 改写
 *     （见 `RN-PORT.md` 的 `View`-mock 表）。所以这里断言的 `props['aria-label']`
 *     在真机上会变成 `accessibilityLabel`，`props['aria-hidden']` 会变成
 *     `accessibilityElementsHidden` + `importantForAccessibility`。
 *     **`Pressable` 上的断言（箭头 / 圆点 / 播放控制）则与真机一致。**
 *   - `ScrollView` 的 mock 是个**类组件**（`@react-native/jest-preset/jest/mocks/ScrollView.js`），
 *     `scrollTo` 是挂在原型上的 `jest.fn()` —— 它**不会真的滚动**，所以只能断言参数。
 *     真机上「滚到哪一页」由原生完成，本套测试看不到。
 *
 * 另外：`getByRole('region')` 查不到根节点 —— RNTL 的可访问性判定只认 `accessible`，
 * 裸 `View` 即使带 `role` 也不算无障碍元素（见 `RN-PORT.md`）。这条限制被显式钉在一个用例里。
 */

const slides = [<Text key="1">海滩</Text>, <Text key="2">广场</Text>, <Text key="3">博物馆</Text>];

/** 非当前页带 `aria-hidden`，RNTL 默认把这类节点排除在查询之外 */
const HIDDEN = { includeHiddenElements: true } as const;

/** 视口宽度用 `onLayout` 喂进去，`pagingEnabled` 的每一页就等于这个宽度 */
const VIEWPORT_WIDTH = 300;

const layoutViewport = async (viewport: TestInstance) => {
    await fireEvent(viewport, 'layout', {
        nativeEvent: { layout: { width: VIEWPORT_WIDTH, height: 200 } },
    });
};

let scrollTo: jest.SpyInstance;

beforeEach(() => {
    jest.useFakeTimers();
    // ScrollView 在测试里是类组件 mock，`scrollTo` 挂在原型上（见文件头注释）
    scrollTo = jest.spyOn((ScrollView as unknown as { prototype: { scrollTo: jest.Mock } }).prototype, 'scrollTo');
});

afterEach(() => {
    scrollTo.mockRestore();
    jest.useRealTimers();
});

describe('Carousel', () => {
    it('默认展示第一张并提供完整轮播语义', async () => {
        const { getByTestId } = await render(
            <Carousel testID="c" aria-label="岛屿照片">
                {slides}
            </Carousel>
        );
        const root = getByTestId('c');
        expect(root.props.role).toBe('region');
        expect(root.props['aria-label']).toBe('岛屿照片');

        // 第一张可见，其余隐藏
        expect(getByTestId('c-slide-0', HIDDEN).props['aria-hidden']).toBe(false);
        expect(getByTestId('c-slide-1', HIDDEN).props['aria-hidden']).toBe(true);
        expect(getByTestId('c-slide-0', HIDDEN).props['aria-label']).toBe('第 1 张，共 3 张');
    });

    it('裸 View 的 role="region" 查不到（RNTL 只认 accessible，钉住这条限制）', async () => {
        const { queryByRole } = await render(
            <Carousel testID="c" aria-label="岛屿照片">
                {slides}
            </Carousel>
        );
        expect(queryByRole('region')).toBeNull();
    });

    it('点击箭头和圆点切换并触发 onChange', async () => {
        const onChange = jest.fn();
        const { getByRole, getByTestId } = await render(
            <Carousel testID="c" onChange={onChange}>
                {slides}
            </Carousel>
        );

        await fireEvent.press(getByRole('button', { name: '下一张' }));
        expect(onChange).toHaveBeenLastCalledWith(1);
        expect(getByTestId('c-slide-1', HIDDEN).props['aria-hidden']).toBe(false);

        await fireEvent.press(getByRole('button', { name: '转到第 3 张' }));
        expect(onChange).toHaveBeenLastCalledWith(2);
    });

    it('点击当前页的圆点不触发 onChange', async () => {
        const onChange = jest.fn();
        const { getByRole } = await render(
            <Carousel testID="c" onChange={onChange}>
                {slides}
            </Carousel>
        );
        await fireEvent.press(getByRole('button', { name: '转到第 1 张' }));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('受控 activeIndex 不自行改变', async () => {
        const onChange = jest.fn();
        const { getByRole, getByTestId } = await render(
            <Carousel testID="c" activeIndex={0} onChange={onChange}>
                {slides}
            </Carousel>
        );
        await fireEvent.press(getByRole('button', { name: '下一张' }));
        expect(onChange).toHaveBeenCalledWith(1);
        // 受控：内部状态不动，仍停在第 1 张
        expect(getByTestId('c-slide-0', HIDDEN).props['aria-hidden']).toBe(false);
    });

    it('loop 时首张按「上一张」环绕到最后一张', async () => {
        const onChange = jest.fn();
        const { getByRole, getByTestId } = await render(
            <Carousel testID="c" loop onChange={onChange}>
                {slides}
            </Carousel>
        );
        await fireEvent.press(getByRole('button', { name: '上一张' }));
        expect(onChange).toHaveBeenLastCalledWith(2);
        expect(getByTestId('c-slide-2', HIDDEN).props['aria-hidden']).toBe(false);
    });

    it('autoplay 按间隔自动切换', async () => {
        const onChange = jest.fn();
        const { getByTestId } = await render(
            <Carousel testID="c" autoplay interval={2_000} onChange={onChange}>
                {slides}
            </Carousel>
        );
        await act(async () => {
            jest.advanceTimersByTime(2_000);
        });
        expect(onChange).toHaveBeenCalledWith(1);
        expect(getByTestId('c-slide-1', HIDDEN).props['aria-hidden']).toBe(false);
    });

    it('手指按住时暂停自动播放，并可从播放控制显式恢复', async () => {
        const onChange = jest.fn();
        const { getByTestId, getByRole } = await render(
            <Carousel testID="c" autoplay interval={1_000} onChange={onChange}>
                {slides}
            </Carousel>
        );

        // `pauseOnHover` 在 RN 里映射为「手指按住」（Web 的 hover / focus 都不存在）
        await fireEvent(getByTestId('c'), 'touchStart');
        await act(async () => {
            jest.advanceTimersByTime(5_000);
        });
        expect(onChange).not.toHaveBeenCalled();
        expect(getByRole('button', { name: '继续自动播放' })).toBeTruthy();

        await fireEvent.press(getByTestId('c-rotation'));
        expect(getByRole('button', { name: '暂停自动播放' })).toBeTruthy();

        await act(async () => {
            jest.advanceTimersByTime(1_000);
        });
        expect(onChange).toHaveBeenCalledWith(1);
    });

    it('未开 autoplay 时不渲染播放控制', async () => {
        const { queryByTestId } = await render(<Carousel testID="c">{slides}</Carousel>);
        expect(queryByTestId('c-rotation')).toBeNull();
    });

    it('非循环模式在边界禁用箭头', async () => {
        const { getByTestId, getByRole } = await render(
            <Carousel testID="c" loop={false}>
                {slides}
            </Carousel>
        );
        // Pressable 会把 disabled 折算进 accessibilityState（与真机一致）
        expect(getByTestId('c-previous').props.accessibilityState).toMatchObject({ disabled: true });
        expect(getByTestId('c-next').props.accessibilityState).toMatchObject({ disabled: false });

        await fireEvent.press(getByRole('button', { name: '转到第 3 张' }));
        expect(getByTestId('c-next').props.accessibilityState).toMatchObject({ disabled: true });
    });

    it('可隐藏箭头和指示点，单张内容不渲染控制器', async () => {
        const { queryByRole, rerender } = await render(
            <Carousel testID="c" showArrows={false} showDots={false}>
                {slides}
            </Carousel>
        );
        expect(queryByRole('button')).toBeNull();

        await rerender(<Carousel testID="c">{slides[0]}</Carousel>);
        expect(queryByRole('button')).toBeNull();
    });

    it('圆点用 aria-selected 表达当前页（RN 无 aria-current）', async () => {
        const { getByRole } = await render(<Carousel testID="c">{slides}</Carousel>);
        // ⚠️ Pressable **自己**会把 `aria-selected` 折进 `accessibilityState.selected`
        // （`Pressable.js` 的 `selected: ariaSelected ?? accessibilityState?.selected`），
        // 所以宿主节点上看不到原始的 `aria-selected` —— 这与真机一致，可以直接断言。
        expect(getByRole('button', { name: '转到第 1 张', selected: true })).toBeTruthy();
        expect(getByRole('button', { name: '转到第 2 张', selected: false })).toBeTruthy();
    });

    // ---------- RN 专有：滚动 ----------

    it('索引变化时命令式滚到对应页（scrollTo 参数）', async () => {
        const { getByTestId, getByRole } = await render(<Carousel testID="c">{slides}</Carousel>);
        await layoutViewport(getByTestId('c-viewport'));
        expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });

        await fireEvent.press(getByRole('button', { name: '下一张' }));
        expect(scrollTo).toHaveBeenLastCalledWith({ x: VIEWPORT_WIDTH, animated: true });

        await fireEvent.press(getByRole('button', { name: '转到第 3 张' }));
        expect(scrollTo).toHaveBeenLastCalledWith({ x: 2 * VIEWPORT_WIDTH, animated: true });
    });

    it('未量到宽度前不滚动（pageWidth 为 0 时直接跳过）', async () => {
        // 兜底宽度来自 useWindowDimensions（jest preset 的 NativeModules 默认 750×1334），
        // 所以这条只断言「布局事件到达前，不会出现 NaN / undefined 的偏移」
        const { getByRole } = await render(<Carousel testID="c">{slides}</Carousel>);
        scrollTo.mockClear();
        await fireEvent.press(getByRole('button', { name: '下一张' }));
        for (const call of scrollTo.mock.calls) {
            expect(Number.isFinite(call[0].x)).toBe(true);
        }
    });

    it('手指滑动结束后按偏移量回写索引', async () => {
        const onChange = jest.fn();
        const { getByTestId } = await render(
            <Carousel testID="c" onChange={onChange}>
                {slides}
            </Carousel>
        );
        await layoutViewport(getByTestId('c-viewport'));
        await fireEvent(getByTestId('c-viewport'), 'momentumScrollEnd', {
            nativeEvent: { contentOffset: { x: 2 * VIEWPORT_WIDTH, y: 0 } },
        });
        expect(onChange).toHaveBeenLastCalledWith(2);
        expect(getByTestId('c-slide-2', HIDDEN).props['aria-hidden']).toBe(false);
    });

    it('滑动落点与当前页一致时不重复回调', async () => {
        const onChange = jest.fn();
        const { getByTestId } = await render(
            <Carousel testID="c" onChange={onChange}>
                {slides}
            </Carousel>
        );
        await layoutViewport(getByTestId('c-viewport'));
        await fireEvent(getByTestId('c-viewport'), 'momentumScrollEnd', {
            nativeEvent: { contentOffset: { x: 0, y: 0 } },
        });
        expect(onChange).not.toHaveBeenCalled();
    });

    it('每一页按量到的视口宽度铺满（pagingEnabled 的前提）', async () => {
        const { getByTestId } = await render(<Carousel testID="c">{slides}</Carousel>);
        await layoutViewport(getByTestId('c-viewport'));
        for (const index of [0, 1, 2]) {
            expect(getByTestId(`c-slide-${index}`, HIDDEN)).toHaveStyle({ width: VIEWPORT_WIDTH });
        }
    });
});

/**
 * `geometry.ts` 的单测。
 *
 * 这些算术在组件里**无法被覆盖**：`ScrollView.scrollTo` 需要原生滚动节点，
 * 测试渲染器里只有 mock（见文件头）。所以把「该滚到哪 / 滚到了第几页」算成纯函数单测。
 *
 * 放在同一个文件而不是另开 `geometry.test.ts`：本仓库的 jest 配置是按目录 glob 注册的，
 * 而验收命令用的是 `*.test.tsx`；放在这里能保证它们一定被跑到、也被 `tsc` 检查到。
 */
describe('Carousel geometry', () => {
    it('clampIndex 夹在 [0, maxIndex]', () => {
        expect(clampIndex(1, 2)).toBe(1);
        expect(clampIndex(5, 2)).toBe(2);
        expect(clampIndex(-1, 2)).toBe(0);
        // 空列表：上游 `Math.max(max, 0)` 把它夹到 0
        expect(clampIndex(3, -1)).toBe(0);
    });

    it('normalizeIndex：loop 时环绕', () => {
        expect(normalizeIndex(0, 3, true)).toBe(0);
        expect(normalizeIndex(1, 3, true)).toBe(1);
        expect(normalizeIndex(3, 3, true)).toBe(0);
        expect(normalizeIndex(-1, 3, true)).toBe(2);
        // 空列表兜底
        expect(normalizeIndex(0, 0, true)).toBe(0);
    });

    it('normalizeIndex：非 loop 时夹到边界', () => {
        expect(normalizeIndex(0, 3, false)).toBe(0);
        expect(normalizeIndex(3, 3, false)).toBe(2);
        expect(normalizeIndex(-1, 3, false)).toBe(0);
    });

    it('snapOffset = index × pageWidth', () => {
        expect(snapOffset(0, 300)).toBe(0);
        expect(snapOffset(2, 300)).toBe(600);
        expect(snapOffset(2, 0)).toBe(0);
    });

    it('indexFromOffset 吸附到最近一页', () => {
        expect(indexFromOffset(0, 300, 3)).toBe(0);
        // 149 / 300 = 0.497 → 0；151 / 300 = 0.503 → 1
        expect(indexFromOffset(149, 300, 3)).toBe(0);
        expect(indexFromOffset(151, 300, 3)).toBe(1);
        expect(indexFromOffset(600, 300, 3)).toBe(2);
    });

    it('indexFromOffset 夹在最后一页，且处理越界输入', () => {
        expect(indexFromOffset(900, 300, 3)).toBe(2);
        expect(indexFromOffset(-50, 300, 3)).toBe(0);
        // pageWidth 还没量到 / 没有子元素 → 0（避免除零得到 Infinity）
        expect(indexFromOffset(600, 0, 3)).toBe(0);
        expect(indexFromOffset(600, 300, 0)).toBe(0);
    });
});
