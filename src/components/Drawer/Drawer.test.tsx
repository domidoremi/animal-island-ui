import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Drawer } from './Drawer';

/**
 * RN 版测试，对应 Web 版 `Drawer.test.tsx` 的 20 个用例（含 6 个 a11y 用例）。
 *
 * **被丢弃的 Web 用例（RN 上没有任何对应物）**：
 *   - 「打开时焦点送进抽屉」「关闭时焦点归还触发元素」「Tab 焦点陷阱」「Shift+Tab 陷阱」
 *     共 4 个 —— 上游靠 `document.activeElement` + `querySelectorAll(FOCUSABLE_SELECTOR)`
 *     实现。**RN 的 `View` 没有 `.focus()`，也没有 DOM 焦点顺序 / Tab 键**，无对应物。
 *   - 「默认 pushBackground 下沉 body 非固定子元素」「pushBackground=false 不下沉」
 *     「关闭后恢复背景元素原始样式」共 3 个 —— 上游直接改 `document.body.children`
 *     的内联样式；RN 没有 `document`，也无法从组件内部改宿主 App 的其它视图。
 *     `pushBackground` 降级为空操作（见组件注释）。
 *   - 「禁止滚动」（`document.body.style.overflow='hidden'`）—— 同上。
 *   - 「点击抽屉内容不冒泡触发 onClose」—— 上游靠 `e.stopPropagation()`。
 *     RN 的 `fireEvent` 是**向上**找 handler，而遮罩 Pressable 是面板的**兄弟节点**，
 *     所以这个用例在 RNTL 里无论实现是否正确都会通过，测不出东西。
 *     改为直接断言面板上的防穿透机制（`onStartShouldSetResponder`）。
 *   - `inert={!open}` —— RN 没有 inert；关闭时组件直接卸载。
 *
 * **语义改写**：
 *   - `placement` 用例从「类名」改成「真实样式」（圆角方向 + boxShadow + 吸附边）。
 *   - Escape → `Modal.onRequestClose`（安卓返回键），这是 RN 的对应物。
 *
 * **RN 侧新增**：退场动画播完后卸载（上游靠 CSS transition 自动反向播放，
 *   RN 必须自己维护 `mounted`，所以这条值得单独钉住）。
 *
 * **测不到的**：滑动位移的实际观感（测试里 `useNativeDriver` 是 no-op）、
 *   `max-width: calc(100vw - 32px)` 被降级成 `maxWidth: '100%'`
 *   （RN 不支持 `calc()`，那 32px 内缩丢了）、`.panel { color }` 的继承
 *   （RN 的 `View` 不向下继承 `color`）。
 */

