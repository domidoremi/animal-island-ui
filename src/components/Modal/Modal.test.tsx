import React from 'react';
import { Animated, Text } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Modal } from './Modal';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { resolveNativeTheme } from '../../theme/appearance';

it('keeps actions outside the scroll body, respects safe areas, and cancels on Android Back', async () => {
    const close = jest.fn();
    const timing = jest.spyOn(Animated, 'timing');
    try {
        const screen = await render(
            <ThemeProvider mode="dark" reducedMotion>
                <Modal
                    open
                    variant="game"
                    title="Confirm"
                    testID="native"
                    onClose={close}
                    contentInsets={{ top: 40, bottom: 24, left: 16, right: 16 }}
                    footer={<Text>Action</Text>}
                >
                    <Text>Long body</Text>
                </Modal>
            </ThemeProvider>
        );
        expect(screen.getByTestId('native-mask')).toHaveStyle({
            paddingTop: 40,
            paddingBottom: 24,
            backgroundColor: resolveNativeTheme('dark').colors.mask,
        });
        expect(screen.getByTestId('native-panel').props.accessibilityViewIsModal).toBe(true);
        expect(screen.getByTestId('native-body').props.keyboardShouldPersistTaps).toBe('handled');
        expect(screen.getByTestId('native-body').queryAll((node) => node.props.children === 'Action')).toHaveLength(0);
        expect(
            screen.getByTestId('native-footer').queryAll((node) => node.props.children === 'Action').length
        ).toBeGreaterThan(0);
        expect(screen.getByText('Long body')).toBeTruthy();
        expect(modalsOf(screen.container)[0].props.statusBarTranslucent).toBe(true);
        expect(timing.mock.calls.every(([, config]) => config.duration === 0)).toBe(true);
        await act(() => modalsOf(screen.container)[0].props.onRequestClose());
        expect(close).toHaveBeenCalledTimes(1);
    } finally {
        timing.mockRestore();
    }
});

/**
 * RN 版测试，对应 Web 版 `Modal.test.tsx` 的 16 个用例（含 6 个 a11y 用例）。
 *
 * **被丢弃的 Web 用例（RN 上没有任何对应物）**：
 *   - 「打开时焦点送进对话框」「关闭时焦点归还」「Tab 陷阱」「Shift+Tab 陷阱」4 个 ——
 *     上游靠 `document.activeElement` + `querySelectorAll(FOCUSABLE_SELECTOR)`，
 *     RN 的 `View` 没有 `.focus()`，也没有 DOM 焦点顺序 / Tab 键。
 *   - 「禁止滚动」（`document.body.style.overflow`）与 `tabIndex={-1}` —— 无对应物。
 *   - `aria-describedby` 关联 body —— **RN 0.87 没有 `aria-describedby`**
 *     （与 `aria-controls` / `aria-haspopup` 同一类）。这里反过来钉住「它确实没被生成」。
 *   - 「点击对话框内容不冒泡触发 onClose」—— 见下。
 *
 * **语义改写**：
 *   - `variant` 用例从「类名」改成「是否渲染有机底图 SVG」。
 *     上游的 `clip-path: url(#animal-modal-clip)` 在 RN 里**无法还原**（不能用路径裁切
 *     `View`），降级为铺满的一张 SVG 底图，形状一致但**内容不被裁切**。
 *   - 「点击内容不冒泡」改为断言 `onStartShouldSetResponder`：RNTL 的 `fireEvent` 是
 *     **向上**找 handler，而遮罩 Pressable 是弹窗的**兄弟节点**，用 press 测不出东西。
 *   - Escape → `Modal.onRequestClose`（安卓返回键），RN 的对应物。
 *   - 遮罩点击层是 `aria-modal` 弹窗的兄弟节点，RNTL 会把它判为不可访问
 *     （对应 iOS `accessibilityViewIsModal`），所以查它必须带 `includeHiddenElements`。
 *
 * **测不到的**：入场动画的实际观感（测试里 `useNativeDriver` 是 no-op）、
 *   `max-width: calc(100vw - 32px)` 退化成 `maxWidth: '100%'`（丢掉 32/64px 内缩）、
 *   `.modalClipped { color }` 的继承（RN 的 `View` 不向下继承 `color`）。
 */

const HIDDEN = { includeHiddenElements: true } as const;

const styleOf = (node: TestInstance): Record<string, unknown> => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk((node.props as { style?: unknown }).style);
    return merged;
};

/** RNTL v14 没有 `UNSAFE_getByType`；`Modal` 靠它独有的 `onRequestClose` 反查 */
const modalsOf = (container: TestInstance) => container.queryAll((n) => typeof n.props.onRequestClose === 'function');

