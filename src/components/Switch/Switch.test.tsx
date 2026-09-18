import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer' with { 'resolution-mode': 'import' };
import { Switch } from './Switch';

/**
 * RN 版测试，对应 Web 版 `Switch.test.tsx` 的 14 个用例。
 *
 * **被丢弃的用例**（RN 无对应能力）：
 *   - `应用 className` —— RN 无类名系统。改用 `style` / `testID` 透传断言（见「透传」一节）。
 *   - `size=small 应用对应类` —— 改为断言真实尺寸（minWidth / height / 把手尺寸）。
 *   - `Space 键 toggle` / `Enter 键 toggle` / `disabled 时键盘不响应` 共 3 个 ——
 *     RN 没有 DOM 键盘事件；`onKeyDown` 在移植时整段删除。触摸设备上「键盘 toggle」
 *     的角色由系统读屏（TalkBack / VoiceOver 的双击手势）承担，RN 侧无 API 可测。
 *
 * **写断言前要知道的三件事**（实测，非推断）：
 *   1. `fireEvent.press` **会绕过 Pressability**：RNTL 先找宿主节点自己的 `onPress`，
 *      找不到就沿着 fiber 往上走，于是直接命中 Pressable 组件的 `onPress` prop。
 *      所以「不可交互」不能只靠 handler 内部 `return` —— 必须把 `onPress` 传 `undefined`，
 *      否则测试会误报成「点击生效」。本组件的实现就是这么做的。
 *   2. `pointerEvents="none"`（loading 态）会让 RNTL **直接判定事件不可用**
 *      （`eventsAffectedByPointerEventsProp`），所以 loading 的用例是「事件被拦住」而不是
 *      「handler 被拦住」。两者在真机上等价，但测试里要区分清楚。
 *   3. 动画是 JS 驱动（`useNativeDriver: false`，颜色插值只能走 JS），必须配假定时器，
 *      否则动画帧会落在 `act` 之外刷屏警告 —— 与 `Collapse.test.tsx` 同样的处理。
 */
const child = (node: unknown) => node as TestInstance;

const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** 读 Animated 节点的当前值（`Animated.createAnimatedComponent` 通常已经把它解析成普通值） */
const animatedValue = (value: unknown): unknown => {
    const v = value as { __getValue?: () => unknown } | null;
    return typeof v?.__getValue === 'function' ? v.__getValue() : value;
};

