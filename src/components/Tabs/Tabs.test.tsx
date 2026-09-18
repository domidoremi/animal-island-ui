import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Tabs, type TabItem } from './Tabs';
import { colors } from '../../theme/tokens';

/**
 * RN 版测试，对应 Web 版 `Tabs.test.tsx` 的 11 个用例。
 *
 * **被丢弃的 Web 用例及原因**
 *
 *   - `ArrowRight / ArrowLeft 切换 tab 并迁移焦点`、`ArrowLeft 首项循环到末项 /
 *     ArrowRight 末项循环到首项`、`Home / End 跳到首尾项` —— 共 3 条。
 *     RN 没有 DOM 键盘事件，也没有 `element.focus()`：整段 `onKeyDown` + `focusTab`
 *     在移植时被删除（见 Tabs.tsx 的注释）。触摸设备上「切换 tab」就是点它本身；
 *     键盘漫游留给系统读屏。**没有等价的 RN 行为可测**。
 *   - `aria-controls` 那半条双向关联 —— RN 0.87 **没有 `aria-controls`**，
 *     `tab → panel` 的指向整条丢弃（面板那侧的 `id={panelId}` 也一并删了，
 *     不留死 id）。`panel → tab` 的 `aria-labelledby` 已还原并有断言。
 *   - `getByRole('tablist')` / `getByRole('tabpanel')` —— **RNTL 查不到**：
 *     它的 `getByRole` 先过 `isAccessibilityElement`，而裸 `<View>` 只在显式传了
 *     `accessible` 时才为 true。tablist 容器**刻意不设 `accessible`**（否则 RN 会把
 *     所有 tab 合并成一个无障碍节点，读屏用户就无法逐个选中了），代价就是这个限制
 *     —— 与 Collapse 的 `region` 完全相同。改为断言 `role` prop 本身。
 *   - `toHaveAccessibleName('Apple' / 'Banana' / 'Cherry')` —— 断言的是精确名字。
 *     RNTL 的 `computeAccessibleName` **不理会 `aria-hidden`**，会把装饰性圆点
 *     `●` / `○` 一起算进 tab 的名字（实测得到 `"● Apple"`），所以这里改断言
 *     label 节点本身（与 Collapse 的同类处理一致）。
 *
 * **`getByRole('tab')` 是可用的** —— tab 是 `Pressable`，它自动补 `accessible`。
 *
 * ⚠️ **RN 0.87 确实支持 `tab` / `tablist` / `tabpanel` 三个 role**：它们都在
 * `types_generated/Libraries/Components/View/ViewAccessibility.d.ts` 的 `Role`
 * 联合类型里（同时 `Libraries/Components/View/ViewAccessibility.js` 的运行时
 * 白名单也有），所以本文件直接使用，**没有降级**。
 */
const child = (node: unknown) => node as TestInstance;

