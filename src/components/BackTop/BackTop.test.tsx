import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { BackTop } from './BackTop';

/**
 * RN 版测试，对应 Web 版 `BackTop.test.tsx` 的 5 个用例。
 *
 * **被丢弃 / 改写的 Web 用例**：
 *   - `键盘 Enter 触发 onClick` —— RN 没有 DOM 键盘事件（Web 版的 `onKeyDown` 整段删除）。
 *     触摸设备上等价的操作是读屏的「双击」，RN 侧没有可测的 API。
 *   - `应用自定义 className 和 style` —— RN 无 className，改为 `style` / `testID` 透传。
 *   - `渲染默认 icon（图片）+ alt="返回顶部"` —— RN 没有 svg 资源导入，`<img>` 换成
 *     `react-native-svg` 复刻的 `RocketIcon`，也没有 `alt`；可访问名改由外层
 *     `aria-label="返回顶部"` 承担（断言随之改写）。
 *   - `默认隐藏（无 visible 类）` —— 类名换成 `pointerEvents` / `aria-hidden` / 动画值。
 *
 * **RN 专有的新增覆盖**：`scrollY` ↔ `visibilityHeight` 的阈值判定（含「严格大于」的
 * 边界）、可见性切换的淡入淡出、以及「隐藏时不在无障碍树里」。
 *
 * **测不到的部分**：
 *   - **真的滚回顶部**：RN 的 `ScrollView.scrollTo` 需要原生滚动节点，测试渲染器里没有。
 *     组件已经不再自己滚动（见 BackTop.tsx 的 API 决策），所以这条由宿主负责，
 *     本组件侧无从断言 —— 只断言 `onPress` 被调用。
 *   - `boxShadow` 的实际观感（drop-shadow 的近似），以及 `position: absolute` 在真机上
 *     是否被祖先裁剪 —— 需要设备 / 模拟器。
 */
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
 * 隐藏态的 BackTop 带 `aria-hidden`（对应 CSS 的 `visibility: hidden`），而 RNTL 的
 * **所有**查询默认都会跳过 aria-hidden 子树 —— 不只是 `getByRole`。要断言隐藏态的
 * 样式与 props，必须显式带上 `includeHiddenElements`。
 */
const HIDDEN = { includeHiddenElements: true } as const;

/** 读 Animated 节点的当前值（`createAnimatedComponent` 通常已经把它解析成普通值） */
const animatedValue = (value: unknown): unknown => {
    const v = value as { __getValue?: () => unknown } | null;
    return typeof v?.__getValue === 'function' ? v.__getValue() : value;
};

const translateYOf = (node: TestInstance) => (styleOf(node).transform as { translateY: unknown }[])[0].translateY;

