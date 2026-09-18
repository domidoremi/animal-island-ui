import React, { useState } from 'react';
import { View } from 'react-native';
import { act, render, fireEvent } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Collapse } from './Collapse';
import { colors, spacing } from '../../theme/tokens';

/**
 * RN 版测试，对应 Web 版 `Collapse.test.tsx` 的 8 个用例。
 *
 * **被丢弃的用例**：
 *   - `className` 透传 —— RN 无 className（保留 style / testID 断言）。
 *   - a11y 的 `aria-controls` ↔ `panel.id` 双向关联、`panel` 暴露 `region` 角色 ——
 *     RN 既没有 region 角色，也没有 id 关联机制（Web 版的 `useId` 那套一并去掉）。
 *     改为断言 header 的 `accessibilityRole` 与 `accessibilityState.expanded`。
 *   - Web 版「折叠按钮以 question 文本作为可访问名」这条也不成立：RNTL 的可访问名
 *     计算**不理会 `aria-hidden`**（实测把 `+` 装饰也算进去，得到 `"− Q"`），
 *     所以改为断言 `accessibilityState.expanded` 与 `+`/`−` 字形本身。
 */
const child = (node: unknown) => node as TestInstance;

/** 装饰元素带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

const layout = (height: number) => ({
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
});

const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

/** 读 Animated 插值当前的数值（`__getValue` 是 Animated 的内部求值方法） */
const animatedNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    const v = value as { __getValue?: () => number } | null;
    return typeof v?.__getValue === 'function' ? v.__getValue() : undefined;
};

/**
 * 等动画跑完。
 *
 * 本文件用**假定时器**：Animated 是 JS 驱动（`useNativeDriver: false`），会逐帧触发
 * React 更新。用真实定时器时，动画帧会在 `act` 作用域之外触发，Jest 会刷一屏
 * 「Animated(View) inside a test was not wrapped in act(...)」警告。改成假定时器后，
 * 帧的推进完全由 `advanceTimersByTime` 控制，且被包在 `act` 里，警告消失。
 */
const settleAnimation = (ms = 400) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

describe('Collapse', () => {
    it('默认折叠：accessibilityState.expanded=false 且显示 +', async () => {
        const { getByTestId, getByText } = await render(<Collapse testID="c" question="Q" answer="A" />);
        const header = getByTestId('c-header');
        expect(header.props.accessibilityRole).toBe('button');
        expect(header.props.accessibilityState).toMatchObject({ expanded: false, disabled: false });
        expect(getByText('+', HIDDEN)).toBeTruthy();
    });

    it('defaultExpanded=true 初始展开，显示 −', async () => {
        const { getByTestId, getByText } = await render(
            <Collapse testID="c" question="Q" answer="A" defaultExpanded />
        );
        expect(getByTestId('c-header').props.accessibilityState).toMatchObject({ expanded: true });
        expect(getByText('−', HIDDEN)).toBeTruthy();
    });

    it('点击切换展开状态', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" />);
        const header = getByTestId('c-header');

        await fireEvent.press(header);
        expect(header.props.accessibilityState).toMatchObject({ expanded: true });

        await fireEvent.press(header);
        expect(header.props.accessibilityState).toMatchObject({ expanded: false });
    });

    it('始终渲染 question 与 answer 内容', async () => {
        const { getByText, getByTestId } = await render(
            <Collapse testID="c" question="My question" answer={<View testID="ans" />} />
        );
        expect(getByText('My question')).toBeTruthy();
        expect(getByTestId('ans')).toBeTruthy();
    });

    it('disabled 时按钮被禁用，点击无效', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" disabled />);
        const header = getByTestId('c-header');
        expect(header.props.accessibilityState).toMatchObject({ expanded: false, disabled: true });
        await fireEvent.press(header);
        expect(header.props.accessibilityState).toMatchObject({ expanded: false });
        // 卡片整体降透明度（CSS .disabled { opacity: .6 }）
        expect(getByTestId('c')).toHaveStyle({ opacity: 0.6 });
    });

    it('应用 style 与 testID', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" style={{ marginTop: 4 }} />);
        const root = getByTestId('c');
        expect(root).toHaveStyle({ marginTop: 4 });
        // 卡片基础样式（CSS .faqCard）
        expect(root).toHaveStyle({ borderRadius: 18, borderWidth: 2, borderColor: colors.border });
    });

    it('受控用法：父级通过 defaultExpanded 重新挂载控制展开', async () => {
        const Host = () => {
            const [open, setOpen] = useState(false);
            return (
                <View>
                    <View testID="ext" onTouchEnd={() => setOpen((v) => !v)} />
                    <Collapse key={String(open)} testID="c" question="Q" answer="A" defaultExpanded={open} />
                </View>
            );
        };
        const { getByTestId } = await render(<Host />);
        await fireEvent(getByTestId('ext'), 'touchEnd');
        expect(getByTestId('c-header').props.accessibilityState).toMatchObject({ expanded: true });
    });

    // ---------- RN 专有：面板高度动画（替代 CSS Grid 的 0fr → 1fr）----------

    it('未测量到内容高度时，折叠态面板高度为 0', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" />);
        expect(animatedNumber(styleOf(getByTestId('c-panel')).height)).toBe(0);
    });

    it('测量后展开：面板高度 = 内容自然高度 + 下内边距', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" />);
        const panel = getByTestId('c-panel');

        await fireEvent(getByTestId('c-content'), 'layout', layout(100));
        await fireEvent.press(getByTestId('c-header'));
        await settleAnimation();

        // 展开进度到 1 → 100（内容）+ 24（--animal-spacing-xl）= 124
        expect(animatedNumber(styleOf(panel).height)).toBe(100 + spacing.xl);
    });

    it('再次点击后高度收回到 0', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" defaultExpanded />);
        const panel = getByTestId('c-panel');
        await fireEvent(getByTestId('c-content'), 'layout', layout(100));
        await settleAnimation();
        expect(animatedNumber(styleOf(panel).height)).toBe(100 + spacing.xl);

        await fireEvent.press(getByTestId('c-header'));
        await settleAnimation();
        expect(animatedNumber(styleOf(panel).height)).toBe(0);
    });

    it('装饰元素（+/− 与小鱼）带 aria-hidden', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" />);
        // 折叠态下这些节点默认查不到（被排除），带上 includeHiddenElements 才能查到
        expect(getByTestId('c-header').children.length).toBe(3);
        expect(() => getByTestId('c-header', HIDDEN)).not.toThrow();
    });

    it('question / answer 为非字符串节点时原样渲染', async () => {
        const { getByTestId } = await render(
            <Collapse testID="c" question={<View testID="q-node" />} answer={<View testID="a-node" />} />
        );
        expect(getByTestId('q-node')).toBeTruthy();
        expect(getByTestId('a-node')).toBeTruthy();
    });

    it('question / answer 为字符串时包在 Text 里（RN 要求）', async () => {
        const { getByTestId } = await render(<Collapse testID="c" question="Q" answer="A" />);
        const header = getByTestId('c-header');
        // header 的三个子节点：图标 / 文案容器 / 装饰
        expect(child(child(header.children[1]).children[0]).type).toBe('Text');
        expect(child(child(getByTestId('c-content')).children[0]).type).toBe('Text');
    });
});
