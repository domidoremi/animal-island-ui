import React from 'react';
import { Animated, TextInput } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { ThemeTransitionProvider, useThemeTransition } from './ThemeTransition';

let run: ReturnType<typeof useThemeTransition>;
let callbacks: ((result: { finished: boolean }) => void)[];
function Probe() {
    run = useThemeTransition();
    return <TextInput testID="draft" defaultValue="keep this draft" />;
}
const tree = (reducedMotion = false) => (
    <ThemeTransitionProvider reducedMotion={reducedMotion}>
        <Probe />
    </ThemeTransitionProvider>
);
const frame = async () => {
    await act(async () => {
        jest.advanceTimersByTime(17);
    });
};
const expectDeadlineCleared = () => {
    const index = jest.mocked(setTimeout).mock.calls.findIndex((call) => call[1] === 1200);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(clearTimeout).toHaveBeenCalledWith(jest.mocked(setTimeout).mock.results[index].value);
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'clearTimeout');
    callbacks = [];
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
        start: (callback) => {
            if (callback) callbacks.push(callback);
        },
        stop: jest.fn(),
        reset: jest.fn(),
    }));
});
afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

it('先覆盖再应用并揭示，不重新挂载输入框', async () => {
    const screen = await render(tree());
    const input = screen.getByTestId('draft');
    const update = jest.fn();
    let settled!: Promise<void>;
    await act(() => {
        settled = run(update, { origin: { x: 12, y: 30 }, color: '#20251e' });
    });
    expect(update).not.toHaveBeenCalled();
    expect(screen.getByTestId('theme-transition-cover', { includeHiddenElements: true }).props.pointerEvents).toBe(
        'none'
    );
    await frame();
    await frame();
    expect(Animated.timing).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ useNativeDriver: true, duration: 190 })
    );
    await act(() => callbacks[0]({ finished: true }));
    expect(update).toHaveBeenCalledTimes(1);
    await frame();
    await frame();
    await act(() => callbacks[1]({ finished: true }));
    await settled;
    expect(screen.queryByTestId('theme-transition-cover', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('draft')).toBe(input);
    expectDeadlineCleared();
});

it('连续请求按顺序各应用一次，旧动画不能覆盖新选择', async () => {
    const screen = await render(tree());
    const order: string[] = [];
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(() => {
        first = run(() => order.push('family'));
    });
    await frame();
    await frame();
    const staleFinish = callbacks[0];
    await act(() => {
        second = run(() => order.push('mode'));
    });
    expect(order).toEqual(['family']);
    await act(() => staleFinish({ finished: true }));
    await act(() => {
        jest.advanceTimersByTime(1200);
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['family', 'mode']);
    expect(screen.queryByTestId('theme-transition-cover', { includeHiddenElements: true })).toBeNull();
});

it('减少动态效果立即应用，不创建动画或超时等待', async () => {
    const screen = await render(tree(true));
    const update = jest.fn();
    await act(async () => {
        await run(update);
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(Animated.timing).not.toHaveBeenCalled();
    expect(setTimeout).not.toHaveBeenCalledWith(expect.any(Function), 1200);
    expect(screen.queryByTestId('theme-transition-cover', { includeHiddenElements: true })).toBeNull();
});

it('中途开启减少动态效果会立即完成并移除覆盖层', async () => {
    const screen = await render(tree());
    const update = jest.fn();
    let settled!: Promise<void>;
    await act(() => {
        settled = run(update);
    });
    await screen.rerender(tree(true));
    await settled;
    expect(update).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('theme-transition-cover', { includeHiddenElements: true })).toBeNull();
});

it('动画未回调时限时降级，设置仍应用且覆盖层清理', async () => {
    const screen = await render(tree());
    const update = jest.fn();
    let settled!: Promise<void>;
    await act(() => {
        settled = run(update);
    });
    await act(() => {
        jest.advanceTimersByTime(1200);
    });
    await settled;
    expect(update).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('theme-transition-cover', { includeHiddenElements: true })).toBeNull();
    expectDeadlineCleared();
});

it('更新失败传递错误，并允许后续操作', async () => {
    const screen = await render(tree());
    const error = new Error('update failed');
    const failure = jest.fn();
    await act(() => {
        run(() => {
            throw error;
        }).catch(failure);
    });
    await act(() => {
        jest.advanceTimersByTime(1200);
    });
    expect(failure).toHaveBeenCalledWith(error);
    await screen.rerender(tree(true));
    const update = jest.fn();
    await act(async () => {
        await run(update);
    });
    expect(update).toHaveBeenCalledTimes(1);
});

it('卸载取消尚未应用的工作，迟到帧不再触发更新', async () => {
    const screen = await render(tree());
    const update = jest.fn();
    let settled!: Promise<void>;
    await act(() => {
        settled = run(update);
    });
    await screen.unmount();
    await settled;
    await act(() => {
        jest.advanceTimersByTime(2000);
    });
    expect(update).not.toHaveBeenCalled();
    expectDeadlineCleared();
});
