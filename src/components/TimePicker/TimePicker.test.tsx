import React, { useState } from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { TimePicker } from './TimePicker';
import { PANEL_WIDTH, PANEL_WIDTH_NO_SECONDS } from './geometry';

/**
 * RN 版测试，对应 Web 版 `TimePicker.test.tsx` 的 16 个用例。
 *
 * **被丢弃的用例**：
 *   - `className` 断言（`trigger-large` / `trigger-error` / `panelNoSeconds`）——
 *     RN 无 className，改为断言 style 的对应字段。
 *   - 键盘用例（Tab 聚焦 + Enter 展开 / Esc 关闭）—— RN 没有 DOM 键盘事件，
 *     也没有 `tabIndex` 意义上的 Tab 遍历；等价物是 Android 返回键，即 `Modal`
 *     的 `onRequestClose`，已单独覆盖。
 *   - 「点击弹窗内部空白区域不关闭面板」不能照搬：RNTL 的 `fireEvent.press` 是
 *     **向上**找 `onPress`，而遮罩是面板的**兄弟**节点，所以无论面板有没有防穿透，
 *     这个断言都会通过 —— 测出来是假象。改为直接断言防穿透机制本身
 *     （面板的 `onStartShouldSetResponder` 返回 true）。
 *
 * **RN 侧新增**：
 *   - 选中项补了 `accessibilityState.selected`（上游只有视觉 class，没有无障碍语义）。
 *
 * **本文件覆盖不到的部分**（见 `geometry.ts`，已用纯函数单测兜住）：
 *   面板的屏幕定位靠 `measureInWindow`，而 jest preset 把它 mock 成了
 *   **永不回调的空实现**（`@react-native/jest-preset/jest/MockNativeMethods.js` 里是
 *   `measureInWindow: jest.fn()`），所以面板挂在兜底位置 `{ top: 0, left: 0 }`；
 *   列滚动靠 `ScrollView.scrollTo`，测试里没有原生滚动节点。
 *
 * ⚠️ **读断言前必须知道：jest preset 把 `View` 整个 mock 掉了**
 * （`@react-native/jest-preset/jest/setup.js` → `mocks/View.js` → `mockComponent`），
 * mock 把 props **原样**透传给宿主节点，**不做 RN 的 aria-* 改写**。
 * 于是同一个 `aria-*` 在测试与真机上的落点不同：
 *
 *   | 写法 | 测试里宿主节点的 props | 真机上 `View.js` 改写后 |
 *   |---|---|---|
 *   | `<Pressable aria-label>` | `accessibilityLabel`（Pressable 自己在 JS 里转换） | 同左 |
 *   | `<View aria-label>` | `aria-label`（原样） | `accessibilityLabel` |
 *   | `<View aria-labelledby>` | `aria-labelledby`（原样） | `accessibilityLabelledBy`（数组） |
 *   | `<View aria-hidden>` | `aria-hidden`（原样） | `accessibilityElementsHidden` + `importantForAccessibility` |
 *   | `<View role>` | `role`（原样） | `role`（**不在改写名单里**） |
 *
 * 所以：**Pressable 上的断言（触发区 / 选项）与真机一致**，可以放心断言改写后的属性；
 * **View / Animated.View 上的断言只能证明「组件把 prop 传下去了」**，
 * 改写是 RN 的职责，不在本组件的测试范围内。
 */
const child = (node: unknown) => node as TestInstance;

/** 装饰元素带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

const pad = (n: number) => `${n}`.padStart(2, '0');

/**
 * 面板退场动效 200ms（`CLOSE_ANIMATION_MS`），推进假定时器让面板真正卸载。
 *
 * 本文件统一用假定时器：退场靠 `setTimeout` 卸载，用真实定时器就得 `await waitFor`，
 * 而 `Animated` 的帧推进也会在 `act` 之外触发更新。假定时器让时序完全确定。
 */
