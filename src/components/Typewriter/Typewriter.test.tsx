import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Typewriter } from './Typewriter';

/**
 * RN 版测试，对应 Web 版 `Typewriter.test.tsx` 的 5 个用例。
 *
 * **没有整条丢弃的 Web 用例**，但有两处断言必须改写、一处上游性质无法还原：
 *
 *   - `container.textContent` —— RNTL 的 `render` 结果**没有 `container.textContent`**
 *     （那是 DOM 的东西）。改为读承载文字那层 `<Text>` 的文本内容
 *     （`toHaveTextContent(..., { exact: true })`）。
 *   - `screen.getByText('Hello')` —— 原样可用。
 *   - ⚠️ Web 版「**不引入任何外层包裹元素**」这条设计承诺在 RN 里**无法还原**：
 *     RN 要求裸字符串必须包在 `<Text>` 内。所以「零包裹」既做不到、也无从断言；
 *     本文件改为断言「最外层确实是 `<Text>`」（把这条硬约束钉住）。
 *
 * 另外，Web 版没有 `style` / `testID`（它没有可定位的根节点），这两个是 RN 侧新增的
 * prop，对应新增了透传用例。
 *
 * ⚠️ 假定时器：组件用 `setInterval` 驱动，`render` / `fireEvent` 是 React 19 的异步
 * `act`，所以推进时间必须包在 `act` 里（与 `Collapse.test.tsx` 同一处理），
 * 否则会刷 "not wrapped in act(...)"。
 */
const child = (node: unknown) => node as TestInstance;

/** 推进假定时器（必须包 act，见文件头） */
const advance = (ms: number) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

/**
 * 抓「本组件自己创建的」interval 句柄。
 *
 * ⚠️ **不能用 `jest.getTimerCount()`**：RN 内部（`requestAnimationFrame` 垫片、
 * Pressability 等）也会排定时器，挂载后计数是 3~4 而不是 1（实测），断言恒假。
 * 所以这里按「延迟 === speed」把本组件那一次 `setInterval` 筛出来，
 * 再从 mock 的返回值里取句柄，用它去断言 `clearInterval` 被正确调用。
 */
const captureInterval = (setSpy: jest.SpyInstance, speed: number): unknown => {
    const index = setSpy.mock.calls.findIndex((call) => call[1] === speed);
    expect(index).toBeGreaterThanOrEqual(0);
    return setSpy.mock.results[index].value as unknown;
};

let setSpy: jest.SpyInstance;
let clearSpy: jest.SpyInstance;

