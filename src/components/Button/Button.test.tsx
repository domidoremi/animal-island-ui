import React from 'react';
import { View } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Button } from './Button';
import { colors } from '../../theme/tokens';

/**
 * RN 版测试，对应 Web 版 `Button.test.tsx` 的 18 个用例。
 *
 * **被丢弃的用例**（RN 无对应能力）：
 *   - `htmlType` 相关 3 个（default / submit / reset）—— RN 没有原生 button type。
 *   - 键盘 Enter / Space / disabled+Enter 共 3 个 —— RN 没有 DOM 键盘事件。
 *   - `className` 透传 —— RN 无 className。
 * 其余全部保留，并补了 RN 专有的按下态与 boxShadow 断言。
 */
const child = (node: unknown) => node as TestInstance;

/**
 * 模拟「手指按住」。
 *
 * Pressable 的 `pressed` 状态由 Pressability 驱动，而 Pressability 只把 responder
 * 事件挂到宿主 View 上（`onResponderGrant` / `onResponderRelease`），**不暴露
 * `onPressIn`** —— 所以 `fireEvent(root, 'pressIn')` 打不到它。
 * RNTL 自己的 `userEvent.press()` 走的就是下面这条路径，但它会一直等到
 * pressOut 之后才返回，中途的 pressed=true 观察不到。
 * 这里复刻 RNTL 内部的事件形状，只发 grant / release，从而能断言按下态样式。
 *
 * `currentTarget` 必须带一个 `measure` 桩：Pressability 在首次转为按下态时会执行
 * `this._responderID.measure(callback)` 去量取 responder 区域，而测试渲染器的宿主
 * 实例没有原生 `measure`。
 */
const responderEvent = (registrationName: string) => ({
    currentTarget: { measure: () => {} },
    target: {},
    preventDefault: () => {},
    isDefaultPrevented: () => false,
    stopPropagation: () => {},
    isPropagationStopped: () => false,
    persist: () => {},
    isPersistent: () => false,
    timeStamp: 0,
    nativeEvent: {
        changedTouches: [],
        identifier: 0,
        locationX: 0,
        locationY: 0,
        pageX: 0,
        pageY: 0,
        target: 0,
        timestamp: Date.now(),
        touches: [],
    },
    dispatchConfig: { registrationName },
});

const pressIn = (node: TestInstance) => fireEvent(node, 'responderGrant', responderEvent('onResponderGrant'));
const pressOut = (node: TestInstance) => fireEvent(node, 'responderRelease', responderEvent('onResponderRelease'));

