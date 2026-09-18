import React from 'react';
import { Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { Cursor } from './Cursor';

/**
 * RN 版测试，对应 Web 版 `Cursor.test.tsx` 的 7 个用例。
 *
 * **被丢弃的 Web 用例（6 条，全部因为「RN 没有鼠标光标」）**：
 *   - `渲染 children 并包含 animal-cursor 类` 的**类名那一半** —— RN 无类名系统。
 *     渲染 children 那一半保留。
 *   - `forceAll=true（默认）应用 animal-cursor--force`
 *   - `forceAll=false 应用 animal-cursor--scoped`
 *   - `type 未设置时（默认）不带 raindrop 类`
 *   - `type="raindrop" 应用 animal-cursor--raindrop`
 *   - `type="raindrop" 与 forceAll=false 组合`
 *   这 5 条断言的全是 `cursor.css` 拼出来的类名，而它们**唯一的作用**是切换鼠标指针图片
 *   （`cursor: url("data:image/svg+xml,…")`）。RN 0.87 的 `cursor` 样式属性类型是
 *   `CursorValue = 'auto' | 'pointer'`，既没有 `url(...)` 自定义图片，也没有
 *   `default` / `text` / `not-allowed`，所以「箭头 vs 雨滴」「force vs scoped」在 RN 上
 *   **没有任何可表达的对应物**，这些用例无法移植，也刻意不发明触摸版替代品。
 *   → 替换为一条**更强**的等价断言：`type` / `forceAll` 的四种组合渲染出的宿主树
 *     **逐字节相同**，即它们确实是空操作（no-op），只用于保住上游 API 的形状。
 *   - `应用 className 与 style` —— `className` 在 RN 里不存在，保留 `style` / `testID`。
 *
 * **另一处 Web → RN 的差异（测试侧可见）**：Web 用例把裸字符串 `x` 当 children 传
 * （`<Cursor>x</Cursor>`），RN 里裸字符串不能作为 `View` 的子节点，必须包在 `<Text>` 里，
 * 所以本文件统一用 `<Text>` 包裹文本。
 *
 * **测不到的**：一切与「指针长什么样」有关的东西 —— RN 没有指针，测试渲染器也没有。
 * 本文件能证明的只有：组件还在、children 被原样透传、`type` / `forceAll` 不产生副作用。
 */
type TestInstance = Awaited<ReturnType<typeof render>>['container'];

const child = (node: unknown) => node as TestInstance;

/** 把一次渲染的宿主树序列化，用于「四种组合完全一致」的比较 */
const treeOf = async (ui: React.ReactElement) => {
    const { toJSON, unmount } = await render(ui);
    const json = JSON.stringify(toJSON());
    await unmount();
    return json;
};

describe('Cursor', () => {
    it('渲染 children（Web 用例 1 的前半；类名断言在 RN 无对应物）', async () => {
        const { getByTestId, getByText } = await render(
            <Cursor testID="c">
                <Text>child</Text>
            </Cursor>
        );
        expect(getByTestId('c')).toBeTruthy();
        expect(getByText('child')).toBeTruthy();
    });

    it('应用 style 与 testID（Web 用例 7，去掉 className）', async () => {
        const { getByTestId } = await render(
            <Cursor testID="c" style={{ padding: 4 }}>
                <Text>x</Text>
            </Cursor>
        );
        expect(getByTestId('c')).toHaveStyle({ padding: 4 });
    });

    it('type / forceAll 是空操作：四种组合渲染出的树完全一致', async () => {
        const body = (
            <Cursor testID="c">
                <Text>x</Text>
            </Cursor>
        );
        const base = await treeOf(body);
        const cases: Array<{ type?: 'default' | 'raindrop'; forceAll?: boolean }> = [
            { type: 'default' },
            { type: 'raindrop' },
            { type: 'raindrop', forceAll: false },
            { forceAll: false },
            { forceAll: true },
        ];

        for (const props of cases) {
            const json = await treeOf(
                <Cursor testID="c" {...props}>
                    <Text>x</Text>
                </Cursor>
            );
            expect(json).toBe(base);
        }
        // 反证：这个比较本身是有效的 —— 换一个 children 就会不同
        const different = await treeOf(
            <Cursor testID="c">
                <Text>y</Text>
            </Cursor>
        );
        expect(different).not.toBe(base);
    });

    it('包裹层是纯直通：不传 style 时不产生任何样式，也不加交互/无障碍属性', async () => {
        const { getByTestId } = await render(
            <Cursor testID="c">
                <Text>x</Text>
            </Cursor>
        );
        const root = getByTestId('c');
        expect(root.type).toBe('View');
        expect(root.props.style).toBeUndefined();
        // 不做任何「光标」之外的事：不拦触摸、不进无障碍树、不设角色
        expect(root.props.pointerEvents).toBeUndefined();
        expect(root.props.accessible).toBeUndefined();
        expect(root.props.role).toBeUndefined();
        expect(root.props['aria-hidden']).toBeUndefined();
    });

    it('无 props 用法（Drawer / Modal 就是这么用的）正常工作', async () => {
        // Drawer.tsx / Modal.tsx 里是 `<Cursor>…</Cursor>`，一个 props 都不传。
        // 这条用例保证「包一层 Cursor」不会影响内容的渲染。
        const { getByTestId } = await render(
            <Cursor>
                <View testID="content">
                    <Text>drawer content</Text>
                </View>
            </Cursor>
        );
        expect(getByTestId('content')).toBeTruthy();
    });

    it('多个 children 全部原样透传', async () => {
        const { getByTestId } = await render(
            <Cursor testID="c">
                <View testID="a" />
                <View testID="b" />
                <Text>t</Text>
            </Cursor>
        );
        expect(getByTestId('c').children).toHaveLength(3);
        expect(child(getByTestId('c').children[0]).props.testID).toBe('a');
        expect(child(getByTestId('c').children[1]).props.testID).toBe('b');
    });

    it('children 可选：不传时渲染一个空容器', async () => {
        const { getByTestId } = await render(<Cursor testID="c" />);
        expect(getByTestId('c').children).toHaveLength(0);
    });
});
