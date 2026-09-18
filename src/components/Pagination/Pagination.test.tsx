import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Pagination } from './Pagination';
import { computeSizeListPosition, getPageItems } from './geometry';

/**
 * RN 版测试，对应 Web 版 `Pagination.test.tsx` 的 12 个用例。
 *
 * **被丢弃的用例 / 断言**（RN 无对应能力）：
 *   - `className` 断言（`styles.active` / `styles.orange` / `styles.teal`）——
 *     RN 无类名系统，改为断言**样式字段本身**（当前页底色 `#ffc107` / `#19c8b9`）。
 *   - `getByRole('navigation', { name: '分页' })` —— 上游根节点是 `<nav>`，天然是
 *     可访问节点；RN 的根节点是 `View role="navigation"`，而 **RNTL 的 `getByRole`
 *     被 `isAccessibilityElement` 把门**（非 Text 宿主只有显式 `accessible` 才算）。
 *     这里不能补 `accessible`：那会把整条分页合并成一个无障碍节点、毁掉每个按钮的
 *     独立可达性。所以改为断言 `role` / `aria-label` **prop 透传**，并额外写一条
 *     用例把这条限制**钉住**（RNTL 若放宽，那条会立刻失败提醒）。
 *   - `aria-current="page"` —— RN 0.87 **不支持** `aria-current`（`View.js` 的
 *     `aria-*` 改写名单里没有它）。语义最接近的替代是 `aria-selected`
 *     → `accessibilityState.selected`，已按此替换并单独断言。
 *   - `getByRole('textbox', { name: '跳转到指定页' })` —— RN 0.87 的 `Role` 联合里
 *     **没有 `textbox`**，无法给 `TextInput` 补角色；改用 `testID` + `aria-label` 断言。
 *   - 「点击弹层内部空白不关闭」不能照搬：RNTL 的 `fireEvent.press` 是**向上**找
 *     `onPress`，而遮罩是弹层的**兄弟**节点，所以无论弹层有没有防穿透，断言都会通过
 *     —— 测出来是假象。改为直接断言防穿透机制（`onStartShouldSetResponder()` 返回 true）。
 *   - hover 相关全部不存在（RN 无 hover），故没有对应用例可移植。
 *
 * **未被丢弃、且完整移植的键盘用例**：
 *   - 「输入页码回车跳页」—— Web 的 `onKeyDown` + `Enter` 在 RN 里就是
 *     `TextInput.onSubmitEditing`（软键盘回车键），所以这条**保留**，不是替代品。
 *
 * **RN 侧新增**：`Modal.onRequestClose`（Android 返回键）关闭每页条数弹层，
 * 替代 Web 的 Escape（Web 的 Escape 走 `document.addEventListener('keydown')`）。
 *
 * ⚠️ **覆盖不到的部分**（已在 `geometry.ts` 里抽成纯函数并用本文件的
 * 「纯函数」两节单测兜住）：
 *   - 弹层的屏幕定位靠 `View.measureInWindow`，而 jest preset 把它 mock 成
 *     **永不回调的空实现**（`@react-native/jest-preset/jest/MockNativeMethods.js`
 *     里是 `measureInWindow: jest.fn()`），所以弹层挂在兜底位置 `{ bottom: 0, left: 0 }`。
 *
 * ⚠️ **读断言前必须知道：jest preset 把 `View` 整个 mock 掉了**
 * （`@react-native/jest-preset/jest/setup.js` → `mocks/View.js` → `mockComponent`），
 * mock 把 props **原样**透传给宿主节点，**不做 RN 的 `aria-*` 改写**。于是：
 *   - `<Pressable aria-label>` → 宿主上是 `accessibilityLabel`（Pressable 自己在 JS 里转）
 *     —— 与真机一致，可以放心断言；
 *   - `<View role aria-label>` → 宿主上是**原样的** `role` / `aria-label`
 *     —— 只能证明「组件把 prop 传下去了」。
 */

/** 装饰元素带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

const child = (node: unknown) => node as TestInstance;

/** 弹层遮罩 / 弹层自身都要靠 prop 定位，这里按 prop 找宿主节点 */
const queryByProp = (container: TestInstance, predicate: (props: Record<string, unknown>) => boolean) =>
    container.queryAll((n) => predicate(n.props as Record<string, unknown>));

