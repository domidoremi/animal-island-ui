import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Time } from './Time';
import { colors, fontSize, spacing } from '../../theme/tokens';
import type { TestInstance } from 'test-renderer';

/**
 * RN 版测试，对应 Web 版 `Time.test.tsx` 的 4 个用例。
 *
 * **被丢弃的 Web 用例及原因**：
 *   - 「应用 className」—— RN 无 className（`style` 部分保留）。
 *   - 「原生属性透传」（`id="island-clock"`）—— 不是丢弃而是**改名**：
 *     Web 的 `id` 在 RN 里叫 `nativeID`，用例已改写。
 *   - `container.querySelector('.' + styles.clock)` 这种按类名取节点 —— RN 无类名，
 *     改用 `getByText('09:30')`（时钟 Text 的内容就是 HH:MM，见下方说明）。
 *
 * RNTL v14 的 `render` 是**异步**的，所有用例都要 `await`；定时器用 jest 假定时器驱动。
 *
 * 说明：`.clock` 里 HH、冒号、MM 是「一个 Text + 嵌套 Text」，RNTL 的 `getByText`
 * 对 Text 宿主做**递归**文本拼接（`getTextContent`），所以 `getByText('09:30')`
 * 取到的就是时钟节点本身，等价于 Web 版的 `clock` 元素断言。
 */
const HIDDEN = { includeHiddenElements: true } as const;

const child = (node: unknown) => node as TestInstance;

/** 取节点上展开后的样式对象（`toHaveStyle` 只做子集匹配，要读值就得自己拍平） */
const styleOf = (node: TestInstance) => {
    const merged: Record<string, unknown> = {};
    const walk = (s: unknown) => {
        if (Array.isArray(s)) s.forEach(walk);
        else if (s && typeof s === 'object') Object.assign(merged, s);
    };
    walk(node.props.style);
    return merged;
};

