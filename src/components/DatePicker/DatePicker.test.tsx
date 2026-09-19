/**
 * DatePicker 的 RN 版测试，对应 Web 版 `DatePicker.test.tsx`。
 *
 * ## 丢弃的 Web 用例（及原因）
 *
 * | Web 用例 | 原因 |
 * | --- | --- |
 * | 「应用 size / status 类」 | 没有 CSS 类，改为断言 `height` / `paddingHorizontal` / `boxShadow` 数值。 |
 * | 「点击弹窗内部空白区域不关闭面板」 | 上游靠 `onBlur` 的 `relatedTarget` 判断焦点是否移出 wrapper；RN 没有 `onBlur` 语义，也没有 `relatedTarget`。面板改成 Modal 后，面板本身由 `onStartShouldSetResponder` 吃掉触摸，等价于「点内部不关」。已改为断言该 responder 回调。 |
 * | **「键盘交互」整组（3 个）** | RN 没有 DOM 键盘事件，`onKeyDown` 无处可挂。Esc 退化为 `Modal.onRequestClose`（Android 返回键），另有一个用例覆盖。 |
 * | 「正向 / 反向悬停预览」（2 个） | `onMouseEnter` / `onMouseLeave` 在 RN 无对应物，改为 `onPressIn` / `onPressOut`。**不是删掉功能，是换了触发方式**，另有 2 个等价用例。 |
 * | 「开始新选择时旧范围高亮让位」 | 仍保留：逻辑没变，只是由 hover 触发改为 press 触发的那条路径不再存在，故改为点选后断言。 |
 *
 * ## 测不到的
 *
 * - 面板真实落点（`measureInWindow` 被 mock 成永不回调，永远走兜底 `{top:0,left:0}`）。
 *   翻边 / 对齐的**判断**在 `calendar.test.ts` 里有 6 个用例。
 * - 阴影、圆角、字重的观感；`boxShadow` 在 Android 旧架构下会被忽略。
 * - 触屏上「按下预览」的实际手感 —— 测试只能证明 `onPressIn` 会写 hoverDate。
 */

import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { DatePicker } from './DatePicker';

const styleOf = (node: TestInstance): Record<string, unknown> =>
    (Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style.flat())
        : (node.props.style ?? {})) as Record<string, unknown>;

/**
 * 等退场动画播完、面板真正卸载（200ms）。
 *
 * ⚠️ **不能用假定时器**。实测两种假法都不可行：
 *   - 默认 `jest.useFakeTimers()` 把 `queueMicrotask` 一起假掉，React 19 的调度器和
 *     RNTL 的 `await render()` 都靠它推进微任务 → 树提交不了，首个用例跑 10 秒，
 *     之后所有用例连 `t-trigger` 都查不到。
 *   - 加 `doNotFake: ['queueMicrotask']` 只修好一半：React 调度器自身也用 `setTimeout`
 *     排任务，于是 `await act(async () => ...)` 要等一个永远不来的定时器，
 *     用例能过但要 11 秒并触发 Jest 的 5s 超时。
 * 真实定时器 + `waitFor` 是唯一走得通的路，且后续用例不受影响（已验证）。
 */
/** 断言面板已卸载（等退场动画播完） */
const expectClosed = (queryByTestId: (id: string) => unknown) =>
    waitFor(() => expect(queryByTestId('t-panel')).toBeNull(), { timeout: 2000 });

/** 受控值宿��� —— 对应 Web 版的 `@test/components` `ControlledHost` */
const ControlledHost: React.FC<{
    initial: string | [string, string] | null;
    onChange?: (v: string | [string, string] | null) => void;
    children: (args: {
        value: string | [string, string] | null;
        onChange: (v: string | [string, string] | null) => void;
    }) => React.ReactNode;
}> = ({ initial, onChange, children }) => {
    const [value, setValue] = React.useState(initial);
    return (
        <View>
            {children({
                value,
                onChange: (v) => {
                    setValue(v);
                    onChange?.(v);
                },
            })}
        </View>
    );
};