/** 装饰性圆点带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

/** 读展开后的样式对象（`toHaveStyle` 只做子集匹配，这里用于精确读值） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

const items: TabItem[] = [
    { key: 'a', label: 'Apple', children: <View testID="pane-a" /> },
    { key: 'b', label: 'Banana', children: <View testID="pane-b" /> },
    { key: 'c', label: 'Cherry', children: <View testID="pane-c" /> },
];

describe('Tabs', () => {
    it('默认渲染第一个 tab 的内容', async () => {
        const { getByTestId, queryByTestId } = await render(<Tabs testID="t" items={items} />);
        expect(getByTestId('pane-a')).toBeTruthy();
        expect(queryByTestId('pane-b')).toBeNull();
    });

    it('defaultActiveKey 设置初始 active', async () => {
        const { getByTestId, queryByTestId } = await render(<Tabs testID="t" items={items} defaultActiveKey="b" />);
        expect(getByTestId('pane-b')).toBeTruthy();
        expect(queryByTestId('pane-a')).toBeNull();
    });

    it('点击 tab 切换内容并触发 onChange', async () => {
        const onChange = jest.fn();
        const { getByTestId, queryByTestId } = await render(<Tabs testID="t" items={items} onChange={onChange} />);

        await fireEvent.press(getByTestId('t-tab-b'));
        expect(onChange).toHaveBeenCalledWith('b');
        expect(getByTestId('pane-b')).toBeTruthy();
        expect(queryByTestId('pane-a')).toBeNull();
    });

    it('受控 activeKey 不自更新', async () => {
        const onChange = jest.fn();
        const { getByTestId, queryByTestId } = await render(
            <Tabs testID="t" items={items} activeKey="a" onChange={onChange} />
        );
        await fireEvent.press(getByTestId('t-tab-b'));

        expect(onChange).toHaveBeenCalledWith('b');
        // 父级没回写 → 仍显示 a 的内容
        expect(getByTestId('pane-a')).toBeTruthy();
        expect(queryByTestId('pane-b')).toBeNull();
    });

    it('受控时父级回写 → UI 切换', async () => {
        // Web 版用 @test/components 的 ControlledHost；RN 侧内联一个等价宿主
        const Host = () => {
            const [value, setValue] = useState('a');
            return <Tabs testID="t" items={items} activeKey={value} onChange={setValue} />;
        };
        const { getByTestId } = await render(<Host />);

        await fireEvent.press(getByTestId('t-tab-c'));
        expect(getByTestId('pane-c')).toBeTruthy();
    });

    it('active 项应用选中态样式（替代 Web 的 active 类）', async () => {
        const { getByTestId } = await render(<Tabs testID="t" items={items} defaultActiveKey="b" />);

        // `.tabItem.active { background: #0cc0b5 }` + `.active-shadow { box-shadow: 0 3px 0 0 @shadow-color-light }`
        expect(getByTestId('t-tab-b')).toHaveStyle({
            backgroundColor: '#0cc0b5',
            boxShadow: `0 3px 0 0 ${colors.shadowLight}`,
        });
        // 非 active 项保持透明
        expect(getByTestId('t-tab-a')).toHaveStyle({ backgroundColor: 'transparent' });
        // `.tabItem.active { color: #fff9e3; font-weight: 600 }` —— 文字色下沉到 label
        expect(getByTestId('t-label-b')).toHaveStyle({ color: '#fff9e3', fontWeight: '600' });
        expect(getByTestId('t-label-a')).toHaveStyle({ color: colors.text, fontWeight: '500' });
    });

    it('shadow=false 时选中项不加硬偏移投影', async () => {
        const { getByTestId } = await render(<Tabs testID="t" items={items} defaultActiveKey="b" shadow={false} />);
        const active = getByTestId('t-tab-b');
        expect(active).toHaveStyle({ backgroundColor: '#0cc0b5' });
        // 选中态背景仍在，但投影那一段被跳过（用展开后的样式对象精确读值）
        expect(styleOf(active).boxShadow).toBeUndefined();
    });

    it('装饰性圆点随选中态切换字形与缩放', async () => {
        const { getByTestId } = await render(<Tabs testID="t" items={items} defaultActiveKey="b" />);
        // 未选中 ○ / 选中 ●（与 Web 版一致）。圆点是 aria-hidden，要显式带上 includeHiddenElements
        expect(getByTestId('t-icon-a', HIDDEN)).toHaveTextContent('○', { exact: true });
        expect(getByTestId('t-icon-b', HIDDEN)).toHaveTextContent('●', { exact: true });
        // `.active .tabIcon { transform: scale(1.2) }`
        expect(getByTestId('t-icon-b', HIDDEN)).toHaveStyle({ transform: [{ scale: 1.2 }] });
        // `.tabIcon { font-size: 10px }`
        expect(getByTestId('t-icon-a', HIDDEN)).toHaveStyle({ fontSize: 10 });
    });

    it('容器与 tabList 的盒模型按上游声明', async () => {
        const { getByTestId } = await render(<Tabs testID="t" items={items} />);
        // `.tabs { background: @bg-color; border-radius: 24px; border: 2px solid @border-color-light; overflow: hidden }`
        expect(getByTestId('t')).toHaveStyle({
            backgroundColor: colors.bg,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: colors.borderLight,
            overflow: 'hidden',
        });
        // `.tabList { gap: 4px; padding: 16px; background: rgba(255,255,255,.6); border-bottom: 2px }`
        expect(getByTestId('t-tablist')).toHaveStyle({
            flexDirection: 'row',
            gap: 4,
            padding: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            borderBottomWidth: 2,
            borderBottomColor: colors.borderLight,
        });
        // `.tabContent { min-height: 60px; padding: 24px }`
        expect(getByTestId('t-panel')).toHaveStyle({ minHeight: 60, padding: 24 });
    });

    describe('a11y', () => {
        it('tablist / tab / tabpanel 角色 + aria-selected + panel→tab 关联', async () => {
            const { getByTestId, getAllByRole, queryByRole } = await render(
                <Tabs testID="t" items={items} aria-label="水果" />
            );

            // Web: <div role="tablist" aria-label="水果" aria-orientation="horizontal">
            // ⚠️ `aria-orientation` RN 无对应属性，已丢弃。
            // ⚠️ 用 props 断言而非 `getByRole('tablist')`：裸 View 过不了 RNTL 的
            // `isAccessibilityElement` 闸门（见文件头）。
            const tablist = getByTestId('t-tablist');
            expect(tablist.props.role).toBe('tablist');
            expect(tablist.props['aria-label']).toBe('水果');
            expect(tablist.props['aria-orientation']).toBeUndefined();
            expect(queryByRole('tablist')).toBeNull();

            // tab 是 Pressable（自动带 accessible），`getByRole('tab')` 可用
            const tabs = getAllByRole('tab');
            expect(tabs).toHaveLength(items.length);
            // `aria-selected` 由 Pressable 折进 accessibilityState.selected
            expect(getByTestId('t-tab-a').props.accessibilityState).toMatchObject({ selected: true });
            expect(getByTestId('t-tab-b').props.accessibilityState).toMatchObject({ selected: false });

            // panel → tab 的关联：`aria-labelledby` 指向 active tab 的 nativeID
            const panel = getByTestId('t-panel');
            expect(panel.props.role).toBe('tabpanel');
            expect(panel.props['aria-labelledby']).toBe(getByTestId('t-tab-a').props.nativeID);
            expect(getByTestId('t-tab-a').props.nativeID).toMatch(/^animal-tabs-[\w-]+-tab-a$/);

            // 反向（tab → panel）在 RN 无对应属性：`aria-controls` 整条丢弃，
            // 面板也不再挂 `nativeID`（没有东西会引用它）。
            expect(getByTestId('t-tab-a').props['aria-controls']).toBeUndefined();
            expect(panel.props.nativeID).toBeUndefined();

            // `getByRole('tabpanel')` 查不到 —— 面板没有 `accessible`，把该限制钉住
            expect(queryByRole('tabpanel')).toBeNull();
        });

        it('切换 tab 后 aria-labelledby 跟随新的 active tab', async () => {
            const { getByTestId } = await render(<Tabs testID="t" items={items} />);
            expect(getByTestId('t-panel').props['aria-labelledby']).toBe(getByTestId('t-tab-a').props.nativeID);

            await fireEvent.press(getByTestId('t-tab-c'));
            expect(getByTestId('t-panel').props['aria-labelledby']).toBe(getByTestId('t-tab-c').props.nativeID);
        });

        it('装饰性圆点带 aria-hidden，默认被无障碍查询排除', async () => {
            const { getAllByText, queryByText } = await render(<Tabs testID="t" items={items} />);
            // 两个未选中的 tab 各有一个 ○。它们能被默认查询排除、只在
            // includeHiddenElements 下查到，正好反证祖先的 `aria-hidden` 生效。
            expect(queryByText('○')).toBeNull();
            expect(getAllByText('○', HIDDEN)).toHaveLength(2);
        });

        it('tab 的 label 文本作为可访问名的一部分（RNTL 会把 aria-hidden 的圆点也算进去）', async () => {
            const { getByTestId } = await render(<Tabs testID="t" items={items} />);
            // Web 版断言 `toHaveAccessibleName('Apple')`。RNTL 的
            // `computeAccessibleName` 不理会 `aria-hidden`，实测得到 "● Apple"，
            // 所以这里改为断言 label 节点本身 —— 与 Collapse 的同类限制一致。
            expect(getByTestId('t-label-a')).toHaveTextContent('Apple', { exact: true });
            expect(getByTestId('t-label-b')).toHaveTextContent('Banana', { exact: true });
            expect(getByTestId('t-label-c')).toHaveTextContent('Cherry', { exact: true });
        });

        it('roving tabindex：仅 active tab 为 0，其余为 -1', async () => {
            const { getByTestId } = await render(<Tabs testID="t" items={items} defaultActiveKey="b" />);
            // ⚠️ 宿主节点上的 `tabIndex` 是**透传后的原值**（`Pressable` 会把它放进
            // restProps 交给 `View`，而 jest preset 把 `View` mock 成原样透传）。
            // 真机上 `View.js` 会把它换算成 `focusable = !tabIndex`（见 RN-PORT.md）。
            expect(getByTestId('t-tab-a').props.tabIndex).toBe(-1);
            expect(getByTestId('t-tab-b').props.tabIndex).toBe(0);
            expect(getByTestId('t-tab-c').props.tabIndex).toBe(-1);
            // 面板自身也是 tabIndex=0（可聚焦）
            expect(getByTestId('t-panel').props.tabIndex).toBe(0);
        });
    });

    describe('透传', () => {
        it('style / testID 透传，且 style 排在最后可覆盖默认值', async () => {
            const { getByTestId } = await render(
                <Tabs testID="t" items={items} style={{ marginTop: 4, borderRadius: 8 }} />
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ marginTop: 4, borderRadius: 8 });
            expect(root).toHaveStyle({ borderWidth: 2 });
        });

        it('已废弃的 leafAnimation 仍可传入（no-op，不报错也不影响渲染）', async () => {
            const { getByTestId } = await render(<Tabs testID="t" items={items} leafAnimation />);
            expect(getByTestId('pane-a')).toBeTruthy();
        });

        it('label 为非字符串节点时原样渲染', async () => {
            const custom: TabItem[] = [
                { key: 'a', label: <Text testID="lbl">X</Text>, children: <View testID="pane" /> },
            ];
            const { getByTestId } = await render(<Tabs testID="t" items={custom} />);
            expect(getByTestId('lbl')).toBeTruthy();
            expect(getByTestId('pane')).toBeTruthy();
        });

        it('items 为空时不渲染任何 tab，面板内容为空', async () => {
            const { getByTestId, queryAllByRole } = await render(<Tabs testID="t" items={[]} />);
            expect(queryAllByRole('tab')).toHaveLength(0);
            expect(child(getByTestId('t-panel').children[0]).children).toHaveLength(0);
        });
    });

    // ---------- RN 专有：面板入场动画（替代 CSS @keyframes fadeIn）----------

    it('面板入场动画：挂载时从 opacity 0 起步', async () => {
        const { getByTestId } = await render(<Tabs testID="t" items={items} />);

        // ⚠️ 动画用 `useNativeDriver: true`，测试渲染器里没有原生动画模块 ——
        // 动画完全不推进，值停在初始的 0，且 `Animated` 已经把插值解析成了普通值
        // （拿不到 `__getValue`）。所以这里只断言「起点是 opacity: 0」
        // （对应 CSS `from { opacity: 0 }`），**不断言终值** ——
        // 终值（1）与 translateY 4 → 0 需要真机/模拟器验证。
        expect(styleOf(getByTestId('t-panel')).opacity).toBe(0);
    });
});