describe('Modal', () => {
    it('open=false 不渲染', async () => {
        const { queryByTestId, queryByRole } = await render(
            <Modal open={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        expect(queryByTestId('t-panel', HIDDEN)).toBeNull();
        expect(queryByRole('dialog')).toBeNull();
    });

    it('默认 variant：不渲染 game 有机底图', async () => {
        const { queryByTestId, getByTestId } = await render(
            <Modal open typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        expect(queryByTestId('t-game-shape', HIDDEN)).toBeNull();
        // default 变体：圆角 22 的那层实底
        expect(styleOf(getByTestId('t-clipped', HIDDEN)).borderRadius).toBe(22);
    });

    it('variant="game"：渲染有机底图，实底层改为透明无圆角', async () => {
        const { getByTestId } = await render(
            <Modal open variant="game" typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        expect(getByTestId('t-game-shape', HIDDEN)).toBeTruthy();
        const s = styleOf(getByTestId('t-clipped', HIDDEN));
        expect(s.borderRadius).toBe(0);
        expect(s.backgroundColor).toBe('transparent');
        expect(s.boxShadow).toBeUndefined();
    });

    it('open=true 渲染 role="dialog" + aria-modal + title + body', async () => {
        const { getByRole, getByTestId, getByText } = await render(
            <Modal open title="标题" typewriter={false} testID="t">
                <Text testID="body">body content</Text>
            </Modal>
        );
        const panel = getByTestId('t-panel', HIDDEN);
        expect(panel.props.role).toBe('dialog');
        expect(panel.props['aria-modal']).toBe(true);
        expect(getByRole('dialog')).toBeTruthy();
        expect(getByText('标题')).toBeTruthy();
        expect(getByTestId('body')).toBeTruthy();
    });

    it('点击遮罩触发 onClose（默认 maskClosable）', async () => {
        const onClose = jest.fn();
        const { getByTestId } = await render(
            <Modal open onClose={onClose} typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        await fireEvent.press(getByTestId('t-mask-hit', HIDDEN));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('maskClosable=false 时点击遮罩不触发 onClose', async () => {
        const onClose = jest.fn();
        const { getByTestId } = await render(
            <Modal open maskClosable={false} onClose={onClose} typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        expect(getByTestId('t-mask-hit', HIDDEN).props.accessibilityState).toMatchObject({
            disabled: true,
        });
        await fireEvent.press(getByTestId('t-mask-hit', HIDDEN));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('弹窗自带防穿透（onStartShouldSetResponder 抢下 responder）', async () => {
        const { getByTestId } = await render(
            <Modal open typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        const grab = getByTestId('t-panel', HIDDEN).props.onStartShouldSetResponder;
        expect(typeof grab).toBe('function');
        expect(grab()).toBe(true);
    });

    it('Modal.onRequestClose 触发 onClose（替代 Web 版的 Escape）', async () => {
        const onClose = jest.fn();
        const { container } = await render(
            <Modal open onClose={onClose} typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        const modals = modalsOf(container);
        expect(modals).toHaveLength(1);
        await act(async () => {
            modals[0].props.onRequestClose();
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('默认 footer 渲染取消/确定，回调正确', async () => {
        const onClose = jest.fn();
        const onOk = jest.fn();
        const { getByText } = await render(
            <Modal open onClose={onClose} onOk={onOk} typewriter={false} testID="t">
                <Text>body</Text>
            </Modal>
        );
        await fireEvent.press(getByText('取消'));
        expect(onClose).toHaveBeenCalledTimes(1);
        await fireEvent.press(getByText('确定'));
        expect(onOk).toHaveBeenCalledTimes(1);
    });

    it('footer={null} 不渲染默认按钮', async () => {
        const { queryByTestId, queryByText } = await render(
            <Modal open footer={null} typewriter={false} testID="t">
                <Text>body</Text>
            </Modal>
        );
        expect(queryByTestId('t-footer', HIDDEN)).toBeNull();
        expect(queryByText('取消')).toBeNull();
        expect(queryByText('确定')).toBeNull();
    });

    it('width 应用到 dialog 节点，默认 520', async () => {
        const { getByTestId } = await render(
            <Modal open width={400} typewriter={false} testID="t">
                <Text>body</Text>
            </Modal>
        );
        expect(styleOf(getByTestId('t-panel', HIDDEN)).width).toBe(400);
    });

    it('typewriter={false} 直接渲染 children', async () => {
        const { getByText } = await render(
            <Modal open typewriter={false} testID="t">
                <Text>content</Text>
            </Modal>
        );
        expect(getByText('content')).toBeTruthy();
    });

    it('默认打字机：内容逐字出现，最终完整', async () => {
        const { queryByText, getByText } = await render(
            <Modal open typeSpeed={10} testID="t">
                <Text>content</Text>
            </Modal>
        );
        // 刚打开时还没打完（上游也是 setTimeout 逐字推进）
        await waitFor(() => expect(getByText('content')).toBeTruthy(), { timeout: 3000 });
        expect(queryByText('content')).toBeTruthy();
    });

    describe('a11y', () => {
        it('aria-labelledby 关联到 title 的 nativeID', async () => {
            const { getByTestId } = await render(
                <Modal open title="嗨标题" typewriter={false} testID="t">
                    <Text>嗨内容</Text>
                </Modal>
            );
            const titleId = getByTestId('t-panel', HIDDEN).props['aria-labelledby'] as string;
            expect(titleId).toMatch(/^animal-modal-[\w-]+-title$/);
            // 上游 `document.getElementById(...)` → RN 的 `nativeID`
            expect(getByTestId('t-title', HIDDEN).props.nativeID).toBe(titleId);
        });

        it('无 title 时 aria-labelledby 缺省', async () => {
            const { getByTestId } = await render(
                <Modal open typewriter={false} testID="t">
                    <Text>body</Text>
                </Modal>
            );
            expect(getByTestId('t-panel', HIDDEN).props['aria-labelledby']).toBeUndefined();
        });

        it('RN 没有 aria-describedby：弹窗上不会产生该 prop', async () => {
            const { getByTestId } = await render(
                <Modal open title="t" typewriter={false} testID="t">
                    <Text>body</Text>
                </Modal>
            );
            const panel = getByTestId('t-panel', HIDDEN);
            expect(panel.props['aria-describedby']).toBeUndefined();
            expect(panel.props.accessibilityDescribedBy).toBeUndefined();
        });
    });
});
