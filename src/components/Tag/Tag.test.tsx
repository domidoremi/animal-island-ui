import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Tag, type TagColor, type TagSize, type TagVariant } from './Tag';

/**
 * RN 版测试，对应 Web 版 `Tag.test.tsx` 的 23 个用例（移植 22 个）。
 *
 * **被丢弃的用例**（RN 无对应能力）：
 *   - `键盘 Enter 触发 onClick` —— RN 没有 DOM 键盘事件；`Pressable` 的可达性由
 *     平台无障碍手势提供，测试渲染器里没有等价入口。上游 Enter/Space 的处理整体丢弃。
 *   - `className` 相关断言（`支持 className 与 style` 的一半）—— RN 无 className，
 *     改成 `testID` + `style`（用例 3）。
 *
 * **被改写的用例**：
 *   - 全部 `toHaveClass(styles.x)` → `toHaveStyle`。RN 没有类系统，组件把
 *     size / variant / color / disabled 合成为一个 style 对象，所以这里断言的是
 *     **合成后的最终值**（比 Web 断言「类名在不在」更强）。
 *   - `variant=outlined/dashed 应用对应类` → 断言 `borderStyle` 与颜色。注意
 *     `.color-{color}-outlined` 与 `.color-{color}-dashed` 在 Less 里是同一条规则、
 *     取值相同，所以 RN 侧也只维护一份 `outline` 表。
 *   - `color=default 不应用任何 color 类` → 断言仍是 variant 的取值（soft 的底色）。
 *   - `未提供 onClick 时不渲染为 button` → 断言根节点是纯容器 `View`（没有
 *     `onPress` / `accessibilityRole`），等价于 Web 的 `role` 为 null。
 *   - `点击关闭按钮不会冒泡触发 onClick` → RNTL 的 `fireEvent` 从目标向上找**最近**的
 *     处理函数，所以按关闭按钮只会命中它自己的 `onPress`；再加上组件里保留了上游的
 *     `e.stopPropagation()`。两层保险都有断言。
 *
 * **RN 专有补充**：
 *   - `numberOfLines={1}` 对应 CSS `white-space: nowrap`（RN 的 Text 默认换行）。
 *   - 关闭按钮的 `×` 是 `<Text>`，并继承标签文字色（CSS 的 `color: inherit`；
 *     RN 的文字色不从父 View 继承，必须显式写）。
 *   - 按下态：Web 的 `:hover` 被丢弃（触摸设备没有 hover），只保留
 *     `.is-clickable:active { transform: translateY(0) }`。用例 26 把它钉住 ——
 *     并注明它相对静止态没有视觉变化，可点击标签在触摸设备上因此没有按下反馈。
 *   - `color` 全部 12 种 × 4 种 variant 的取值枚举（用例 17），Web 侧只抽查了 4 个组合。
 */
const child = (node: unknown) => node as TestInstance;

/** 取根节点上展开后的样式对象（`toHaveStyle` 只做子集匹配，读值要用这个） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/**
 * 模拟「手指按住」。Pressability 只把 responder 事件挂到宿主 View 上
 * （`onResponderGrant` / `onResponderRelease`），不暴露 `onPressIn`，所以
 * `fireEvent(node, 'pressIn')` 打不到它。`currentTarget` 必须带 `measure` 桩：
 * Pressability 首次转按下态时会调 `this._responderID.measure(...)`。
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

/** 尺寸 —— 逐条抄自 `tag.module.less` 的 `.size-*` */
const SIZE_EXPECT: Record<TagSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
    small: { height: 24, paddingHorizontal: 10, fontSize: 12 },
    medium: { height: 32, paddingHorizontal: 12, fontSize: 14 },
    large: { height: 40, paddingHorizontal: 16, fontSize: 16 },
};

/** 变体 —— 逐条抄自 `tag.module.less` 的 `.variant-*` */
const VARIANT_EXPECT: Record<
    TagVariant,
    { backgroundColor: string; borderColor: string; borderStyle: 'solid' | 'dashed'; color: string }