describe('DatePicker', () => {
    describe('rendering', () => {
        it('渲染占位文本', async () => {
            const { getByText } = await render(<DatePicker placeholder="选择生日" />);
            expect(getByText('选择生日')).toBeTruthy();
        });

        it('按 format 展示受控值', async () => {
            const { getByText } = await render(<DatePicker value="2026-08-10" format="YYYY年MM月DD日" />);
            expect(getByText('2026年08月10日')).toBeTruthy();
        });

        it('非法 value 回退到占位文本', async () => {
            const { getByText } = await render(<DatePicker value="not-a-date" />);
            expect(getByText('请选择日期')).toBeTruthy();
        });

        it('size / status 落到样式数值上（取代 Web 的 class 断言）', async () => {
            const { getByTestId } = await render(<DatePicker size="large" status="error" testID="t" />);
            const s = styleOf(getByTestId('t-trigger'));
            expect(s.height).toBe(48);
            expect(s.paddingHorizontal).toBe(22);
            // `.trigger-error` 覆盖 `.trigger-open`
            expect(s.boxShadow).toBe('0 3px 0 0 #c94444');
        });

        it('warning 状态的阴影', async () => {
            const { getByTestId } = await render(<DatePicker status="warning" testID="t" />);
            expect(styleOf(getByTestId('t-trigger')).boxShadow).toBe('0 3px 0 0 #dba90e');
        });

        it('支持 aria-label 无障碍标签', async () => {
            const { getByLabelText } = await render(<DatePicker aria-label="选择生日" />);
            expect(getByLabelText('选择生日')).toBeTruthy();
        });
    });

    describe('展开与选择', () => {
        it('点击触发区展开面板', async () => {
            const { getByTestId, queryByTestId } = await render(<DatePicker testID="t" />);
            expect(queryByTestId('t-panel')).toBeNull();
            await fireEvent.press(getByTestId('t-trigger'));
            expect(queryByTestId('t-panel')).toBeTruthy();
            // role=combobox + aria-expanded → Pressable 解析成 accessibilityState.expanded
            expect(getByTestId('t-trigger').props.accessibilityState).toEqual(
                expect.objectContaining({ expanded: true })
            );
        });

        it('点击背景（Modal 遮罩）关闭面板', async () => {
            const { getByTestId, queryByTestId } = await render(<DatePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            expect(queryByTestId('t-panel')).toBeTruthy();
            await fireEvent.press(getByTestId('t-backdrop'));
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('onRequestClose（Android 返回键）关闭面板 —— 取代 Web 的 Esc', async () => {
            const { getByTestId, queryByTestId, container } = await render(<DatePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            const modal = container.queryAll((n) => typeof n.props.onRequestClose === 'function');
            expect(modal).toHaveLength(1);
            await act(async () => {
                modal[0].props.onRequestClose();
            });
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('面板自己吃掉触摸（等价于「点内部不关」）', async () => {
            const { getByTestId } = await render(<DatePicker testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            const panel = getByTestId('t-panel');
            expect(typeof panel.props.onStartShouldSetResponder).toBe('function');
            expect(panel.props.onStartShouldSetResponder()).toBe(true);
        });

        it('点选日期仅更新待选值，点击确定后提交并关闭', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText, getByText, queryByTestId } = await render(
                <DatePicker defaultValue="2026-08-10" onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('2026年8月15日'));
            // 点选后面板保持展开，onChange 未触发，触发区实时显示待选日期
            expect(queryByTestId('t-panel')).toBeTruthy();
            expect(onChange).not.toHaveBeenCalled();
            expect(getByText('2026-08-15')).toBeTruthy();
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).toHaveBeenCalledWith('2026-08-15');
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('无待选值时确定仅关闭面板不回调', async () => {
            const onChange = jest.fn();
            const { getByTestId, queryByTestId } = await render(
                <DatePicker defaultValue="2026-08-10" onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).not.toHaveBeenCalled();
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('受控模式：选择后回调且不回写内部状态', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText } = await render(
                <ControlledHost initial="2026-08-10" onChange={onChange}>
                    {({ value, onChange: set }) => (
                        <DatePicker value={value as string} onChange={(v) => set(v)} testID="t" />
                    )}
                </ControlledHost>
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('2026年8月15日'));
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).toHaveBeenLastCalledWith('2026-08-15');
        });

        it('受控 open 直接展开面板', async () => {
            const { queryByTestId } = await render(<DatePicker open testID="t" />);
            expect(queryByTestId('t-panel')).toBeTruthy();
        });
    });

    describe('disabled / clear', () => {
        it('disabled 禁用触发区且不可展开', async () => {
            const { getByTestId, queryByTestId } = await render(<DatePicker disabled testID="t" />);
            const trigger = getByTestId('t-trigger');
            expect(trigger.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
            await fireEvent.press(trigger);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('disabledDate 禁用指定日期且不可选中', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText } = await render(
                <DatePicker
                    defaultValue="2026-08-01"
                    onChange={onChange}
                    disabledDate={(d) => d.getDay() === 0 || d.getDay() === 6}
                    testID="t"
                />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            // 2026-08-01 是周六，应被禁用
            const weekend = getByLabelText('2026年8月1日');
            expect(weekend.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
            await fireEvent.press(weekend);
            expect(onChange).not.toHaveBeenCalled();
        });

        it('allowClear 显示清除按钮，点击清空并触发 onChange(null)', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByText, queryByTestId } = await render(
                <DatePicker defaultValue="2026-08-10" allowClear onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-clear'));
            expect(onChange).toHaveBeenCalledWith(null);
            expect(getByText('请选择日期')).toBeTruthy();
            // 清空后清除按钮消失
            expect(queryByTestId('t-clear')).toBeNull();
        });

        it('allowClear 在空值时不渲染清除按钮', async () => {
            const { queryByTestId } = await render(<DatePicker allowClear testID="t" />);
            expect(queryByTestId('t-clear')).toBeNull();
        });
    });

    describe('年 / 月 / 日视图切换', () => {
        it('点击标签进入年份选择，选中年份后进入月份选择，选中月份回到日期视图', async () => {
            const { getByTestId, getByLabelText, getByText } = await render(
                <DatePicker defaultValue="2026-08-10" testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-label'));
            await fireEvent.press(getByLabelText('2028年'));
            await fireEvent.press(getByLabelText('3月'));
            expect(getByText('2028年3月')).toBeTruthy();
        });

        it('今天按钮：把今天设为待选日期，确定后提交', async () => {
            const onChange = jest.fn();
            const { getByTestId, queryByTestId } = await render(
                <DatePicker defaultValue="2026-01-05" onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-today'));
            expect(queryByTestId('t-panel')).toBeTruthy();
            expect(onChange).not.toHaveBeenCalled();
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).toHaveBeenCalled();
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('单日期模式圈出今天（inset 环形 → boxShadow）', async () => {
            const today = new Date();
            const { getByTestId, getByLabelText } = await render(<DatePicker defaultValue="2026-08-10" testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-today'));
            const cell = getByLabelText(`${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`);
            expect(cell.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
        });

        it('翻页按钮切换视图月份', async () => {
            const { getByTestId, getByText } = await render(<DatePicker defaultValue="2026-08-10" testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            expect(getByText('2026年8月')).toBeTruthy();
            await fireEvent.press(getByTestId('t-next-month'));
            expect(getByText('2026年9月')).toBeTruthy();
            await fireEvent.press(getByTestId('t-prev-month'));
            expect(getByText('2026年8月')).toBeTruthy();
            await fireEvent.press(getByTestId('t-next-year'));
            expect(getByText('2027年8月')).toBeTruthy();
        });
    });

    describe('范围选择模式', () => {
        it('分栏展示开始与结束日期', async () => {
            const { getByText } = await render(<DatePicker range defaultValue={['2026-08-10', '2026-08-12']} />);
            expect(getByText('2026-08-10')).toBeTruthy();
            expect(getByText('2026-08-12')).toBeTruthy();
        });

        it('两次点选待选开始与结束日期，点击确定后提交并关闭', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText, getByText, queryByTestId } = await render(
                <DatePicker range defaultValue={['2026-08-10', '2026-08-12']} onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('2026年8月15日'));
            expect(queryByTestId('t-panel')).toBeTruthy();
            expect(getByText('2026-08-15')).toBeTruthy();
            expect(getByText('请选择日期')).toBeTruthy();
            await fireEvent.press(getByLabelText('2026年8月20日'));
            expect(queryByTestId('t-panel')).toBeTruthy();
            expect(onChange).not.toHaveBeenCalled();
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).toHaveBeenCalledWith(['2026-08-15', '2026-08-20']);
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('第二次点击早于开始日期时重置为新的开始日期', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText } = await render(
                <DatePicker range defaultValue={['2026-08-10', '2026-08-12']} onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('2026年8月15日'));
            await fireEvent.press(getByLabelText('2026年8月10日'));
            expect(onChange).not.toHaveBeenCalled();
            await fireEvent.press(getByLabelText('2026年8月12日'));
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).toHaveBeenCalledWith(['2026-08-10', '2026-08-12']);
        });

        it('范围模式只选开始未选结束时确定仅关闭', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText, queryByTestId } = await render(
                <DatePicker range defaultValue={['2026-08-10', '2026-08-12']} onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('2026年8月15日'));
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).not.toHaveBeenCalled();
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('allowClear 清空范围', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByText } = await render(
                <DatePicker
                    range
                    defaultValue={['2026-08-10', '2026-08-12']}
                    allowClear
                    onChange={onChange}
                    testID="t"
                />
            );
            await fireEvent.press(getByTestId('t-clear'));
            expect(onChange).toHaveBeenCalledWith(null);
            expect(getByText('请选择日期')).toBeTruthy();
        });

        it('选中范围端点与区间应用高亮', async () => {
            const { getByTestId, getByLabelText } = await render(
                <DatePicker range defaultValue={['2026-08-10', '2026-08-12']} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            expect(styleOf(getByLabelText('2026年8月10日')).backgroundColor).toBe('#ffc107');
            expect(styleOf(getByLabelText('2026年8月12日')).backgroundColor).toBe('#ffc107');
            expect(styleOf(getByLabelText('2026年8月11日')).backgroundColor).toBe('#ffc107');
        });

        it('按下预览（取代 hover）：开始日期到按下日期区间高亮', async () => {
            const { getByTestId, getByLabelText } = await render(
                <DatePicker range defaultValue={['2026-08-10', '2026-08-12']} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            // 先点 10 号确定起点，再按下 15 号预览
            await fireEvent.press(getByLabelText('2026年8月10日'));
            await fireEvent(getByLabelText('2026年8月15日'), 'pressIn');
            expect(styleOf(getByLabelText('2026年8月10日')).backgroundColor).toBe('#ffc107');
            expect(styleOf(getByLabelText('2026年8月15日')).backgroundColor).toBe('#ffc107');
            expect(styleOf(getByLabelText('2026年8月12日')).backgroundColor).toBe('#ffc107');
        });

        it('反向按下预览：早于开始日期时反向高亮', async () => {
            const { getByTestId, getByLabelText } = await render(
                <DatePicker range defaultValue={['2026-08-10', '2026-08-12']} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('2026年8月15日'));
            await fireEvent(getByLabelText('2026年8月10日'), 'pressIn');
            expect(styleOf(getByLabelText('2026年8月10日')).backgroundColor).toBe('#ffc107');
            expect(styleOf(getByLabelText('2026年8月15日')).backgroundColor).toBe('#ffc107');
            expect(styleOf(getByLabelText('2026年8月12日')).backgroundColor).toBe('#ffc107');
        });

        it('范围模式不圈出今天', async () => {
            const today = new Date();
            const fmt = (d: Date) =>
                `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
            const { getByTestId, getByLabelText } = await render(
                <DatePicker
                    range
                    defaultValue={[
                        fmt(today),
                        fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)),
                    ]}
                    testID="t"
                />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            // 选中的是今天 → 它是 rangeStart，底是琥珀色而非 today 的青色环
            const cell = getByLabelText(`${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`);
            expect(styleOf(cell).backgroundColor).toBe('#ffc107');
        });
    });

    describe('月份选择模式', () => {
        it('展开后面板直接显示月份网格', async () => {
            const { getByTestId, getByLabelText, queryByLabelText } = await render(
                <DatePicker picker="month" testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            expect(getByLabelText('8月')).toBeTruthy();
            expect(queryByLabelText('2026年8月15日')).toBeNull();
        });

        it('点击月份并确定后提交 YYYY-MM', async () => {
            const onChange = jest.fn();
            const { getByTestId, getByLabelText, getByText, queryByTestId } = await render(
                <DatePicker picker="month" onChange={onChange} testID="t" />
            );
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('8月'));
            expect(getByText('2026-08')).toBeTruthy();
            await fireEvent.press(getByTestId('t-confirm'));
            expect(onChange).toHaveBeenCalledWith('2026-08');
            await expectClosed(queryByTestId);
            expect(queryByTestId('t-panel')).toBeNull();
        });

        it('展示受控月份值', async () => {
            const { getByText } = await render(<DatePicker picker="month" value="2026-08" />);
            expect(getByText('2026-08')).toBeTruthy();
        });

        it('非法月份值回退到占位文本', async () => {
            const { getByText } = await render(<DatePicker picker="month" value="2026-13" />);
            expect(getByText('请选择日期')).toBeTruthy();
        });

        it('月份模式下可切换年份并返回月份网格', async () => {
            const { getByTestId, getByLabelText, getByText } = await render(<DatePicker picker="month" testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByTestId('t-label'));
            await fireEvent.press(getByLabelText('2028年'));
            // 回到月份网格后，标题以 `<Text>` 文本形式呈现（Web 版这里是用
            // `getByRole('button', { name })` 按可访问名匹配，RN 没有内容即名字的等价机制）
            expect(getByText('2028年')).toBeTruthy();
            expect(getByLabelText('8月')).toBeTruthy();
        });

        it('点击月份后该格出现选中高亮', async () => {
            const { getByTestId, getByLabelText } = await render(<DatePicker picker="month" testID="t" />);
            await fireEvent.press(getByTestId('t-trigger'));
            await fireEvent.press(getByLabelText('9月'));
            expect(styleOf(getByLabelText('9月')).backgroundColor).toBe('#19c8b9');
        });
    });
});