/**
 * 遮罩的点击层**必须用 `includeHiddenElements: true` 才能查到**。
 *
 * 原因（读了 `node_modules/@testing-library/react-native/dist/helpers/accessibility.js`
 * 才确认）：`isHiddenFromAccessibility` 里有一条
 * ```js
 * const hostSiblings = getInstanceSiblings(instance);
 * if (hostSiblings.some(sibling => computeAriaModal(sibling))) return true;
 * ```
 * 也就是「**`aria-modal` 元素的兄弟节点一律视为不可访问**」（对应 iOS 的
 * `accessibilityViewIsModal`）。遮罩点击层正是面板的兄弟节点。
 * 这不是我们的 bug，是画遮罩这个结构在 RNTL 下的必然结果。
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

const modalsOf = (container: TestInstance) => container.queryAll((n) => typeof n.props.onRequestClose === 'function');

// ⚠️ 这里刻意**不开全局假定时器**：RNTL v14 的 `await render()` 本身要等一个宏任务，
// 而 `Drawer` 一挂载就起动画 —— 两者叠在假定时器下会互相卡住（实测第一个用例要跑 12 秒，
// 并伴随一堆 "overlapping act() calls"）。只在真正要推进退场延时的那个用例里临时开。

describe('Drawer', () => {
    it('open=false 时面板不在树里（RN 的 Modal 只在可见时挂载）', async () => {
        const { queryByTestId, queryByRole } = await render(
            <Drawer open={false} testID="t">
                <Text>content</Text>
            </Drawer>
        );
        expect(queryByTestId('t-panel', HIDDEN)).toBeNull();
        expect(queryByRole('dialog')).toBeNull();
    });

    it('open=true 渲染 role="dialog" + aria-modal + title + body', async () => {
        const { getByRole, getByTestId, getByText } = await render(
            <Drawer open title="标题" testID="t">
                <Text testID="body">body content</Text>
            </Drawer>
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
            <Drawer open onClose={onClose} testID="t">
                <Text>content</Text>
            </Drawer>
        );
        await fireEvent.press(getByTestId('t-mask-hit', HIDDEN));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('maskClosable=false 时点击遮罩不触发 onClose', async () => {
        const onClose = jest.fn();
        const { getByTestId } = await render(
            <Drawer open maskClosable={false} onClose={onClose} testID="t">
                <Text>content</Text>
            </Drawer>
        );
        // 实现上是把遮罩 Pressable 置为 disabled：断言 disabled 真的下去了，
        // 再断言 press 不触发（disabled 的 Pressable 不会派发 onPress）。
        expect(getByTestId('t-mask-hit', HIDDEN).props.accessibilityState).toMatchObject({ disabled: true });
        await fireEvent.press(getByTestId('t-mask-hit', HIDDEN));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('面板自带防穿透（onStartShouldSetResponder 抢下 responder）', async () => {
        const { getByTestId } = await render(
            <Drawer open testID="t">
                <Text>content</Text>
            </Drawer>
        );
        const grab = getByTestId('t-panel', HIDDEN).props.onStartShouldSetResponder;
        expect(typeof grab).toBe('function');
        expect(grab()).toBe(true);
    });

    it('Modal.onRequestClose 触发 onClose（替代 Web 版的 Escape）', async () => {
        const onClose = jest.fn();
        const { container } = await render(
            <Drawer open onClose={onClose} testID="t">
                <Text>content</Text>
            </Drawer>
        );
        const modals = modalsOf(container);
        expect(modals).toHaveLength(1);
        await act(async () => {
            modals[0].props.onRequestClose();
        });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    describe('placement', () => {
        it('right（默认）：贴右 + 左侧圆角 + 左向阴影', async () => {
            const { getByTestId } = await render(
                <Drawer open testID="t">
                    <Text>x</Text>
                </Drawer>
            );
            const s = styleOf(getByTestId('t-panel', HIDDEN));
            expect(s.right).toBe(0);
            expect(s.borderTopLeftRadius).toBe(20);
            expect(s.borderBottomLeftRadius).toBe(20);
            expect(s.boxShadow).toBe('-12px 0 32px rgba(61, 52, 40, 0.18)');
        });

        it('left：贴左 + 右侧圆角 + 右向阴影', async () => {
            const { getByTestId } = await render(
                <Drawer open placement="left" testID="t">
                    <Text>x</Text>
                </Drawer>
            );
            const s = styleOf(getByTestId('t-panel', HIDDEN));
            expect(s.left).toBe(0);
            expect(s.borderTopRightRadius).toBe(20);
            expect(s.boxShadow).toBe('12px 0 32px rgba(61, 52, 40, 0.18)');
        });

        it('top：贴顶 + 底部圆角', async () => {
            const { getByTestId } = await render(
                <Drawer open placement="top" testID="t">
                    <Text>x</Text>
                </Drawer>
            );
            const s = styleOf(getByTestId('t-panel', HIDDEN));
            expect(s.top).toBe(0);
            expect(s.borderBottomLeftRadius).toBe(20);
            expect(s.boxShadow).toBe('0 12px 32px rgba(61, 52, 40, 0.18)');
        });

        it('bottom：贴底 + 顶部圆角', async () => {
            const { getByTestId } = await render(
                <Drawer open placement="bottom" testID="t">
                    <Text>x</Text>
                </Drawer>
            );
            const s = styleOf(getByTestId('t-panel', HIDDEN));
            expect(s.bottom).toBe(0);
            expect(s.borderTopLeftRadius).toBe(20);
            expect(s.boxShadow).toBe('0 -12px 32px rgba(61, 52, 40, 0.18)');
        });
    });

    it('width 应用到面板（right placement），默认 378', async () => {
        const { getByTestId } = await render(
            <Drawer open width={400} testID="t">
                <Text>x</Text>
            </Drawer>
        );
        expect(styleOf(getByTestId('t-panel', HIDDEN)).width).toBe(400);
    });

    it('height 应用到面板（bottom placement），默认 300', async () => {
        const { getByTestId } = await render(
            <Drawer open placement="bottom" height={250} testID="t">
                <Text>x</Text>
            </Drawer>
        );
        expect(styleOf(getByTestId('t-panel', HIDDEN)).height).toBe(250);
    });

    it('footer 传入时渲染', async () => {
        const { getByTestId, getByText } = await render(
            <Drawer open footer={<Text>ok</Text>} testID="t">
                <Text>body</Text>
            </Drawer>
        );
        expect(getByTestId('t-footer')).toBeTruthy();
        expect(getByText('ok')).toBeTruthy();
    });

    it('默认不渲染 footer', async () => {
        const { queryByTestId } = await render(
            <Drawer open testID="t">
                <Text>body</Text>
            </Drawer>
        );
        expect(queryByTestId('t-footer')).toBeNull();
    });

    describe('a11y', () => {
        it('aria-labelledby 关联到 title 的 nativeID', async () => {
            const { getByTestId } = await render(
                <Drawer open title="嗨标题" testID="t">
                    <Text>嗨内容</Text>
                </Drawer>
            );
            const panel = getByTestId('t-panel', HIDDEN);
            const titleId = panel.props['aria-labelledby'] as string;
            expect(titleId).toMatch(/^animal-drawer-[\w-]+-title$/);
            // 上游 `document.getElementById(...)` → RN 的 `nativeID`
            expect(getByTestId('t-title').props.nativeID).toBe(titleId);
        });

        it('无 title 时 aria-labelledby 缺省', async () => {
            const { getByTestId } = await render(
                <Drawer open testID="t">
                    <Text>body</Text>
                </Drawer>
            );
            expect(getByTestId('t-panel', HIDDEN).props['aria-labelledby']).toBeUndefined();
        });

        it('关闭按钮 aria-label="关闭" 且触发 onClose', async () => {
            const onClose = jest.fn();
            const { getByLabelText } = await render(
                <Drawer open title="t" onClose={onClose} testID="t">
                    <Text>body</Text>
                </Drawer>
            );
            const closeBtn = getByLabelText('关闭');
            expect(closeBtn).toBeTruthy();
            expect(closeBtn.props.accessibilityRole).toBe('button');
            await fireEvent.press(closeBtn);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('无 title 时不渲染关闭按钮', async () => {
            const { queryByTestId } = await render(
                <Drawer open testID="t">
                    <Text>body</Text>
                </Drawer>
            );
            expect(queryByTestId('t-close')).toBeNull();
            expect(queryByTestId('t-header')).toBeNull();
        });

        it('关闭态 aria-hidden=true，打开态为 false', async () => {
            const { rerender, getByTestId } = await render(
                <Drawer open testID="t">
                    <Text>body</Text>
                </Drawer>
            );
            expect(getByTestId('t-panel', HIDDEN).props['aria-hidden']).toBe(false);
            await rerender(
                <Drawer open={false} testID="t">
                    <Text>body</Text>
                </Drawer>
            );
            // 退场动画期间仍在树里，此时应被排除出无障碍树
            expect(getByTestId('t-panel', HIDDEN).props['aria-hidden']).toBe(true);
        });
    });

    it('style / maskStyle 透传', async () => {
        const { getByTestId } = await render(
            <Drawer open style={{ borderWidth: 3 }} maskStyle={{ opacity: 0.5 }} testID="t">
                <Text>body</Text>
            </Drawer>
        );
        expect(styleOf(getByTestId('t-panel', HIDDEN)).borderWidth).toBe(3);
        expect(styleOf(getByTestId('t-mask')).opacity).toBe(0.5);
    });

    // ============================================================
    // ⚠️ 这两个用例必须放在文件最后，且 `关闭后等退场动画播完才卸载` 必须是**最后一个**。
    //
    // 它们要等真实的 500ms 让退场动画播完、组件自行卸载。实测：只要本文件里
    // 有任何一个用例做过这种「渲染 → 等待 → Modal 自行卸载」，**之后所有用例的
    // Modal 内容都会查不到**（`Unable to find an element with testID: t-panel`，
    // 而 `container.queryAll` 又能查到）。假定时器、waitFor、真实定时器三种等法
    // 都一样，把受影响的用例移到它前面就恢复。推测是 RNTL 侧的宿主节点登记表在
    // Modal 自行卸载后没能清干净；换到独立文件也能规避（模块注册表隔离），
    // 但为此多拆一个测试文件不值。
    // ============================================================
    it('受控用法：open 完全由外部状态驱动，遮罩关闭后回落到卸载', async () => {
        const Controlled: React.FC = () => {
            const [open, setOpen] = React.useState(false);
            return (
                <View>
                    <Pressable testID="trigger" onPress={() => setOpen(true)}>
                        <Text>open</Text>
                    </Pressable>
                    <Drawer open={open} onClose={() => setOpen(false)} testID="t">
                        <Text>body</Text>
                    </Drawer>
                </View>
            );
        };
        const { getByTestId, queryByTestId } = await render(<Controlled />);
        expect(queryByTestId('t-panel', HIDDEN)).toBeNull();

        await fireEvent.press(getByTestId('trigger'));
        expect(queryByTestId('t-panel', HIDDEN)).toBeTruthy();

        await fireEvent.press(getByTestId('t-mask-hit', HIDDEN));
        await act(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
        });
        expect(queryByTestId('t-panel', HIDDEN)).toBeNull();
    });

    it('关闭后等退场动画播完才卸载（360ms）', async () => {
        const { rerender, queryByTestId } = await render(
            <Drawer open testID="t">
                <Text>content</Text>
            </Drawer>
        );
        expect(queryByTestId('t-panel', HIDDEN)).toBeTruthy();

        // ⚠️ `rerender` 不能和后面的等待放在同一个 `act(async …)` 里：异步 act 里的
        // effect 要等 act 结束才 flush，那个 360ms 的卸载定时器就会在等待**之后**
        // 才被创建，于是永远等不到卸载。
        rerender(
            <Drawer open={false} testID="t">
                <Text>content</Text>
            </Drawer>
        );
        // 刚关上的那一刻仍在树里（上游靠 CSS transition 双向播放、节点常驻 DOM，
        // RN 必须自己维持一个 mounted 直到退场播完）
        expect(queryByTestId('t-panel', HIDDEN)).toBeTruthy();
        await act(async () => {
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
        });
        expect(queryByTestId('t-panel', HIDDEN)).toBeNull();
    });
});