describe('Pagination', () => {
    describe('渲染', () => {
        it('渲染页码序列与导航语义', async () => {
            const { getByTestId, getAllByRole } = await render(<Pagination testID="p" total={50} pageSize={10} />);
            const root = getByTestId('p');
            // 上游是 `<nav aria-label="分页">`；RN 里两者都只能证明「prop 传下去了」
            expect(root.props.role).toBe('navigation');
            expect(root.props['aria-label']).toBe('分页');

            [1, 2, 3, 4, 5].forEach((p) => {
                expect(getByTestId(`p-page-${p}`)).toBeTruthy();
            });
            // 5 个页码 + 上一页 / 下一页
            expect(getAllByRole('button')).toHaveLength(7);
        });

        it('RNTL 的 getByRole 查不到 role="navigation" 的 View（钉住这条限制）', async () => {
            const { queryByRole, getByTestId } = await render(<Pagination testID="p" total={50} pageSize={10} />);
            // 根节点没有（也不能有）`accessible`，所以它不是 accessibility element
            expect(getByTestId('p').props.accessible).toBeUndefined();
            expect(queryByRole('navigation')).toBeNull();
        });

        it('当前页高亮，并以 accessibilityState.selected 取代 aria-current', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={50} pageSize={10} defaultCurrent={2} />);
            const active = getByTestId('p-page-2');
            // `.orange .active { background: #ffc107 }`
            expect(active).toHaveStyle({ backgroundColor: '#ffc107' });
            expect(active.props.accessibilityState).toMatchObject({ selected: true });
            // `.active { color: #fff; font-weight: 700 }`
            expect(child(active.children[0])).toHaveStyle({ color: '#fff', fontWeight: '700' });

            expect(getByTestId('p-page-1').props.accessibilityState).toMatchObject({ selected: false });
        });

        it('variant 默认 orange：当前页底色 #ffc107', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={50} pageSize={10} defaultCurrent={2} />);
            expect(getByTestId('p-page-2')).toHaveStyle({ backgroundColor: '#ffc107' });
        });

        it('variant="teal" 应用青色当前页底', async () => {
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} defaultCurrent={2} variant="teal" />
            );
            expect(getByTestId('p-page-2')).toHaveStyle({ backgroundColor: '#19c8b9' });
        });

        it('页数超过 7 页时两端显示省略号（aria-hidden 的装饰元素）', async () => {
            const { getByTestId, getAllByText, getAllByRole } = await render(
                <Pagination testID="p" total={100} pageSize={10} defaultCurrent={5} />
            );
            // 第 5 / 10 页：左右各一个省略号；两个都是 `aria-hidden`，查它们要带上 HIDDEN
            expect(getAllByText('···', HIDDEN)).toHaveLength(2);
            expect(getByTestId('p-ellipsis-left', HIDDEN).props['aria-hidden']).toBe(true);
            expect(getByTestId('p-ellipsis-right', HIDDEN).props['aria-hidden']).toBe(true);
            // 首尾页始终可见
            expect(getByTestId('p-page-1')).toBeTruthy();
            expect(getByTestId('p-page-10')).toBeTruthy();
            // 省略号是纯装饰，不占 button 语义：1/4/5/6/10 五个页码 + 上一页/下一页
            expect(getAllByRole('button')).toHaveLength(7);
        });

        it('showTotal 显示总条数，默认不显示', async () => {
            const { getByText, rerender, queryByText } = await render(
                <Pagination testID="p" total={123} pageSize={10} showTotal />
            );
            expect(getByText('共 123 条')).toBeTruthy();

            await rerender(<Pagination testID="p" total={123} pageSize={10} />);
            expect(queryByText('共 123 条')).toBeNull();
        });

        it('根节点按内容宽度收缩（对应 Web 的 inline-flex），gap 2', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={50} pageSize={10} />);
            expect(getByTestId('p')).toHaveStyle({ alignSelf: 'flex-start', gap: 2 });
        });

        it('上一页 / 下一页带可访问名，且用 SVG 箭头而非文字', async () => {
            const { getByRole } = await render(<Pagination testID="p" total={50} pageSize={10} />);
            expect(getByRole('button', { name: '上一页' })).toBeTruthy();
            expect(getByRole('button', { name: '下一页' })).toBeTruthy();
        });
    });

    describe('交互', () => {
        it('点击页码触发 onChange', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} defaultCurrent={1} onChange={onChange} />
            );
            await fireEvent.press(getByTestId('p-page-3'));
            expect(onChange).toHaveBeenCalledWith(3, 10);
        });

        it('点击当前页不触发 onChange（上游 changePage 的 target === page 提前返回）', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} defaultCurrent={3} onChange={onChange} />
            );
            await fireEvent.press(getByTestId('p-page-3'));
            expect(onChange).not.toHaveBeenCalled();
        });

        it('首页禁用上一页，末页禁用下一页', async () => {
            const first = await render(<Pagination testID="p" total={50} pageSize={10} defaultCurrent={1} />);
            expect(first.getByTestId('p-prev').props.accessibilityState).toMatchObject({ disabled: true });
            expect(first.getByTestId('p-next').props.accessibilityState).toMatchObject({ disabled: false });
            await first.unmount();

            const last = await render(<Pagination testID="p" total={50} pageSize={10} defaultCurrent={5} />);
            expect(last.getByTestId('p-prev').props.accessibilityState).toMatchObject({ disabled: false });
            expect(last.getByTestId('p-next').props.accessibilityState).toMatchObject({ disabled: true });
        });

        it('上一页 / 下一页按页边界收窄，越界请求被夹住', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} defaultCurrent={5} onChange={onChange} />
            );
            // 第 5 页是末页，下一页被 disabled（onPress 传 undefined），点击无效果
            await fireEvent.press(getByTestId('p-next'));
            expect(onChange).not.toHaveBeenCalled();

            await fireEvent.press(getByTestId('p-prev'));
            expect(onChange).toHaveBeenLastCalledWith(4, 10);
            expect(onChange).toHaveBeenCalledTimes(1);
        });

        it('页数少于 1 时收敛为 1 页（total=0）', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(<Pagination testID="p" total={0} pageSize={10} onChange={onChange} />);
            expect(getByTestId('p-page-1')).toBeTruthy();
            expect(getByTestId('p-prev').props.accessibilityState).toMatchObject({ disabled: true });
            expect(getByTestId('p-next').props.accessibilityState).toMatchObject({ disabled: true });
        });
    });

    describe('受控模式', () => {
        it('外部 current 不变时点击不跳页', async () => {
            const onChange = jest.fn();
            const { getByTestId, rerender } = await render(
                <Pagination testID="p" total={50} pageSize={10} current={1} onChange={onChange} />
            );
            await fireEvent.press(getByTestId('p-page-2'));
            expect(onChange).toHaveBeenCalledWith(2, 10);
            // 受控：未重渲染时高亮仍在第 1 页
            expect(getByTestId('p-page-1').props.accessibilityState).toMatchObject({ selected: true });

            await rerender(<Pagination testID="p" total={50} pageSize={10} current={2} onChange={onChange} />);
            expect(getByTestId('p-page-2').props.accessibilityState).toMatchObject({ selected: true });
        });

        it('受控 current 超过页数时收敛到末页', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={30} pageSize={10} current={99} />);
            expect(getByTestId('p-page-3').props.accessibilityState).toMatchObject({ selected: true });
        });
    });

    describe('showSizeChanger', () => {
        it('切换每页条数并回调 onShowSizeChange / onChange', async () => {
            const onShowSizeChange = jest.fn();
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination
                    testID="p"
                    total={100}
                    pageSize={10}
                    current={10}
                    showSizeChanger
                    pageSizeOptions={[10, 20, 50]}
                    onShowSizeChange={onShowSizeChange}
                    onChange={onChange}
                />
            );
            await fireEvent.press(getByTestId('p-size-trigger'));
            expect(getByTestId('p-size-trigger').props.accessibilityState).toMatchObject({ expanded: true });

            await fireEvent.press(getByTestId('p-size-option-20'));
            // 100 条 / 20 条 = 5 页，原第 10 页收敛到第 5 页
            expect(onShowSizeChange).toHaveBeenCalledWith(5, 20);
            expect(onChange).toHaveBeenCalledWith(5, 20);
            // 选完即关闭
            expect(getByTestId('p-size-trigger').props.accessibilityState).toMatchObject({ expanded: false });
        });

        it('触发器可访问名为「每页 N 条」，选项带 aria-selected', async () => {
            const { getByRole, getByTestId } = await render(
                <Pagination testID="p" total={100} pageSize={10} showSizeChanger pageSizeOptions={[10, 20]} />
            );
            expect(getByRole('button', { name: '每页 10 条' })).toBeTruthy();

            await fireEvent.press(getByTestId('p-size-trigger'));
            expect(getByRole('option', { name: '20 条/页' })).toBeTruthy();
            expect(getByTestId('p-size-option-10').props.accessibilityState).toMatchObject({ selected: true });
            expect(getByTestId('p-size-option-20').props.accessibilityState).toMatchObject({ selected: false });
        });

        it('默认 pageSizeOptions 为 [10, 20, 50, 100]', async () => {
            const { getByTestId, queryByTestId } = await render(
                <Pagination testID="p" total={100} pageSize={10} showSizeChanger />
            );
            await fireEvent.press(getByTestId('p-size-trigger'));
            [10, 20, 50, 100].forEach((opt) => expect(getByTestId(`p-size-option-${opt}`)).toBeTruthy());
            expect(queryByTestId('p-size-option-25')).toBeNull();
        });

        it('未展开时不渲染弹层', async () => {
            const { queryByTestId } = await render(<Pagination testID="p" total={100} pageSize={10} showSizeChanger />);
            expect(queryByTestId('p-size-list')).toBeNull();
        });

        it('点击遮罩（弹层外部）关闭弹层', async () => {
            const { getByTestId, queryByTestId } = await render(
                <Pagination testID="p" total={100} pageSize={10} showSizeChanger />
            );
            await fireEvent.press(getByTestId('p-size-trigger'));
            expect(getByTestId('p-size-list')).toBeTruthy();

            await fireEvent.press(getByTestId('p-size-backdrop'));
            expect(queryByTestId('p-size-list')).toBeNull();
        });

        it('Android 返回键（Modal.onRequestClose）关闭弹层，替代 Web 的 Escape', async () => {
            const { getByTestId, queryByTestId, container } = await render(
                <Pagination testID="p" total={100} pageSize={10} showSizeChanger />
            );
            await fireEvent.press(getByTestId('p-size-trigger'));

            // RNTL v14 没有 `UNSAFE_getByType`；用 `container.queryAll` 按 prop 定位 Modal 宿主节点
            const modals = queryByProp(child(container), (props) => typeof props.onRequestClose === 'function');
            expect(modals).toHaveLength(1);

            await act(async () => {
                (modals[0].props as { onRequestClose: () => void }).onRequestClose();
            });
            expect(queryByTestId('p-size-list')).toBeNull();
        });

        it('弹层自身吃掉触摸（防穿透机制），而非靠模拟点击证明', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={100} pageSize={10} showSizeChanger />);
            await fireEvent.press(getByTestId('p-size-trigger'));
            expect(getByTestId('p-size-list').props.onStartShouldSetResponder()).toBe(true);
        });

        it('弹层在 measureInWindow 永不回调时挂在兜底位置（{ bottom: 0, left: 0 }）', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={100} pageSize={10} showSizeChanger />);
            await fireEvent.press(getByTestId('p-size-trigger'));
            expect(getByTestId('p-size-list')).toHaveStyle({ bottom: 0, left: 0 });
        });

        it('选中项带金色 pill bar 装饰（aria-hidden）', async () => {
            const { getByTestId, queryByTestId } = await render(
                <Pagination testID="p" total={100} pageSize={10} showSizeChanger pageSizeOptions={[10, 20]} />
            );
            await fireEvent.press(getByTestId('p-size-trigger'));
            // 选中项多一层 pill，未选中项没有
            expect(getByTestId('p-size-option-10').children).toHaveLength(2);
            expect(getByTestId('p-size-option-20').children).toHaveLength(1);
            expect(queryByTestId('p-size-option-20')).toBeTruthy();
        });
    });

    describe('showQuickJumper', () => {
        it('输入页码回车跳页，超界收敛（onSubmitEditing 取代 Web 的 Enter）', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination
                    testID="p"
                    total={100}
                    pageSize={10}
                    defaultCurrent={1}
                    showQuickJumper
                    onChange={onChange}
                />
            );
            const input = getByTestId('p-jump-input');
            await fireEvent.changeText(input, '99');
            await fireEvent(input, 'submitEditing');

            expect(onChange).toHaveBeenCalledWith(10, 10);
            expect(getByTestId('p-jump-input').props.value).toBe('');
        });

        it('失焦同样跳页（对应 Web 的 onBlur）', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination
                    testID="p"
                    total={100}
                    pageSize={10}
                    defaultCurrent={1}
                    showQuickJumper
                    onChange={onChange}
                />
            );
            const input = getByTestId('p-jump-input');
            await fireEvent.changeText(input, '4');
            await fireEvent(input, 'blur');
            expect(onChange).toHaveBeenCalledWith(4, 10);
        });

        it('非数字被过滤，空值不跳页', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination
                    testID="p"
                    total={100}
                    pageSize={10}
                    defaultCurrent={1}
                    showQuickJumper
                    onChange={onChange}
                />
            );
            const input = getByTestId('p-jump-input');
            await fireEvent.changeText(input, '1a2');
            expect(getByTestId('p-jump-input').props.value).toBe('12');

            await fireEvent.changeText(input, '');
            await fireEvent(input, 'submitEditing');
            expect(onChange).not.toHaveBeenCalled();
        });

        it('输入框带 aria-label，且角色只能是 aria-label（RN 无 textbox 角色）', async () => {
            const { getByTestId } = await render(<Pagination testID="p" total={100} pageSize={10} showQuickJumper />);
            const input = getByTestId('p-jump-input');
            expect(input.props['aria-label']).toBe('跳转到指定页');
            // RN 0.87 的 Role 联合里没有 `textbox`，所以这里没有 role
            expect(input.props.role).toBeUndefined();
        });
    });

    describe('disabled', () => {
        it('禁用全部交互', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} defaultCurrent={2} disabled onChange={onChange} />
            );
            expect(getByTestId('p-prev').props.accessibilityState).toMatchObject({ disabled: true });
            expect(getByTestId('p-next').props.accessibilityState).toMatchObject({ disabled: true });
            expect(getByTestId('p-page-3').props.accessibilityState).toMatchObject({ disabled: true });

            await fireEvent.press(getByTestId('p-page-3'));
            await fireEvent.press(getByTestId('p-next'));
            expect(onChange).not.toHaveBeenCalled();
            // `.disabled { opacity: 0.6 }`
            expect(getByTestId('p')).toHaveStyle({ opacity: 0.6 });
        });

        it('禁用时页码文字转 #d4c9b4，且当前页仍保留底色（照搬 CSS 层叠）', async () => {
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} defaultCurrent={2} disabled />
            );
            // `.item:disabled`(0,2,0) 压过 `.active`(0,1,0) → 文字灰
            expect(child(getByTestId('p-page-2').children[0])).toHaveStyle({ color: '#d4c9b4' });
            // 但背景同权重、源码在后者胜 → 仍为琥珀
            expect(getByTestId('p-page-2')).toHaveStyle({ backgroundColor: '#ffc107' });
        });

        it('禁用时每页条数切换器不可展开', async () => {
            const { getByTestId, queryByTestId } = await render(
                <Pagination testID="p" total={100} pageSize={10} showSizeChanger disabled />
            );
            const trigger = getByTestId('p-size-trigger');
            expect(trigger.props.accessibilityState).toMatchObject({ disabled: true });
            expect(trigger).toHaveStyle({ opacity: 0.5, backgroundColor: '#f5f5f0' });

            await fireEvent.press(trigger);
            expect(queryByTestId('p-size-list')).toBeNull();
        });

        it('禁用时快速跳转输入框不可编辑', async () => {
            const onChange = jest.fn();
            const { getByTestId } = await render(
                <Pagination testID="p" total={100} pageSize={10} showQuickJumper disabled onChange={onChange} />
            );
            const input = getByTestId('p-jump-input');
            expect(input.props.editable).toBe(false);
            await fireEvent.changeText(input, '5');
            await fireEvent(input, 'submitEditing');
            expect(onChange).not.toHaveBeenCalled();
        });
    });

    describe('透传', () => {
        it('style / testID 透传，且 style 排在最后可覆盖默认值', async () => {
            const { getByTestId } = await render(
                <Pagination testID="p" total={50} pageSize={10} style={{ marginTop: 4, alignSelf: 'center' }} />
            );
            const root = getByTestId('p');
            expect(root).toHaveStyle({ marginTop: 4, alignSelf: 'center' });
            // 默认值仍在（未被覆盖的字段）
            expect(root).toHaveStyle({ gap: 2 });
        });

        it('未传 testID 时不产生派生 testID', async () => {
            const { queryByTestId } = await render(<Pagination total={50} pageSize={10} />);
            expect(queryByTestId('undefined-prev')).toBeNull();
        });
    });

    // ---------- 纯函数：页码序列（对应上游 getPageItems，测试渲染器外可完全覆盖） ----------

    describe('getPageItems（纯函数）', () => {
        it('页数 <= 7 时全部平铺，不折叠', () => {
            expect(getPageItems(1, 1)).toEqual([1]);
            expect(getPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
            expect(getPageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        });

        it('页数 > 7 时折叠：首尾 + 当前页邻域 + 省略号', () => {
            expect(getPageItems(5, 10)).toEqual([1, 'ellipsis-left', 4, 5, 6, 'ellipsis-right', 10]);
            expect(getPageItems(4, 10)).toEqual([1, 'ellipsis-left', 3, 4, 5, 'ellipsis-right', 10]);
        });

        it('当前页 <= 3 时左侧不出现省略号（阈值是 current > 3）', () => {
            expect(getPageItems(1, 10)).toEqual([1, 2, 'ellipsis-right', 10]);
            expect(getPageItems(3, 10)).toEqual([1, 2, 3, 4, 'ellipsis-right', 10]);
        });

        it('当前页 >= pageCount - 2 时右侧不出现省略号', () => {
            expect(getPageItems(8, 10)).toEqual([1, 'ellipsis-left', 7, 8, 9, 10]);
            expect(getPageItems(9, 10)).toEqual([1, 'ellipsis-left', 8, 9, 10]);
            expect(getPageItems(10, 10)).toEqual([1, 'ellipsis-left', 9, 10]);
        });

        it('首尾页始终存在', () => {
            for (let current = 1; current <= 12; current += 1) {
                const items = getPageItems(current, 12);
                expect(items[0]).toBe(1);
                expect(items[items.length - 1]).toBe(12);
            }
        });

        it('邻域恒为 3 个页码（未贴边时）', () => {
            const items = getPageItems(6, 20);
            expect(items).toEqual([1, 'ellipsis-left', 5, 6, 7, 'ellipsis-right', 20]);
        });

        it('保留上游的两处怪癖：贴边时不联动、8 页时 current=7 会吞掉中间页', () => {
            // 上游不修正的既有行为，移植时 1:1 保留
            expect(getPageItems(7, 8)).toEqual([1, 'ellipsis-left', 6, 7, 8]);
            // 左侧省略号出现但 start 被夹到 2 → 2 与省略号并存
            expect(getPageItems(4, 8)).toEqual([1, 'ellipsis-left', 3, 4, 5, 'ellipsis-right', 8]);
        });

        it('current 未做下界夹取（上游同样如此），退化序列原样保留', () => {
            expect(getPageItems(0, 10)).toEqual([1, 'ellipsis-right', 10]);
        });

        it('每个页码最多出现一次', () => {
            const items = getPageItems(5, 10).filter((i): i is number => typeof i === 'number');
            expect(new Set(items).size).toBe(items.length);
        });
    });

    // ---------- 纯函数：弹层定位（measureInWindow 在测试里永不回调，只能这么测） ----------

    describe('computeSizeListPosition（纯函数）', () => {
        it('弹层向上弹出：bottom = 窗口高 - 触发区顶边 + 8，左对齐触发区', () => {
            expect(
                computeSizeListPosition({ x: 100, y: 500, width: 80, height: 34 }, { width: 375, height: 800 })
            ).toEqual({ bottom: 308, left: 100 });
        });

        it('触发区贴近窗口底部时 bottom 变小（弹层仍在其上方）', () => {
            const nearBottom = computeSizeListPosition(
                { x: 0, y: 766, width: 80, height: 34 },
                { width: 375, height: 800 }
            );
            expect(nearBottom).toEqual({ bottom: 42, left: 0 });
        });

        it('与窗口宽度无关（上游不做右侧溢出处理，1:1 保留）', () => {
            const trigger = { x: 320, y: 500, width: 80, height: 34 };
            expect(computeSizeListPosition(trigger, { width: 375, height: 800 })).toEqual(
                computeSizeListPosition(trigger, { width: 1440, height: 800 })
            );
        });
    });
});