> = {
    solid: { backgroundColor: 'rgb(247, 243, 223)', borderColor: '#d4c4a8', borderStyle: 'solid', color: '#8f734f' },
    outlined: { backgroundColor: 'transparent', borderColor: '#c4b89e', borderStyle: 'solid', color: '#8f734f' },
    dashed: { backgroundColor: 'transparent', borderColor: '#c4b89e', borderStyle: 'dashed', color: '#8f734f' },
    soft: { backgroundColor: '#f5f0e6', borderColor: 'transparent', borderStyle: 'solid', color: '#8f734f' },
};

/** 颜色 —— 逐条抄自 `tag.module.less` 的 `.color-{color}-{solid|soft|outlined|dashed}` */
const COLOR_EXPECT: Record<
    Exclude<TagColor, 'default'>,
    {
        solid: { backgroundColor: string; color: string };
        soft: { backgroundColor: string; color: string };
        outline: { color: string };
    }
> = {
    'app-pink': {
        solid: { backgroundColor: '#f8a6b2', color: '#fff' },
        soft: { backgroundColor: '#fce4ec', color: '#c2185b' },
        outline: { color: '#f8a6b2' },
    },
    purple: {
        solid: { backgroundColor: '#b77dee', color: '#fff' },
        soft: { backgroundColor: '#f3e5f5', color: '#7b1fa2' },
        outline: { color: '#b77dee' },
    },
    'app-blue': {
        solid: { backgroundColor: '#889df0', color: '#fff' },
        soft: { backgroundColor: '#e6f0ff', color: '#1565c0' },
        outline: { color: '#889df0' },
    },
    'app-yellow': {
        solid: { backgroundColor: '#f7cd67', color: '#fff' },
        soft: { backgroundColor: '#fff8e1', color: '#f9a825' },
        outline: { color: '#f7cd67' },
    },
    'app-orange': {
        solid: { backgroundColor: '#e59266', color: '#fff' },
        soft: { backgroundColor: '#fff3e0', color: '#e65100' },
        outline: { color: '#e59266' },
    },
    'app-teal': {
        solid: { backgroundColor: '#82d5bb', color: '#fff' },
        soft: { backgroundColor: '#e0f2f1', color: '#00695c' },
        outline: { color: '#82d5bb' },
    },
    'app-green': {
        solid: { backgroundColor: '#8ac68a', color: '#fff' },
        soft: { backgroundColor: '#e8f5e9', color: '#2e7d32' },
        outline: { color: '#8ac68a' },
    },
    'app-red': {
        solid: { backgroundColor: '#fc736d', color: '#fff' },
        soft: { backgroundColor: '#ffebee', color: '#c62828' },
        outline: { color: '#fc736d' },
    },
    'lime-green': {
        solid: { backgroundColor: '#d1da49', color: '#fff' },
        soft: { backgroundColor: '#f1f8e9', color: '#558b2f' },
        outline: { color: '#d1da49' },
    },
    'yellow-green': {
        solid: { backgroundColor: '#ecdf52', color: '#fff' },
        soft: { backgroundColor: '#f9fbe7', color: '#827717' },
        outline: { color: '#ecdf52' },
    },
    brown: {
        solid: { backgroundColor: '#9a835a', color: '#fff' },
        soft: { backgroundColor: '#efebe9', color: '#4e342e' },
        outline: { color: '#9a835a' },
    },
    'warm-peach-pink': {
        solid: { backgroundColor: '#e18c6f', color: '#fff' },
        soft: { backgroundColor: '#fbe9e7', color: '#bf360c' },
        outline: { color: '#e18c6f' },
    },
};

const ALL_SIZES = Object.keys(SIZE_EXPECT) as TagSize[];
const ALL_VARIANTS = Object.keys(VARIANT_EXPECT) as TagVariant[];
const ALL_COLORS = Object.keys(COLOR_EXPECT) as Exclude<TagColor, 'default'>[];