/** 取根节点上展开后的样式对象（RNTL 的 toHaveStyle 已做子集匹配，这里用于读值） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

describe('Button', () => {
    it('渲染 children 文案', async () => {
        const { getByText } = await render(<Button>OK</Button>);
        expect(getByText('OK')).toBeTruthy();
    });

    it('无障碍角色为 button，并带可访问名', async () => {
        const { getByRole } = await render(<Button>保存</Button>);
        expect(getByRole('button', { name: '保存' })).toBeTruthy();
    });

    it('应用 type=primary / size=large 的尺寸与硬偏移阴影', async () => {
        const { getByTestId } = await render(
            <Button testID="b" type="primary" size="large">
                OK
            </Button>
        );
        const root = getByTestId('b');
        expect(root).toHaveStyle({ height: 48, borderRadius: 24, paddingHorizontal: 32 });
        // CSS: box-shadow: 0 5px 0 0 #bdaea0 —— 零模糊硬偏移，RN 用 boxShadow 逐字还原
        expect(root).toHaveStyle({ boxShadow: '0 5px 0 0 #bdaea0' });
    });

    it('danger / ghost / block / loading 单独应用', async () => {
        const { getByTestId, rerender } = await render(
            <Button testID="b" danger>
                x
            </Button>
        );
        expect(getByTestId('b')).toHaveStyle({ borderColor: colors.error });

        await rerender(
            <Button testID="b" ghost>
                x
            </Button>
        );
        expect(styleOf(getByTestId('b')).boxShadow).toBeUndefined();

        await rerender(
            <Button testID="b" block>
                x
            </Button>
        );
        expect(getByTestId('b')).toHaveStyle({ width: '100%', alignSelf: 'stretch' });

        await rerender(
            <Button testID="b" loading>
                x
            </Button>
        );
        expect(getByTestId('b')).toHaveStyle({ backgroundColor: '#0ec4b6', borderWidth: 4 });
    });

    it('非 block 时按内容宽度收缩（对应 Web 的 inline-flex）', async () => {
        const { getByTestId } = await render(<Button testID="b">x</Button>);
        expect(getByTestId('b')).toHaveStyle({ alignSelf: 'flex-start' });
    });

    it('disabled 时 accessibilityState.disabled 为 true 且点击不触发回调', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Button testID="b" disabled onPress={onPress}>
                x
            </Button>
        );
        const root = getByTestId('b');
        expect(root.props.accessibilityState).toMatchObject({ disabled: true });
        await fireEvent.press(root);
        expect(onPress).not.toHaveBeenCalled();
    });

    it('点击触发 onPress', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Button testID="b" onPress={onPress}>
                x
            </Button>
        );
        await fireEvent.press(getByTestId('b'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('onPress 收到 GestureResponderEvent', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Button testID="b" onPress={onPress}>
                x
            </Button>
        );
        await fireEvent.press(getByTestId('b'));
        expect(onPress.mock.calls[0][0]).toBeTruthy();
    });

    it('loading 时点击不触发 onPress，且 accessibilityState.busy 为 true', async () => {
        const onPress = jest.fn();
        const { getByTestId } = await render(
            <Button testID="b" loading onPress={onPress}>
                x
            </Button>
        );
        const root = getByTestId('b');
        expect(root.props.accessibilityState).toMatchObject({ busy: true });
        // Web 用 pointer-events: none，RN 用 pointerEvents="none"
        expect(root.props.pointerEvents).toBe('none');
        await fireEvent.press(root);
        expect(onPress).not.toHaveBeenCalled();
    });

    it('icon 在非 loading 时渲染，loading 时被替换为旋转指示器', async () => {
        const { queryByTestId, rerender } = await render(
            <Button testID="b" icon={<View testID="ic" />}>
                x
            </Button>
        );
        expect(queryByTestId('ic')).toBeTruthy();
        expect(queryByTestId('b-loading-icon')).toBeNull();

        await rerender(
            <Button testID="b" icon={<View testID="ic" />} loading>
                x
            </Button>
        );
        expect(queryByTestId('ic')).toBeNull();
        expect(queryByTestId('b-loading-icon')).toBeTruthy();
    });

    it('无 icon 且非 loading 时不渲染图标容器', async () => {
        const { getByTestId } = await render(<Button testID="b">x</Button>);
        // 只有文案一个子节点
        expect(getByTestId('b').children).toHaveLength(1);
    });

    it('children 为空时只渲染 button 容器', async () => {
        const { getByTestId } = await render(<Button testID="b" />);
        expect(getByTestId('b').children).toHaveLength(0);
    });

    it('children 与 icon 同时渲染（顺序：icon 在前）', async () => {
        const { getByTestId } = await render(
            <Button testID="b" icon={<View testID="ic" />}>
                label
            </Button>
        );
        const root = getByTestId('b');
        expect(root.children).toHaveLength(2);
        expect(child(child(root.children[0]).children[0]).props.testID).toBe('ic');
        expect(child(root.children[1]).type).toBe('Text');
    });

    it('type 全部枚举（primary / default / dashed / text / link）', async () => {
        const types = ['primary', 'default', 'dashed', 'text', 'link'] as const;
        for (const type of types) {
            const { getByTestId, unmount } = await render(
                <Button testID="b" type={type}>
                    x
                </Button>
            );
            const root = getByTestId('b');
            if (type === 'primary') expect(root).toHaveStyle({ boxShadow: '0 5px 0 0 #bdaea0' });
            if (type === 'default') expect(root).toHaveStyle({ boxShadow: '0 2px 4px 0 rgba(61, 52, 40, 0.06)' });
            if (type === 'dashed') expect(root).toHaveStyle({ borderStyle: 'dashed' });
            if (type === 'text') expect(root).toHaveStyle({ backgroundColor: 'transparent' });
            if (type === 'link') expect(child(root.children[0])).toHaveStyle({ color: colors.primary });
            await unmount();
        }
    });

    it('size 全部枚举（small / middle / large）', async () => {
        const sizes = [
            { size: 'small', height: 32, borderRadius: 16, fontSize: 12 },
            { size: 'middle', height: 45, borderRadius: 50, fontSize: 14 },
            { size: 'large', height: 48, borderRadius: 24, fontSize: 16 },
        ] as const;
        for (const spec of sizes) {
            const { getByTestId, unmount } = await render(
                <Button testID="b" size={spec.size}>
                    x
                </Button>
            );
            const root = getByTestId('b');
            expect(root).toHaveStyle({ height: spec.height, borderRadius: spec.borderRadius });
            expect(child(root.children[0])).toHaveStyle({ fontSize: spec.fontSize });
            await unmount();
        }
    });

    it('style / testID / accessibilityLabel 透传', async () => {
        const { getByTestId, getByLabelText } = await render(
            <Button testID="b" style={{ padding: 10 }} accessibilityLabel="go">
                x
            </Button>
        );
        expect(getByTestId('b')).toHaveStyle({ padding: 10 });
        expect(getByLabelText('go')).toBeTruthy();
    });

    // ---------- RN 专有：按下态 ----------

    it('按下时应用 :active 对应样式（primary 压下去 2px、阴影收窄到 1px）', async () => {
        const { getByTestId } = await render(
            <Button testID="b" type="primary">
                x
            </Button>
        );
        const root = getByTestId('b');
        expect(root).toHaveStyle({ boxShadow: '0 5px 0 0 #bdaea0' });

        await pressIn(root);
        expect(root).toHaveStyle({ boxShadow: '0 1px 0 0 #bdaea0' });
        expect(styleOf(root).transform).toEqual([{ translateY: 2 }]);

        // Pressability 在 responderRelease 之后还会等 RN 规定的最短按压时长
        // （DEFAULT_MIN_PRESS_DURATION = 130ms）才真正切回抬起态，所以要等。
        await pressOut(root);
        await waitFor(() => expect(root).toHaveStyle({ boxShadow: '0 5px 0 0 #bdaea0' }));
    });

    it('按下时 text 类型背景变深（darken(@bg-color-secondary, 5%) = #e9ddc6）', async () => {
        const { getByTestId } = await render(
            <Button testID="b" type="text">
                x
            </Button>
        );
        const root = getByTestId('b');
        await pressIn(root);
        expect(root).toHaveStyle({ backgroundColor: '#e9ddc6' });
    });

    it('按下时 default 类型文字与描边转主题色（对应 :active）', async () => {
        const { getByTestId } = await render(
            <Button testID="b" type="default">
                x
            </Button>
        );
        const root = getByTestId('b');
        await pressIn(root);
        expect(root).toHaveStyle({ borderColor: colors.primaryActive });
        expect(child(root.children[0])).toHaveStyle({ color: colors.primaryActive });
    });

    it('disabled 时按下不改变样式', async () => {
        const { getByTestId } = await render(
            <Button testID="b" type="primary" disabled>
                x
            </Button>
        );
        const root = getByTestId('b');
        await pressIn(root);
        // disabled 会去掉阴影，且不再叠按下态
        expect(styleOf(root).boxShadow).toBeUndefined();
        expect(styleOf(root).transform).toBeUndefined();
    });

    it('loading 时阴影被清掉（CSS .btn-loading { box-shadow: none }）', async () => {
        const { getByTestId } = await render(
            <Button testID="b" type="primary" loading>
                x
            </Button>
        );
        expect(styleOf(getByTestId('b')).boxShadow).toBeUndefined();
    });
});