beforeEach(() => {
    jest.useFakeTimers();
    // 用 `globalThis` 而不是 `global`：本仓库的独立 tsc 命令只带 `--lib ESNext`
    // 与 `--types jest`，没有 node 全局声明，`global` 会报 TS2304。
    setSpy = jest.spyOn(globalThis, 'setInterval');
    clearSpy = jest.spyOn(globalThis, 'clearInterval');
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe('Typewriter', () => {
    it('autoPlay=false 时直接显示全部文本', async () => {
        const { getByText, getByTestId } = await render(
            <Typewriter testID="tw" autoPlay={false}>
                Hello
            </Typewriter>
        );
        expect(getByText('Hello')).toBeTruthy();
        expect(getByTestId('tw')).toHaveTextContent('Hello', { exact: true });
    });

    it('autoPlay=true 时按 speed 逐字显示', async () => {
        const { getByTestId } = await render(
            <Typewriter testID="tw" speed={50} autoPlay>
                ABCD
            </Typewriter>
        );
        const tw = getByTestId('tw');

        // 初始 0 字符
        expect(tw).toHaveTextContent('', { exact: true });

        await advance(50);
        expect(tw).toHaveTextContent('A', { exact: true });

        await advance(150);
        expect(tw).toHaveTextContent('ABCD', { exact: true });
    });

    it('完成后触发 onDone', async () => {
        const onDone = jest.fn();
        await render(
            <Typewriter testID="tw" speed={20} autoPlay onDone={onDone}>
                AB
            </Typewriter>
        );
        await advance(200);
        expect(onDone).toHaveBeenCalled();
    });

    it('保留嵌套元素的结构', async () => {
        // Web 版用 <strong data-testid="bold">；RN 里文字节点一律是 <Text>
        const { getByTestId } = await render(
            <Typewriter testID="tw" autoPlay={false}>
                <Text testID="bold">Bold</Text>Tail
            </Typewriter>
        );
        expect(getByTestId('bold')).toBeTruthy();
        expect(getByTestId('bold')).toHaveTextContent('Bold', { exact: true });
    });

    it('trigger 变更后从头重放', async () => {
        const { rerender, getByTestId } = await render(
            <Typewriter testID="tw" speed={20} trigger={1}>
                AB
            </Typewriter>
        );
        await advance(200);
        expect(getByTestId('tw')).toHaveTextContent('AB', { exact: true });

        await rerender(
            <Typewriter testID="tw" speed={20} trigger={2}>
                AB
            </Typewriter>
        );
        // 触发变更后重置为 0
        expect(getByTestId('tw')).toHaveTextContent('', { exact: true });
    });

    // ---------- RN 专有：外层 <Text>（RN 硬约束）----------

    it('最外层渲染为 <Text>（RN 要求字符串必须有 Text 祖先，上游的「零包裹」做不到）', async () => {
        const { getByTestId } = await render(<Typewriter testID="tw">Hi</Typewriter>);
        expect(child(getByTestId('tw')).type).toBe('Text');
    });

    it('style / testID 透传到外层 <Text>', async () => {
        const { getByTestId } = await render(
            <Typewriter testID="tw" style={{ fontSize: 18, color: '#794f27' }} autoPlay={false}>
                Hi
            </Typewriter>
        );
        expect(getByTestId('tw')).toHaveStyle({ fontSize: 18, color: '#794f27' });
    });

    // ---------- RN 专有：裁剪逻辑的边界 ----------

    it('裁剪会跨元素边界：先填满前一个 Text，再进入后一个', async () => {
        const { getByTestId } = await render(
            <Typewriter testID="tw" speed={20}>
                <Text testID="bold">Bo</Text>ld
            </Typewriter>
        );
        // 总数 2 + 2 = 4；推进到第 3 个字符
        await advance(60);
        expect(getByTestId('bold')).toHaveTextContent('Bo', { exact: true });
        expect(getByTestId('tw')).toHaveTextContent('Bol', { exact: true });
    });

    it('播放完成后清理定时器（不会一直空转）', async () => {
        const { getByTestId } = await render(
            <Typewriter testID="tw" speed={20}>
                AB
            </Typewriter>
        );
        const timerId = captureInterval(setSpy, 20);

        // 20 / 40 / 60 —— 第三次 tick 发现 c >= total，清掉 interval
        await advance(60);
        expect(getByTestId('tw')).toHaveTextContent('AB', { exact: true });
        expect(clearSpy).toHaveBeenCalledWith(timerId);
    });

    it('卸载时清理定时器', async () => {
        const { unmount } = await render(
            <Typewriter testID="tw" speed={20}>
                AB
            </Typewriter>
        );
        const timerId = captureInterval(setSpy, 20);

        await unmount();
        expect(clearSpy).toHaveBeenCalledWith(timerId);
    });

    it('空 children：total 为 0，不建定时器也不触发 onDone', async () => {
        const onDone = jest.fn();
        const { getByTestId } = await render(<Typewriter testID="tw" speed={20} onDone={onDone} />);

        expect(getByTestId('tw')).toHaveTextContent('', { exact: true });
        // 没有任何延迟为 speed 的 interval 被创建
        expect(setSpy.mock.calls.some((call) => call[1] === 20)).toBe(false);
        await advance(500);
        expect(onDone).not.toHaveBeenCalled();
    });

    it('autoPlay=false 时挂载即触发 onDone（上游行为：count 初始就等于 total）', async () => {
        const onDone = jest.fn();
        await render(
            <Typewriter testID="tw" autoPlay={false} onDone={onDone}>
                Hello
            </Typewriter>
        );
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('speed 变化会重启动画', async () => {
        const { rerender, getByTestId } = await render(
            <Typewriter testID="tw" speed={50}>
                AB
            </Typewriter>
        );
        await advance(50);
        expect(getByTestId('tw')).toHaveTextContent('A', { exact: true });

        await rerender(
            <Typewriter testID="tw" speed={20}>
                AB
            </Typewriter>
        );
        expect(getByTestId('tw')).toHaveTextContent('', { exact: true });
    });
});