const layout = (width: number, height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

/** 推进动画帧（见文件头第 3 点） */
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

describe('Switch', () => {
    describe('渲染', () => {
        it('挂载为 role="switch"，初始 aria-checked=false', async () => {
            const { getByRole, getByTestId } = await render(<Switch testID="s" />);
            expect(getByRole('switch')).toBeTruthy();
            expect(getByTestId('s').props.accessibilityState).toMatchObject({ checked: false });
        });

        it('default 尺寸：轨道 52×28、把手 21、inset 硬偏移阴影', async () => {
            const { getByTestId } = await render(<Switch testID="s" />);
            const root = getByTestId('s');
            expect(root).toHaveStyle({ minWidth: 52, height: 28, borderRadius: 50, borderWidth: 2.5 });
            // CSS: box-shadow: inset 0 2px 4px rgba(114, 93, 66, 0.15)（上游省略了 spread）
            expect(root).toHaveStyle({ boxShadow: 'inset 0 2px 4px 0 rgba(114, 93, 66, 0.15)' });

            const handle = getByTestId('s-handle');
            expect(handle).toHaveStyle({ width: 21, height: 21, borderRadius: 10.5, left: 2, top: 1 });
        });

        it('size=small 应用小尺寸规格（38×20、把手 14）', async () => {
            const { getByTestId } = await render(<Switch testID="s" size="small" />);
            expect(getByTestId('s')).toHaveStyle({ minWidth: 38, height: 20 });
            expect(getByTestId('s-handle')).toHaveStyle({ width: 14, height: 14, left: 1, top: 0.5 });
        });

        it('checkedChildren / unCheckedChildren 按状态显示', async () => {
            const { rerender, getByText } = await render(
                <Switch checked={false} checkedChildren="ON" unCheckedChildren="OFF" />
            );
            expect(getByText('OFF')).toBeTruthy();

            await rerender(<Switch checked checkedChildren="ON" unCheckedChildren="OFF" />);
            expect(getByText('ON')).toBeTruthy();
        });

        it('文案两侧内边距随选中态翻转（给把手让位）', async () => {
            const { getByTestId, rerender } = await render(<Switch testID="s" checkedChildren="ON" />);
            expect(getByTestId('s-inner')).toHaveStyle({ paddingLeft: 28, paddingRight: 8 });

            await rerender(<Switch testID="s" checked checkedChildren="ON" />);
            expect(getByTestId('s-inner')).toHaveStyle({ paddingLeft: 8, paddingRight: 28 });
        });

        it('文案字号 / 行高 / 字距随尺寸变化', async () => {
            const { getByTestId, rerender } = await render(<Switch testID="s" checkedChildren="ON" />);
            expect(getByTestId('s-inner')).toHaveStyle({ fontSize: 11, lineHeight: 11, letterSpacing: 0.22 });

            await rerender(<Switch testID="s" size="small" checkedChildren="ON" />);
            expect(getByTestId('s-inner')).toHaveStyle({ fontSize: 9, lineHeight: 9, letterSpacing: 0.18 });
        });
    });

    describe('非受控', () => {
        it('defaultChecked=true 初始选中', async () => {
            const { getByTestId } = await render(<Switch testID="s" defaultChecked />);
            expect(getByTestId('s').props.accessibilityState).toMatchObject({ checked: true });
        });

        it('点击切换并触发 onChange', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Switch testID="s" onChange={onChange} />);
            const root = getByTestId('s');

            await fireEvent.press(root);
            expect(onChange).toHaveBeenCalledWith(true);
            expect(root.props.accessibilityState).toMatchObject({ checked: true });

            await fireEvent.press(root);
            expect(onChange).toHaveBeenLastCalledWith(false);
            expect(root.props.accessibilityState).toMatchObject({ checked: false });
        });
    });

    describe('受控', () => {
        it('checked 受控时不自更新', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Switch testID="s" checked={false} onChange={onChange} />);
            await fireEvent.press(getByTestId('s'));
            expect(onChange).toHaveBeenCalledWith(true);
            // 父级没回写 → 仍显示未选中
            expect(getByTestId('s').props.accessibilityState).toMatchObject({ checked: false });
        });

        it('父级回写后 UI 同步', async () => {
            // Web 版用 @test/components 的 ControlledHost；RN 侧内联一个等价宿主
            const Host = () => {
                const [value, setValue] = useState(false);
                return <Switch testID="s" checked={value} onChange={setValue} />;
            };
            const { getByTestId } = await render(<Host />);
            const root = getByTestId('s');
            expect(root.props.accessibilityState).toMatchObject({ checked: false });

            await fireEvent.press(root);
            expect(root.props.accessibilityState).toMatchObject({ checked: true });
        });
    });

    describe('disabled / loading', () => {
        it('disabled 时点击不触发 onChange，且 accessibilityState.disabled 为 true', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Switch testID="s" disabled onChange={onChange} />);
            const root = getByTestId('s');
            expect(root.props.accessibilityState).toMatchObject({ disabled: true });
            await fireEvent.press(root);
            expect(onChange).not.toHaveBeenCalled();
            // `.switch-disabled { opacity: 0.5 }`
            expect(root).toHaveStyle({ opacity: 0.5 });
        });

        it('loading 时点击不触发 onChange，pointerEvents=none，accessibilityState.busy 为 true', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Switch testID="s" loading onChange={onChange} />);
            const root = getByTestId('s');
            expect(root.props.accessibilityState).toMatchObject({ busy: true });
            // Web 的 `.switch-loading { pointer-events: none }`
            expect(root.props.pointerEvents).toBe('none');
            await fireEvent.press(root);
            expect(onChange).not.toHaveBeenCalled();
            // `.switch-loading { opacity: 0.7 }`
            expect(root).toHaveStyle({ opacity: 0.7 });
        });

        it('loading 时渲染旋转指示器，非 loading 时不渲染', async () => {
            const { queryByTestId, rerender } = await render(<Switch testID="s" />);
            expect(queryByTestId('s-spinner')).toBeNull();

            await rerender(<Switch testID="s" loading />);
            expect(queryByTestId('s-spinner')).toBeTruthy();
        });

        it('指示器描边色随选中态切换（checked #6fba2c / unchecked #a89878）', async () => {
            const { getByTestId, rerender } = await render(<Switch testID="s" loading />);
            expect(getByTestId('s-spinner')).toHaveStyle({ borderColor: '#a89878' });

            await rerender(<Switch testID="s" loading checked />);
            expect(getByTestId('s-spinner')).toHaveStyle({ borderColor: '#6fba2c' });
        });
    });

    describe('a11y', () => {
        it('aria-label 透传并成为可访问名', async () => {
            const { getByLabelText, getByTestId } = await render(<Switch testID="s" aria-label="深色模式" />);
            expect(getByTestId('s').props.accessibilityLabel).toBe('深色模式');
            expect(getByLabelText('深色模式')).toBeTruthy();
        });

        it('aria-labelledby 原样透传', async () => {
            const { getByTestId } = await render(<Switch testID="s" aria-labelledby="label-id" />);
            // Pressable 不做 `aria-labelledby` → `accessibilityLabelledBy` 的改写（那是 View.js
            // 的职责），而 jest preset 把 View 整个 mock 掉了，所以这里只能证明**透传**成立。
            expect(getByTestId('s').props['aria-labelledby']).toBe('label-id');
        });
    });

    describe('透传', () => {
        it('style / testID 透传，且 style 排在最后可覆盖默认值', async () => {
            const { getByTestId } = await render(<Switch testID="s" style={{ marginTop: 4, minWidth: 80 }} />);
            const root = getByTestId('s');
            expect(root).toHaveStyle({ marginTop: 4, minWidth: 80 });
            expect(root).toHaveStyle({ borderRadius: 50 });
        });
    });

    // ---------- RN 专有：Animated 替代 CSS transition ----------

    describe('选中动画（替代 CSS transition: all 0.25s）', () => {
        // ⚠️ 颜色插值的结果是 `rgba(r, g, b, 1)`，**不是**原来的 hex —— RN 的
        // `interpolate` 走的是颜色空间插值，端点也一并归一化成 rgba 字符串。
        const rgba = (r: number, g: number, b: number) => `rgba(${r}, ${g}, ${b}, 1)`;

        it('未选中 → 选中：轨道背景与描边插值到选中色', async () => {
            const { getByTestId } = await render(<Switch testID="s" />);
            const root = getByTestId('s');
            // #d4c9b4
            expect(animatedValue(styleOf(root).backgroundColor)).toBe(rgba(212, 201, 180));

            await fireEvent.press(root);
            await settleAnimation();
            expect(animatedValue(styleOf(root).backgroundColor)).toBe(rgba(134, 214, 122)); // #86d67a
            expect(animatedValue(styleOf(root).borderColor)).toBe(rgba(111, 186, 44)); // #6fba2c
            // box-shadow 无法插值，是瞬间切换的
            expect(styleOf(root).boxShadow).toBe('inset 0 2px 4px 0 rgba(90, 158, 30, 0.2)');
        });

        it('把手描边色跟随插值', async () => {
            const { getByTestId } = await render(<Switch testID="s" />);
            expect(animatedValue(styleOf(getByTestId('s-handle')).borderColor)).toBe(rgba(196, 184, 158)); // #c4b89e

            await fireEvent.press(getByTestId('s'));
            await settleAnimation();
            expect(animatedValue(styleOf(getByTestId('s-handle')).borderColor)).toBe(rgba(111, 186, 44));
        });

        it('未量到轨道宽度时把手位移为 0（测试渲染器不触发 onLayout）', async () => {
            const { getByTestId } = await render(<Switch testID="s" defaultChecked />);
            await settleAnimation();
            expect(styleOf(getByTestId('s-handle')).transform).toEqual([{ translateX: 0 }]);
        });

        it('量宽后把手位移 = 内边距盒宽 - 右内边距 - 把手宽 - 左偏移', async () => {
            const { getByTestId } = await render(<Switch testID="s" />);
            const root = getByTestId('s');
            await fireEvent(root, 'layout', layout(52, 28));

            await fireEvent.press(root);
            await settleAnimation();
            // (52 - 2*2.5) - 3 - 21 - 2 = 21
            expect(styleOf(getByTestId('s-handle')).transform).toEqual([{ translateX: 21 }]);
        });

        it('small 尺寸的位移按 small 规格计算', async () => {
            const { getByTestId } = await render(<Switch testID="s" size="small" />);
            const root = getByTestId('s');
            await fireEvent(root, 'layout', layout(38, 20));

            await fireEvent.press(root);
            await settleAnimation();
            // (38 - 2*2.5) - 2 - 14 - 1 = 16
            expect(styleOf(getByTestId('s-handle')).transform).toEqual([{ translateX: 16 }]);
        });

        it('收起时位移回到 0', async () => {
            const { getByTestId } = await render(<Switch testID="s" defaultChecked />);
            const root = getByTestId('s');
            await fireEvent(root, 'layout', layout(52, 28));
            await settleAnimation();
            expect(styleOf(getByTestId('s-handle')).transform).toEqual([{ translateX: 21 }]);

            await fireEvent.press(root);
            await settleAnimation();
            expect(styleOf(getByTestId('s-handle')).transform).toEqual([{ translateX: 0 }]);
        });
    });

    describe('结构', () => {
        it('把手与文案都挂在根节点下（顺序：把手在前）', async () => {
            const { getByTestId } = await render(<Switch testID="s" checkedChildren="ON" />);
            const root = getByTestId('s');
            expect(root.children).toHaveLength(2);
            expect(child(child(root.children[0]).props.testID)).toBe('s-handle');
            expect(child(child(root.children[1]).props.testID)).toBe('s-inner');
        });
    });
});