const flushClose = () =>
    act(async () => {
        jest.advanceTimersByTime(250);
    });

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('TimePicker', () => {
    describe('渲染', () => {
        it('渲染占位文本', async () => {
            const { getByText } = await render(<TimePicker placeholder="选择时间" />);
            expect(getByText('选择时间')).toBeTruthy();
        });

        it('按 format 展示受控值', async () => {
            const { getByText } = await render(<TimePicker value="09:08:07" format="HH时mm分" />);
            expect(getByText('09时08分')).toBeTruthy();
        });

        it('非法 value 回退到占位文本', async () => {
            const { getByText } = await render(<TimePicker value="not-a-time" />);
            expect(getByText('请选择时间')).toBeTruthy();
        });

        it('应用 size / status 样式（替代 Web 版的 class 断言）', async () => {
            const { getByTestId } = await render(<TimePicker testID="t" size="large" status="error" />);
            const face = styleOf(getByTestId('t-trigger'));
            // .trigger-large { height: 48px; padding: 0 22px; font-size: 16px }
            expect(face.height).toBe(48);
            expect(face.paddingHorizontal).toBe(22);
            // .trigger-error { box-shadow: 0 3px 0 0 #c94444 }
            expect(face.boxShadow).toBe('0 3px 0 0 #c94444');
        });

        it('status 优先于 open（按 CSS 源码顺序，error / warning 在 open 之后）', async () => {
            const { getByTestId } = await render(<TimePicker testID="t" status="warning" />);
            await fireEvent.press(getByTestId('t-trigger'));
            // 展开态下仍是 warning 的投影 —— 与 Web 版同权重同源码顺序的结果一致
            expect(styleOf(getByTestId('t-trigger')).boxShadow).toBe('0 3px 0 0 #dba90e');
        });
    });

    describe('展开与选择', () => {
        it('点击触发区展开面板', async () => {
            const { getByTestId } = await render(<TimePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            expect(getByTestId('t-panel')).toBeTruthy();
        });

        it('触发区暴露 combobox 角色与展开状态', async () => {
            const { getByTestId, getByRole } = await render(<TimePicker testID="t" aria-label="开始时间" />);
            const trigger = getByTestId('t-trigger');
            // ⚠️ `getByTestId` 拿到的是**宿主节点**，RN 的 `View` 已经把 aria-* 改写掉了：
            //   `aria-expanded` → `accessibilityState.expanded`
            //   `aria-disabled` → `accessibilityState.disabled`
            //   `aria-label`    → `accessibilityLabel`
            //   只有 `role` 不在改写名单里，原样保留（见 View.js 的 destructure 列表）。
            expect(trigger.props.role).toBe('combobox');
            expect(trigger.props.accessibilityState).toMatchObject({ expanded: false });
            expect(trigger.props.accessibilityLabel).toBe('开始时间');
            expect(getByRole('combobox')).toBe(trigger);

            await fireEvent.press(trigger);
            expect(getByTestId('t-trigger').props.accessibilityState).toMatchObject({ expanded: true });
        });

        it('面板带 dialog 角色，并声明自己会吃掉触摸（防穿透到遮罩）', async () => {
            const { getByTestId } = await render(<TimePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            const panel = getByTestId('t-panel');
            expect(panel.props.role).toBe('dialog');
            expect(panel.props['aria-label']).toBe('选择时间');
            // Web 版靠 `wrapper.contains(e.target)` 判断内外；RN 靠响应者系统，
            // 机制就是这个 prop（详见文件头注释：这条不能用 fireEvent.press 测）
            expect(child(panel).props.onStartShouldSetResponder?.()).toBe(true);
        });

        it('选择时分秒后点击确定提交并关闭', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByRole, queryByTestId } = await render(
                <TimePicker testID="t" defaultValue="08:00:00" onChange={onChange} />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByRole('button', { name: '10 时' }));
            await fireEvent.press(getByRole('button', { name: '30 分' }));
            await fireEvent.press(getByRole('button', { name: '45 秒' }));
            await fireEvent.press(getByRole('button', { name: '确定' }));
            expect(onChange).toHaveBeenCalledWith('10:30:45');

            await flushClose();
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('受控模式：确定后回调且不回写内部状态', async () => {
            const onChange = jest.fn();
            const Host = () => {
                const [v, setV] = useState<string | null>('08:00:00');
                return (
                    <TimePicker
                        testID="t"
                        value={v ?? undefined}
                        onChange={(next) => {
                            onChange(next);
                            setV(next);
                        }}
                    />
                );
            };
            const { getByTestId, getByRole } = await render(<Host />);
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByRole('button', { name: '12 时' }));
            await fireEvent.press(getByRole('button', { name: '确定' }));
            expect(onChange).toHaveBeenLastCalledWith('12:00:00');
        });

        it('值未变化时确定仅关闭面板不回调', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByRole, queryByTestId } = await render(
                <TimePicker testID="t" defaultValue="08:00:00" onChange={onChange} />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByRole('button', { name: '确定' }));
            expect(onChange).not.toHaveBeenCalled();

            await flushClose();
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('此刻按钮设置当前时间', async () => {
            const { getByTestId, getByText } = await render(<TimePicker testID="t" defaultValue="08:00:00" />);
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-now'));
            const now = new Date();
            expect(getByText(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)).toBeTruthy();
        });

        it('点击遮罩关闭面板（替代 Web 版的 mousedown 外部点击）', async () => {
            const { getByTestId, queryByTestId } = await render(<TimePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-backdrop'));
            await flushClose();
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('展开态触发区实时显示 pending，未提交关闭则回到已提交值', async () => {
            const { getByTestId, getByText, getByRole, queryByText } = await render(
                <TimePicker testID="t" defaultValue="08:00:00" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByRole('button', { name: '10 时' }));
            // Web 版：`open && pending ? formatTime(pending, format) : ...`
            expect(getByText('10:00:00')).toBeTruthy();

            // 点遮罩关闭 = 不提交，触发区应回到已提交的 08:00:00
            await fireEvent.press(getByTestId('t-backdrop'));
            await flushClose();
            expect(queryByText('10:00:00')).toBeNull();
            expect(getByText('08:00:00')).toBeTruthy();
        });
    });

    describe('disabled / clear / 步进', () => {
        it('disabled 禁用且不可展开', async () => {
            const { getByTestId, queryByTestId } = await render(<TimePicker testID="t" disabled />);
            const trigger = getByTestId('t-trigger');
            // `aria-disabled` 在宿主节点上已被改写成 `accessibilityState.disabled`
            expect(trigger.props.accessibilityState).toMatchObject({ disabled: true });
            await fireEvent.press(trigger);
            expect(queryByTestId('t-panel')).toBeNull();
            // .wrapper-disabled { opacity: .6 } / .trigger { background: #ece8dc; box-shadow: none }
            expect(getByTestId('t')).toHaveStyle({ opacity: 0.6 });
            const face = styleOf(trigger);
            expect(face.backgroundColor).toBe('#ece8dc');
            expect(face.boxShadow).toBeUndefined();
        });

        it('allowClear 显示清除按钮并清空', async () => {
            const onChange = jest.fn();
            const { getByLabelText, getByText } = await render(
                <TimePicker testID="t" defaultValue="08:00:00" allowClear onChange={onChange} />
            );
            await fireEvent.press(getByLabelText('清除时间'));
            expect(onChange).toHaveBeenCalledWith(null);
            expect(getByText('请选择时间')).toBeTruthy();
        });

        it('minuteStep 步进过滤分钟选项', async () => {
            const { getByTestId, getByRole, queryByRole } = await render(<TimePicker testID="t" minuteStep={15} />);
            await fireEvent.press(getByTestId('t-trigger'));
            expect(getByRole('button', { name: '15 分' })).toBeTruthy();
            expect(queryByRole('button', { name: '10 分' })).toBeNull();
        });

        it('format 不含 ss 时不显示秒列且面板收窄', async () => {
            const { getByTestId, getByRole, queryByRole } = await render(<TimePicker testID="t" format="HH:mm" />);
            await fireEvent.press(getByTestId('t-trigger'));
            expect(queryByRole('button', { name: '45 秒' })).toBeNull();
            expect(getByRole('button', { name: '10 时' })).toBeTruthy();
            expect(styleOf(getByTestId('t-panel')).width).toBe(PANEL_WIDTH_NO_SECONDS);
        });

        it('默认（含 ss）面板用完整宽度', async () => {
            const { getByTestId } = await render(<TimePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            expect(styleOf(getByTestId('t-panel')).width).toBe(PANEL_WIDTH);
            expect(getByTestId('t-second')).toBeTruthy();
        });
    });

    describe('RN 专有', () => {
        it('Android 返回键（Modal.onRequestClose）关闭面板，替代 Web 版的 Escape', async () => {
            const { getByTestId, queryByTestId, container } = await render(<TimePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));

            // RNTL v14 没有 `UNSAFE_getByType`；`container` 是 TestInstance，
            // 用 `queryAll` 按 prop 定位 Modal 的宿主节点。
            const modals = container.queryAll((n) => typeof n.props.onRequestClose === 'function');
            expect(modals).toHaveLength(1);

            await act(async () => {
                modals[0].props.onRequestClose();
            });
            await flushClose();
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('选中项带 accessibilityState.selected（RN 侧新增的无障碍语义）', async () => {
            const { getByTestId, getByRole } = await render(<TimePicker testID="t" defaultValue="08:00:00" />);
            await fireEvent.press(getByTestId('t-trigger'));
            // defaultValue 是 08:00:00 → 选中 8 时 / 0 分 / 0 秒
            expect(getByRole('button', { name: '8 时', selected: true })).toBeTruthy();
            expect(getByRole('button', { name: '9 时', selected: false })).toBeTruthy();
            expect(getByRole('button', { name: '0 分', selected: true })).toBeTruthy();
            expect(getByRole('button', { name: '8 分', selected: false })).toBeTruthy();
            expect(getByRole('button', { name: '0 秒', selected: true })).toBeTruthy();
        });

        it('装饰性时钟图标带 aria-hidden，默认被无障碍查询排除', async () => {
            const { getByTestId } = await render(<TimePicker testID="t" />);
            // 默认查询查不到 → 反证 `aria-hidden` 生效；带上 includeHiddenElements 才查得到
            expect(() => getByTestId('t-clock')).toThrow();
            expect(getByTestId('t-clock', HIDDEN).props['aria-hidden']).toBe(true);
        });
    });
});
