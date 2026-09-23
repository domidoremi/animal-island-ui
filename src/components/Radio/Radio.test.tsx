import React, { useState } from 'react';
import { processColor } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Radio, type RadioOption } from './Radio';
import { colors } from '../../theme/tokens';

/**
 * RN 版测试，对应 Web 版 `Radio.test.tsx` 的 14 个用例。
 *
 * **被丢弃的用例**（RN 无对应能力）：
 *   - `应用 className 与 style 到根节点` —— RN 无类名系统，只保留 `style` 断言。
 *   - `size` / `direction` 的**类名**断言 —— 改为断言真实样式（圆圈尺寸、字号、
 *     `flexDirection`、`gap`）。
 *   - `所有 input 共享同一 name（单选语义）` —— RN 没有表单 `name`，也没有 `<input>`。
 *     等价物是「所有单选项都是同一个 `role="radiogroup"` 容器的直接子节点」，
 *     已按这个口径重写（见 rendering 一节）。
 *   - Web 键盘导航由 RadioGroup 共享实现，见 radioGroupWeb.test.tsx。
 *     原生侧仍保持每个选项独立可访问，不使用 DOM 事件。
 *   - `group 级 disabled 应用 groupDisabled 类` —— 该 Less 规则只有
 *     `cursor: not-allowed` 一条声明，RN 没有光标概念，无对应物可断言。
 *   - `label 通过 for/id 绑定到 input`（`within(group).getByLabelText`）——
 *     RN 没有 `id` / `htmlFor`。等价物是「label 文本就在可访问的 Pressable 内部，
 *     因此成为它的可访问名」，用 `getByRole('radio', { name })` 断言。
 *
 * **未被丢弃、且完整移植的**：受控 / 非受控 / 单选项禁用 / 组级禁用 / defaultValue /
 * 替换上一选中，全部保留。
 *
 * ⚠️ **查不到 `getByRole('radiogroup')` 是预期行为**：RNTL 的 `getByRole` 被
 * `isAccessibilityElement` 把门（非 Text 宿主只有显式 `accessible` 才算），而组容器
 * **刻意不设 `accessible`** —— 否则整组会被合并成一个无障碍节点、毁掉每个单选项的
 * 独立可达性。所以根节点只能断言 prop 透传，另有一条用例把这条限制钉住。
 *
 * ⚠️ **读断言前必须知道：jest preset 把 `View` 整个 mock 掉了**，mock 把 props
 * **原样**透传给宿主节点，**不做 RN 的 `aria-*` 改写**。于是
 * `<Pressable aria-checked>` → 宿主上是 `accessibilityState.checked`（Pressable
 * 自己在 JS 里转，与真机一致，可以放心断言），而 `<View role aria-hidden>` →
 * 宿主上是**原样的** prop（只能证明「传下去了」）。
 *
 * **RN 侧新增**：勾的 `strokeDashoffset`（0 / 19）与描边色断言 —— 上游靠
 * `transition: stroke-dashoffset` 做「画勾」动画，RN 侧改成瞬时切换，
 * 这里把两个端点的值直接钉住。
 */

/** 装饰元素带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

const child = (node: unknown) => node as TestInstance;

/** 取 `children` 里第 i 个节点（`getByTestId` 返回宿主节点，子节点顺序即渲染顺序） */
const childAt = (node: TestInstance, index: number) => child(node.children[index]);

/**
 * `react-native-svg` 会把颜色归一化成 `{ payload, type }`（= `processColor` 的原始值
 * 加一个颜色类型标记）再交给宿主节点，所以断言颜色要取 `payload`。
 */
const strokePayload = (node: TestInstance) => (node.props.stroke as { payload: number }).payload;

const baseOptions: RadioOption[] = [
    { label: 'Apple', value: 'a' },
    { label: 'Banana', value: 'b' },
    { label: 'Cherry', value: 'c', disabled: true },
];