describe('Tag', () => {
    describe('rendering', () => {
        it('默认渲染 children 文本', async () => {
            const { getByText } = await render(<Tag>hello</Tag>);
            expect(getByText('hello')).toBeTruthy();
        });

        it('默认应用基础样式与 medium / soft 尺寸', async () => {
            const { getByTestId } = await render(<Tag testID="t">x</Tag>);
            const root = getByTestId('t');
            expect(root).toHaveStyle({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                borderRadius: 999,
                borderWidth: 1.5,
                // 对应 display: inline-flex（见 Tag.tsx 注释）
                alignSelf: 'flex-start',
                // medium + soft
                height: 32,
                paddingHorizontal: 12,
                backgroundColor: '#f5f0e6',
                borderColor: 'transparent',
            });
            expect(child(root.children[0])).toHaveStyle({
                fontSize: 14,
                lineHeight: 14,
                fontWeight: '600',
                color: '#8f734f',
            });
        });

        it('支持 testID 与 style（RN 无 className）', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" style={{ marginLeft: 4 }}>
                    t
                </Tag>
            );
            expect(getByTestId('t')).toHaveStyle({ marginLeft: 4 });
        });
    });

    describe('size', () => {
        it('size=small 应用对应尺寸与字号', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" size="small">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ height: 24, paddingHorizontal: 10 });
            expect(child(root.children[0])).toHaveStyle({ fontSize: 12 });
        });

        it('size=large 应用对应尺寸与字号', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" size="large">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ height: 40, paddingHorizontal: 16 });
            expect(child(root.children[0])).toHaveStyle({ fontSize: 16 });
        });

        it('size 全部 3 种枚举', async () => {
            for (const size of ALL_SIZES) {
                const { getByTestId, unmount } = await render(
                    <Tag testID="t" size={size}>
                        x
                    </Tag>
                );
                const root = getByTestId('t');
                expect(root).toHaveStyle({
                    height: SIZE_EXPECT[size].height,
                    paddingHorizontal: SIZE_EXPECT[size].paddingHorizontal,
                });
                expect(child(root.children[0])).toHaveStyle({ fontSize: SIZE_EXPECT[size].fontSize });
                await unmount();
            }
        });
    });

    describe('variant', () => {
        it('variant=outlined 透明底 + 描边', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" variant="outlined">
                    x
                </Tag>
            );
            expect(getByTestId('t')).toHaveStyle({ backgroundColor: 'transparent', borderColor: '#c4b89e' });
        });

        it('variant=dashed 透明底 + 虚线描边', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" variant="dashed">
                    x
                </Tag>
            );
            expect(getByTestId('t')).toHaveStyle({
                backgroundColor: 'transparent',
                borderColor: '#c4b89e',
                borderStyle: 'dashed',
            });
        });

        it('variant=soft 同色系浅底、无边框感', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" variant="soft">
                    x
                </Tag>
            );
            expect(getByTestId('t')).toHaveStyle({ backgroundColor: '#f5f0e6', borderColor: 'transparent' });
        });

        it('variant 全部 4 种枚举（color 默认）', async () => {
            for (const variant of ALL_VARIANTS) {
                const expected = VARIANT_EXPECT[variant];
                const { getByTestId, unmount } = await render(
                    <Tag testID="t" variant={variant}>
                        x
                    </Tag>
                );
                const root = getByTestId('t');
                expect(root).toHaveStyle({
                    backgroundColor: expected.backgroundColor,
                    borderColor: expected.borderColor,
                    borderStyle: expected.borderStyle,
                });
                expect(child(root.children[0])).toHaveStyle({ color: expected.color });
                await unmount();
            }
        });
    });

    describe('color', () => {
        it('color=default 不应用任何颜色变体（仍是 variant 的取值）', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" color="default">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ backgroundColor: '#f5f0e6', borderColor: 'transparent' });
            expect(child(root.children[0])).toHaveStyle({ color: '#8f734f' });
        });

        it('color=app-pink + solid', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" color="app-pink" variant="solid">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ backgroundColor: '#f8a6b2', borderColor: '#f8a6b2' });
            expect(child(root.children[0])).toHaveStyle({ color: '#fff' });
        });

        it('color=purple + outlined', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" color="purple" variant="outlined">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ backgroundColor: 'transparent', borderColor: '#b77dee' });
            expect(child(root.children[0])).toHaveStyle({ color: '#b77dee' });
        });

        it('color=app-blue + dashed', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" color="app-blue" variant="dashed">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ borderColor: '#889df0', borderStyle: 'dashed' });
            expect(child(root.children[0])).toHaveStyle({ color: '#889df0' });
        });

        it('color=app-pink + soft', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" color="app-pink" variant="soft">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ backgroundColor: '#fce4ec' });
            expect(child(root.children[0])).toHaveStyle({ color: '#c2185b' });
        });

        it('color=app-green + soft', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" color="app-green" variant="soft">
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ backgroundColor: '#e8f5e9' });
            expect(child(root.children[0])).toHaveStyle({ color: '#2e7d32' });
        });

        it('color 全部 12 种枚举 × solid / soft / outlined / dashed', async () => {
            for (const color of ALL_COLORS) {
                const expected = COLOR_EXPECT[color];
                // solid：背景 + 边框 + 文字都取饱和色（文字为白）
                const solid = await render(
                    <Tag testID="t" color={color} variant="solid">
                        x
                    </Tag>
                );
                expect(solid.getByTestId('t')).toHaveStyle({ backgroundColor: expected.solid.backgroundColor });
                expect(child(solid.getByTestId('t').children[0])).toHaveStyle({ color: expected.solid.color });
                await solid.unmount();

                // soft：浅底 + 同色系深色文字，边框仍由 .variant-soft 置为透明
                const soft = await render(
                    <Tag testID="t" color={color} variant="soft">
                        x
                    </Tag>
                );
                expect(soft.getByTestId('t')).toHaveStyle({
                    backgroundColor: expected.soft.backgroundColor,
                    borderColor: 'transparent',
                });
                expect(child(soft.getByTestId('t').children[0])).toHaveStyle({ color: expected.soft.color });
                await soft.unmount();

                // outlined 与 dashed 在 Less 里是同一条规则、取值相同
                for (const variant of ['outlined', 'dashed'] as const) {
                    const outlined = await render(
                        <Tag testID="t" color={color} variant={variant}>
                            x
                        </Tag>
                    );
                    const root = outlined.getByTestId('t');
                    expect(root).toHaveStyle({ borderColor: expected.outline.color });
                    expect(child(root.children[0])).toHaveStyle({ color: expected.outline.color });
                    await outlined.unmount();
                }
            }
        });
    });

    describe('closable', () => {
        it('closable=true 渲染关闭按钮（role=button，可访问名 close）', async () => {
            const { getByRole, getByTestId } = await render(
                <Tag testID="t" closable>
                    x
                </Tag>
            );
            const btn = getByRole('button', { name: 'close' });
            expect(btn).toBeTruthy();
            // Pressable 的属性断言与生产一致（见 RN-PORT.md 的 View-mock 表）
            expect(btn.props.accessibilityLabel).toBe('close');
            expect(btn.props.accessibilityState).toMatchObject({ disabled: false });
            // × 字形本身
            expect(getByTestId('t-close')).toBeTruthy();
        });

        it('点击关闭按钮触发 onClose', async () => {
            const onClose = jest.fn();
            const { getByRole } = await render(
                <Tag closable onClose={onClose}>
                    x
                </Tag>
            );
            await fireEvent.press(getByRole('button', { name: 'close' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('disabled 状态下关闭按钮被禁用，点击不触发 onClose', async () => {
            const onClose = jest.fn();
            const { getByRole, getByTestId } = await render(
                <Tag testID="t" closable disabled onClose={onClose}>
                    x
                </Tag>
            );
            const btn = getByRole('button', { name: 'close' });
            expect(btn.props.accessibilityState).toMatchObject({ disabled: true });
            // Pressable 不把 `disabled` 透传给宿主节点（Pressability 内部消化，
            // 只暴露成 accessibilityState.disabled），所以这里断言的是行为：
            // 按下去不会触发 onClose。组件里另有 `if (disabled) return` 兜底。
            await fireEvent.press(btn);
            expect(onClose).not.toHaveBeenCalled();
            // 根节点整体 pointer-events: none（对应 CSS .is-disabled）
            expect(getByTestId('t').props.pointerEvents).toBe('none');
        });
    });

    describe('clickable', () => {
        it('提供 onPress 后标签渲染为 role=button 且可点击', async () => {
            const onPress = jest.fn();
            const { getByRole } = await render(<Tag onPress={onPress}>x</Tag>);
            const tag = getByRole('button', { name: 'x' });
            expect(tag.props.accessibilityRole).toBe('button');
            await fireEvent.press(tag);
            expect(onPress).toHaveBeenCalledTimes(1);
            expect(onPress.mock.calls[0][0]).toBeTruthy();
        });

        it('disabled 状态下不响应 onPress', async () => {
            const onPress = jest.fn();
            const { getByTestId, queryByRole } = await render(
                <Tag testID="t" disabled onPress={onPress}>
                    x
                </Tag>
            );
            // 上游 `isInteractive = !!onClick && !disabled`：disabled 时退回普通 span
            expect(queryByRole('button')).toBeNull();
            const root = getByTestId('t');
            await fireEvent.press(root);
            expect(onPress).not.toHaveBeenCalled();
        });

        it('未提供 onPress 时不渲染为 button', async () => {
            const { getByTestId } = await render(<Tag testID="t">x</Tag>);
            const root = getByTestId('t');
            expect(root.props.accessibilityRole).toBeUndefined();
            expect(root.props.onPress).toBeUndefined();
        });
    });

    describe('disabled', () => {
        it('应用 is-disabled（opacity 0.5 + pointer-events none）', async () => {
            const { getByTestId } = await render(
                <Tag testID="t" disabled>
                    x
                </Tag>
            );
            const root = getByTestId('t');
            expect(root).toHaveStyle({ opacity: 0.5 });
            expect(root.props.pointerEvents).toBe('none');
        });
    });

    describe('event isolation', () => {
        it('点击关闭按钮不会冒泡触发 onPress', async () => {
            const onPress = jest.fn();
            const onClose = jest.fn();
            const { getByRole } = await render(
                <Tag closable onClose={onClose} onPress={onPress}>
                    x
                </Tag>
            );
            await fireEvent.press(getByRole('button', { name: 'close' }));
            expect(onClose).toHaveBeenCalledTimes(1);
            expect(onPress).not.toHaveBeenCalled();
        });
    });

    // ---------- RN 专有 ----------

    it('按下时应用 :active 规则（translateY 0；Web 的 :hover 已丢弃）', async () => {
        const { getByRole } = await render(<Tag onPress={jest.fn()}>x</Tag>);
        const tag = getByRole('button', { name: 'x' });
        expect(styleOf(tag).transform).toBeUndefined();
        await pressIn(tag);
        expect(styleOf(tag).transform).toEqual([{ translateY: 0 }]);
    });

    it('关闭按钮的 × 继承标签文字色（CSS color: inherit）', async () => {
        const { getByTestId } = await render(
            <Tag testID="t" closable color="purple" variant="solid">
                x
            </Tag>
        );
        const glyph = child(getByTestId('t-close').children[0]);
        expect(glyph).toHaveStyle({ color: '#fff', fontSize: 14 });
    });

    it('children 为节点时原样透传（只对文本/数字包 Text）', async () => {
        const { getByTestId } = await render(
            <Tag testID="t">
                <View testID="node" />
            </Tag>
        );
        expect(getByTestId('node')).toBeTruthy();
        // 根节点只有一个子节点：透传的节点本身（没有被包进 Text）
        expect(getByTestId('t').children).toHaveLength(1);
    });
});