const settleAnimation = (ms = 400) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('BackTop', () => {
    describe('可见性', () => {
        it('默认隐藏：opacity 0、下移 10px、pointerEvents=none 且 aria-hidden', async () => {
            const { getByTestId } = await render(<BackTop testID="b" />);
            const root = getByTestId('b', HIDDEN);
            expect(styleOf(root).opacity).toBe(0);
            expect(translateYOf(root)).toBe(10); // `.backtop { transform: translateY(10px) }`
            // CSS 的 `visibility: hidden` 在 RN 里拆成这两条
            expect(root.props.pointerEvents).toBe('none');
            expect(root.props['aria-hidden']).toBe(true);
        });

        it('scrollY 恰好等于 visibilityHeight 时仍隐藏（判定是严格大于）', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={400} visibilityHeight={400} />);
            expect(getByTestId('b', HIDDEN).props.pointerEvents).toBe('none');
        });

        it('scrollY 超过 visibilityHeight 后显示', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={401} visibilityHeight={400} />);
            const root = getByTestId('b');
            expect(root.props.pointerEvents).toBe('auto');
            expect(root.props['aria-hidden']).toBe(false);
        });

        it('visibilityHeight 可配置', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={150} visibilityHeight={100} />);
            expect(getByTestId('b').props.pointerEvents).toBe('auto');
        });

        it('scrollY 回落到阈值以下后再次隐藏', async () => {
            const { getByTestId, rerender } = await render(<BackTop testID="b" scrollY={800} />);
            expect(getByTestId('b').props.pointerEvents).toBe('auto');

            await rerender(<BackTop testID="b" scrollY={10} />);
            expect(getByTestId('b', HIDDEN).props.pointerEvents).toBe('none');
            expect(getByTestId('b', HIDDEN).props['aria-hidden']).toBe(true);
        });
    });

    describe('显示 / 隐藏动画（替代 CSS transition）', () => {
        it('显示：opacity 0→1、translateY 10→0', async () => {
            const { getByTestId, rerender } = await render(<BackTop testID="b" scrollY={0} />);
            expect(styleOf(getByTestId('b', HIDDEN)).opacity).toBe(0);

            await rerender(<BackTop testID="b" scrollY={800} />);
            await settleAnimation();
            expect(styleOf(getByTestId('b')).opacity).toBe(1);
            expect(translateYOf(getByTestId('b'))).toBe(0);
        });

        it('隐藏：opacity 1→0、translateY 0→10', async () => {
            const { getByTestId, rerender } = await render(<BackTop testID="b" scrollY={800} />);
            await settleAnimation();
            expect(styleOf(getByTestId('b')).opacity).toBe(1);

            await rerender(<BackTop testID="b" scrollY={0} />);
            await settleAnimation();
            expect(styleOf(getByTestId('b', HIDDEN)).opacity).toBe(0);
            expect(translateYOf(getByTestId('b', HIDDEN))).toBe(10);
        });

        it('初始就可见时不需要动画也是不透明的（避免首帧闪一下）', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} />);
            // Animated.Value 的初值即目标值
            expect(animatedValue(styleOf(getByTestId('b')).opacity)).toBe(1);
        });
    });

    describe('交互', () => {
        it('点击触发 onPress', async () => {
            const onPress = jest.fn();
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} onPress={onPress} />);
            await fireEvent.press(getByTestId('b'));
            expect(onPress).toHaveBeenCalledTimes(1);
        });

        it('onPress 收到 GestureResponderEvent', async () => {
            const onPress = jest.fn();
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} onPress={onPress} />);
            await fireEvent.press(getByTestId('b'));
            expect(onPress.mock.calls[0][0]).toBeTruthy();
        });

        it('隐藏时事件被 pointerEvents 拦住，点击不触发 onPress', async () => {
            const onPress = jest.fn();
            const { getByTestId } = await render(<BackTop testID="b" scrollY={0} onPress={onPress} />);
            await fireEvent.press(getByTestId('b', HIDDEN));
            expect(onPress).not.toHaveBeenCalled();
        });
    });

    describe('a11y', () => {
        it('显示时角色为 button，可访问名默认「返回顶部」', async () => {
            const { getByRole } = await render(<BackTop testID="b" scrollY={800} />);
            expect(getByRole('button', { name: '返回顶部' })).toBeTruthy();
        });

        it('隐藏时不在无障碍树里（对应 CSS visibility: hidden）', async () => {
            const { queryByRole } = await render(<BackTop testID="b" scrollY={0} />);
            expect(queryByRole('button')).toBeNull();
        });

        it('accessibilityLabel 可覆盖默认名', async () => {
            const { getByRole } = await render(<BackTop testID="b" scrollY={800} accessibilityLabel="回到顶部" />);
            expect(getByRole('button', { name: '回到顶部' })).toBeTruthy();
        });

        it('可聚焦（对应 Web 的 tabIndex={0} → RN 的 focusable）', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} />);
            expect(getByTestId('b').props.focusable).toBe(true);
        });
    });

    describe('渲染', () => {
        it('渲染火箭图标（react-native-svg 复刻 rocket.svg）', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} />);
            const icon = getByTestId('b-icon');
            expect(icon).toHaveStyle({ width: 64, height: 64 });
            // drop-shadow 的近似：boxShadow 打在图标容器上
            expect(icon).toHaveStyle({ boxShadow: '0 4px 10px 0 rgba(91, 78, 30, 0.22)' });

            const types = (function walk(node: TestInstance): string[] {
                return [
                    typeof node.type === 'string' ? node.type : '',
                    ...node.children.flatMap((c) => walk(c as TestInstance)),
                ].filter(Boolean);
            })(icon);
            expect(types.some((t) => t.toLowerCase().includes('svg'))).toBe(true);
        });

        it('固定定位的对应物：absolute + bottom 32 / right 24 / zIndex 1000', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} />);
            expect(getByTestId('b')).toHaveStyle({
                position: 'absolute',
                bottom: 32,
                right: 24,
                zIndex: 1000,
            });
        });

        it('style / testID 透传，且 style 排在最后可覆盖默认值', async () => {
            const { getByTestId } = await render(<BackTop testID="b" scrollY={800} style={{ bottom: 100 }} />);
            const root = getByTestId('b');
            expect(root).toHaveStyle({ bottom: 100, right: 24 });
            expect(root.props.testID).toBe('b');
        });
    });
});