describe('Time', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        // 本地时间字符串（不带 Z）：周一 Jun 8 09:30，各时区断言一致
        jest.setSystemTime(new Date('2026-06-08T09:30:00'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('渲染当前星期、月日与 HH:MM', async () => {
        const { getByText } = await render(<Time />);
        expect(getByText('Monday')).toBeTruthy();
        expect(getByText('Jun 8')).toBeTruthy();
        expect(getByText('09:30')).toBeTruthy();
        expect(getByText(':')).toBeTruthy();
    });

    it('时分补零（09:05 而非 9:5）', async () => {
        jest.setSystemTime(new Date('2026-06-08T09:05:00'));
        const { getByText } = await render(<Time />);
        expect(getByText('09:05')).toBeTruthy();
    });

    it('每秒刷新，跨分钟后更新显示', async () => {
        const { getByText, queryByText } = await render(<Time />);
        await act(async () => {
            jest.advanceTimersByTime(60_000);
        });
        expect(getByText('09:31')).toBeTruthy();
        expect(queryByText('09:30')).toBeNull();
    });

    it('卸载时清除定时器', async () => {
        // ⚠️ 不能照搬 Web 的 `expect(vi.getTimerCount()).toBe(1) → 0`：RN 测试环境里
        // 定时器计数**基线不是 0**（React 调度器与 RNTL 自身也占定时器；实测只挂载/卸载
        // 一个「仅含 setInterval」的组件，计数就是 4 → 6，卸载后还会涨）。
        // 改成直接断言「组件创建的那个 interval 在卸载时被清掉了」——比全局计数更精确。
        const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
        const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

        const { unmount } = await render(<Time />);
        const calls = setIntervalSpy.mock.calls as unknown as [unknown, number | undefined][];
        const ourCall = calls.findIndex(([, delay]) => delay === 1_000);
        expect(ourCall).toBeGreaterThanOrEqual(0);
        const timer = setIntervalSpy.mock.results[ourCall].value;

        await unmount();
        expect(clearIntervalSpy).toHaveBeenCalledWith(timer);

        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    it('应用 style 与原生属性（nativeID / aria-label）', async () => {
        const { getByTestId, getByRole } = await render(
            <Time testID="t" style={{ marginTop: 4 }} aria-label="岛屿时间" nativeID="island-clock" />
        );
        expect(getByTestId('t')).toHaveStyle({ marginTop: 4 });
        // Web 用 getByRole('timer') + toHaveAccessibleName；RN 里 role="timer" 之外
        // 还必须显式 accessible（见组件注释），否则 RNTL 的 isAccessibilityElement 为 false。
        expect(getByRole('timer', { name: '岛屿时间' })).toBeTruthy();
        expect(getByTestId('t').props.nativeID).toBe('island-clock');
    });

    // ---------- RN 专有 ----------

    it('根节点带 role="timer" / aria-live="off" / accessible', async () => {
        const { getByTestId } = await render(<Time testID="t" />);
        const root = getByTestId('t');
        // ⚠️ jest preset 把 `View` 整体 mock 掉了（props 原样透传），所以这里看到的是
        // **原始** aria-* 名；真机上 RN 的 View.js 会改写：
        //   aria-live → accessibilityLiveRegion（'off' → 'none'）
        //   aria-label → accessibilityLabel
        // 也就是说这条断言只能证明「prop 被透传」，不能证明真机语义。
        expect(root.props.role).toBe('timer');
        expect(root.props['aria-live']).toBe('off');
        expect(root.props.accessible).toBe(true);
    });

    it('挂载淡入：根节点初始 opacity 为 0（对应 @keyframes animal-time-fade-in 的 from 帧）', async () => {
        const { getByTestId } = await render(<Time testID="t" />);
        // ⚠️ 只能断言**起始帧**。两个动画都用 useNativeDriver: true，原生驱动在测试渲染器里
        // 是空操作（RN-PORT.md），拿不到中间帧；Animated.Value 传给宿主时也已被解析成普通数值，
        // 所以「它是不是 Animated 值」也断言不了。要逐帧断言就得改成 useNativeDriver: false
        // + 假定时器，那会让每一帧落到 act() 之外、刷屏警告，得不偿失。
        // 这条断言仍能挡住「淡入被整个删掉」的回归（那时 opacity 是 undefined）。
        expect(styleOf(getByTestId('t')).opacity).toBe(0);
    });

    it('冒号闪烁：冒号初始 opacity 为 1，并上移 0.11em（对应 animal-time-blink 的 0% 帧）', async () => {
        const { getByText } = await render(<Time />);
        const colon = getByText(':');
        expect(styleOf(colon).opacity).toBe(1);
        // transform: translateY(-0.11em)，em 基准是 .clock 的 44px → -4.84
        expect(styleOf(colon).transform).toEqual([{ translateY: -0.11 * 44 }]);
    });

    it('默认样式：卡片 20 圆角 / 主色胶囊 / 等宽数字 / 冒号上移', async () => {
        const { getByTestId, getByText } = await render(<Time testID="t" />);
        const root = getByTestId('t');
        expect(root).toHaveStyle({
            alignSelf: 'flex-start',
            alignItems: 'center',
            gap: spacing.md,
            paddingTop: 20,
            paddingBottom: 15,
            paddingHorizontal: 32,
            borderRadius: 20,
            backgroundColor: colors.bg,
            // var(--animal-shadow-sm, ...) → @shadow-sm
            boxShadow: '0 2px 4px 0 rgba(61, 52, 40, 0.06)',
        });

        // 时钟：44px / 900 / tabular-nums / letter-spacing 1 / line-height 1
        expect(getByText('09:30')).toHaveStyle({
            color: colors.text,
            fontWeight: '900',
            fontSize: 44,
            fontVariant: ['tabular-nums'],
            letterSpacing: 1,
            lineHeight: 44,
        });

        // 日期胶囊：主色底、12px、700、textSecondary
        const date = child(getByTestId('t').children[1]);
        expect(date).toHaveStyle({
            alignSelf: 'flex-start',
            flexDirection: 'row',
            gap: spacing.xs,
            paddingVertical: 4,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: colors.primaryBg,
        });

        // 三个 span 的样式（CSS 里由 .date 继承下去，RN 里各自显式声明）
        expect(getByText('Monday')).toHaveStyle({
            fontSize: fontSize.sm,
            fontWeight: '800',
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 1,
        });
        expect(getByText('Jun 8')).toHaveStyle({
            fontSize: fontSize.sm,
            fontWeight: '700',
            color: colors.textSecondary,
            fontVariant: ['tabular-nums'],
        });
        // dot 带 aria-hidden，RNTL 默认把它排除在查询外
        expect(getByText('·', HIDDEN)).toHaveStyle({ color: colors.textDisabled });
    });

    it('结构：根节点 = [时钟, 日期胶囊]，日期胶囊 = [星期, 点, 月日]', async () => {
        const { getByTestId } = await render(<Time testID="t" />);
        const root = getByTestId('t');
        expect(root.children).toHaveLength(2);
        expect(child(root.children[0]).type).toBe('Text');
        expect(child(root.children[1]).type).toBe('View');
        expect(child(root.children[1]).children).toHaveLength(3);
    });

    it('装饰性「·」对无障碍隐藏（aria-hidden）', async () => {
        const { queryByText, getByText } = await render(<Time />);
        // 默认查询（不含 includeHiddenElements）取不到它
        expect(queryByText('·')).toBeNull();
        expect(getByText('·', HIDDEN).props['aria-hidden']).toBe(true);
    });
});