describe('Radio', () => {
    describe('rendering', () => {
        it('渲染所有选项 label 与对应 radio（可访问名来自内部文本，取代 for/id 绑定）', async () => {
            const { getByRole, getByText, getAllByRole } = await render(<Radio testID="r" options={baseOptions} />);
            expect(getAllByRole('radio')).toHaveLength(baseOptions.length);
            baseOptions.forEach((o) => {
                expect(getByText(String(o.label))).toBeTruthy();
                // 上游靠 `<label htmlFor>` 把文本绑到 input；RN 里 label 文本就在
                // 可访问的 Pressable 内部，因此直接成为可访问名
                expect(getByRole('radio', { name: String(o.label) })).toBeTruthy();
            });
        });

        it('挂载在 role="radiogroup" 容器中', async () => {
            const { getByTestId, getAllByRole } = await render(<Radio testID="r" options={baseOptions} />);
            expect(getByTestId('r').props.role).toBe('radiogroup');
            expect(getAllByRole('radio')).toHaveLength(baseOptions.length);
        });

        it('RNTL 的 getByRole 查不到 role="radiogroup" 的 View（钉住这条限制）', async () => {
            const { queryByRole, getByTestId } = await render(<Radio testID="r" options={baseOptions} />);
            // 组容器刻意不设 `accessible`（否则整组会被合并成一个无障碍节点）
            expect(getByTestId('r').props.accessible).toBe(false);
            expect(queryByRole('radiogroup')).toBeNull();
        });

        it('应用 style 到根节点（className 已丢弃）', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} style={{ marginTop: 8 }} />);
            expect(getByTestId('r')).toHaveStyle({ marginTop: 8 });
        });

        it('size 全部枚举：圆圈尺寸、勾的尺寸、字号与字距', async () => {
            const sizes = [
                { size: 'small', box: 18, checkW: 10, checkH: 9, fontSize: 12, letterSpacing: 0.12 },
                { size: 'middle', box: 22, checkW: 12, checkH: 11, fontSize: 14, letterSpacing: 0.14 },
                { size: 'large', box: 28, checkW: 15, checkH: 14, fontSize: 16, letterSpacing: 0.16 },
            ] as const;

            for (const spec of sizes) {
                const { getByTestId, unmount } = await render(
                    <Radio testID="r" options={baseOptions} size={spec.size} />
                );
                expect(getByTestId('r-box-a')).toHaveStyle({
                    width: spec.box,
                    height: spec.box,
                    borderRadius: spec.box / 2,
                });
                // CSS letter-spacing: 0.01em → 按字号换算成绝对值
                expect(childAt(getByTestId('r-option-a'), 1)).toHaveStyle({
                    fontSize: spec.fontSize,
                    letterSpacing: spec.letterSpacing,
                });
                await unmount();
            }
        });

        it('direction 全部枚举：horizontal 横排 / vertical 竖排且间距更小', async () => {
            const horizontal = await render(<Radio testID="r" options={baseOptions} direction="horizontal" />);
            expect(horizontal.getByTestId('r')).toHaveStyle({ flexDirection: 'row', gap: 16 });
            await horizontal.unmount();

            const vertical = await render(<Radio testID="r" options={baseOptions} direction="vertical" />);
            // `.vertical { gap: @spacing-md }` = 12，覆盖 `.radioGroup` 的 16
            expect(vertical.getByTestId('r')).toHaveStyle({ flexDirection: 'column', gap: 12 });
        });

        it('所有单选项都是同一个 radiogroup 的直接子节点（取代「共享同一 name」）', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} />);
            const group = getByTestId('r');
            expect(group.children).toHaveLength(baseOptions.length);
            group.children.forEach((node) => {
                expect(child(node).props.role).toBe('radio');
            });
        });

        it('每个选项的 testID 由 value 派生，值类型不影响', async () => {
            const { getByTestId } = await render(
                <Radio
                    testID="r"
                    options={[
                        { label: 'One', value: 1 },
                        { label: 'Two', value: 2 },
                    ]}
                />
            );
            expect(getByTestId('r-option-1')).toBeTruthy();
            expect(getByTestId('r-option-2')).toBeTruthy();
        });
    });

    describe('uncontrolled 模式', () => {
        it('使用 defaultValue 设置初始选中态', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} defaultValue="b" />);
            expect(getByTestId('r-option-a').props.accessibilityState).toMatchObject({ checked: false });
            expect(getByTestId('r-option-b').props.accessibilityState).toMatchObject({ checked: true });
        });

        it('点击选项 → 选中并触发 onChange', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} onChange={onChange} />);
            await fireEvent.press(getByTestId('r-option-a'));
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenLastCalledWith('a');
            expect(getByTestId('r-option-a').props.accessibilityState).toMatchObject({ checked: true });
        });

        it('再次点击其他项 → 替换上一选中', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Radio testID="r" options={baseOptions} defaultValue="a" onChange={onChange} />
            );
            await fireEvent.press(getByTestId('r-option-b'));
            expect(onChange).toHaveBeenLastCalledWith('b');
            expect(getByTestId('r-option-b').props.accessibilityState).toMatchObject({ checked: true });
            expect(getByTestId('r-option-a').props.accessibilityState).toMatchObject({ checked: false });
        });

        it('重复点击已选中项仍会回调（上游不判重）', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Radio testID="r" options={baseOptions} defaultValue="a" onChange={onChange} />
            );
            await fireEvent.press(getByTestId('r-option-a'));
            expect(onChange).toHaveBeenCalledWith('a');
        });
    });

    describe('controlled 模式', () => {
        it('value 受控，组件不会自更新', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Radio testID="r" options={baseOptions} value="" onChange={onChange} />
            );
            await fireEvent.press(getByTestId('r-option-a'));
            expect(onChange).toHaveBeenCalledWith('a');
            // 父级未回写 → 仍全部未选中
            expect(getByTestId('r-option-a').props.accessibilityState).toMatchObject({ checked: false });
        });

        it('父级回写 value 后 UI 同步更新', async () => {
            const onChange = jest.fn();
            // Web 版用 @test/components 的 ControlledHost；RN 侧内联一个等价宿主
            const Host = () => {
                const [value, setValue] = useState<string | number>('');
                return (
                    <Radio
                        testID="r"
                        options={baseOptions}
                        value={value}
                        onChange={(next) => {
                            setValue(next);
                            onChange(next);
                        }}
                    />
                );
            };
            const { getByTestId } = await render(<Host />);
            await fireEvent.press(getByTestId('r-option-b'));
            expect(onChange).toHaveBeenLastCalledWith('b');
            expect(getByTestId('r-option-b').props.accessibilityState).toMatchObject({ checked: true });
        });

        it('受控模式下传 defaultValue 应被忽略', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} value="b" defaultValue="a" />);
            expect(getByTestId('r-option-a').props.accessibilityState).toMatchObject({ checked: false });
            expect(getByTestId('r-option-b').props.accessibilityState).toMatchObject({ checked: true });
        });
    });

    describe('disabled 行为', () => {
        it('单选项 disabled：点击不触发 onChange，且 accessibilityState.disabled 为 true', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} onChange={onChange} />);
            const cherry = getByTestId('r-option-c');
            expect(cherry.props.accessibilityState).toMatchObject({ disabled: true });
            await fireEvent.press(cherry);
            expect(onChange).not.toHaveBeenCalled();
            // `.disabled { opacity: 0.55 }`
            expect(cherry).toHaveStyle({ opacity: 0.55 });
        });

        it('group 级 disabled：所有项都被禁用且回调不触发', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Radio testID="r" options={baseOptions} disabled onChange={onChange} />
            );
            ['a', 'b', 'c'].forEach((v) => {
                expect(getByTestId(`r-option-${v}`).props.accessibilityState).toMatchObject({ disabled: true });
            });
            await fireEvent.press(getByTestId('r-option-a'));
            expect(onChange).not.toHaveBeenCalled();
        });

        it('group 级 disabled 优先级高于 option.disabled=false', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Radio testID="r" options={[{ label: 'Solo', value: 's' }]} disabled onChange={onChange} />
            );
            await fireEvent.press(getByTestId('r-option-s'));
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    // ---------- RN 专有：勾的绘制（上游靠 CSS transition，RN 是瞬时切换） ----------
    //
    // ⚠️ 读这两组断言要知道 `react-native-svg` 会把颜色与 dash 值**归一化**后再交给宿主节点：
    //   - `stroke="#fff"` 在宿主上是 `processColor('#fff')`（`{ payload, type }` 对象），
    //     不是原字符串；
    //   - `strokeDashoffset={0}` 在宿主上是 `null`（见 `extractStroke.js`：
    //     `strokeDasharray && strokeDashoffset ? +strokeDashoffset || 0 : null`）——
    //     SVG 语义上「没有 offset」就是「整条实线」，与「画出勾」等价。

    describe('勾与配色', () => {
        it('未选中：圆圈为奶油底 + #c4b89e 描边，勾藏在虚线间隙里（dashoffset = 19）', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} />);
            expect(getByTestId('r-box-a')).toHaveStyle({
                backgroundColor: 'rgb(247, 243, 223)',
                borderColor: '#c4b89e',
                borderWidth: 2,
            });
            const path = getByTestId('r-check-path-a', HIDDEN);
            expect(path.props.strokeDasharray).toEqual([19, 19]);
            expect(path.props.strokeDashoffset).toBe(19);
            expect(strokePayload(path)).toBe(processColor('#fff'));
        });

        it('选中：圆圈转 primary 底 + primaryActive 描边，勾画出（dashoffset 归零 → null）', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} defaultValue="a" />);
            expect(getByTestId('r-box-a')).toHaveStyle({
                backgroundColor: colors.primary,
                borderColor: colors.primaryActive,
            });
            expect(getByTestId('r-check-path-a', HIDDEN).props.strokeDashoffset).toBeNull();
        });

        it('禁用：底色 #f0ece2、描边 #d4c9b4、勾 #c4b89e（禁用优先于选中，照搬 CSS 层叠）', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} defaultValue="c" />);
            // option c 自身 disabled 且被选中：`.disabled .cbx input` 在源码中位于
            // `.checked .cbx input` 之后 → 禁用配色胜出
            expect(getByTestId('r-box-c')).toHaveStyle({
                backgroundColor: '#f0ece2',
                borderColor: '#d4c9b4',
            });
            expect(strokePayload(getByTestId('r-check-path-c', HIDDEN))).toBe(processColor('#c4b89e'));
            // 但 dashoffset 仍按选中态（上游的 `.check path` 没有禁用分支的 offset 覆盖）
            expect(getByTestId('r-check-path-c', HIDDEN).props.strokeDashoffset).toBeNull();
        });

        it('标签文字色：默认 #725d42 / 选中 #794f27 / 禁用 #c4b89e', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} defaultValue="b" />);
            expect(childAt(getByTestId('r-option-a'), 1)).toHaveStyle({ color: '#725d42' });
            expect(childAt(getByTestId('r-option-b'), 1)).toHaveStyle({ color: '#794f27' });
            expect(childAt(getByTestId('r-option-c'), 1)).toHaveStyle({ color: '#c4b89e' });
        });

        it('勾是 aria-hidden 的装饰元素，不进无障碍树', async () => {
            const { getByTestId, queryByTestId } = await render(<Radio testID="r" options={baseOptions} />);
            // aria-hidden 挂在包住 <Svg> 的 View 上（挂 <Svg> 上会被 react-native-svg 丢掉）
            expect(getByTestId('r-check-a', HIDDEN).props['aria-hidden']).toBe(true);
            expect(queryByTestId('r-check-a')).toBeNull();
        });

        it('勾的容器与圆圈同心（translate(-50%, -54%) 的等价绝对偏移）', async () => {
            const { getByTestId } = await render(<Radio testID="r" options={baseOptions} size="large" />);
            // box 28 / check 15×14 → left = 14 - 7.5 = 6.5，top = 14 - 7.56 = 6.44
            const checkStyle = getByTestId('r-check-a', HIDDEN).props.style as Record<string, unknown>;
            expect(checkStyle.position).toBe('absolute');
            expect(checkStyle.left).toBeCloseTo(6.5, 5);
            expect(checkStyle.top).toBeCloseTo(6.44, 5);
        });

        it('getByRole 支持按 checked 状态过滤（RNTL 对 radio / checkbox / switch 生效）', async () => {
            const { getByRole, getAllByRole } = await render(
                <Radio testID="r" options={baseOptions} defaultValue="b" />
            );
            expect(getAllByRole('radio', { checked: false })).toHaveLength(2);
            expect(getByRole('radio', { checked: true })).toBeTruthy();
        });
    });
});
