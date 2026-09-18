import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { TestInstance } from 'test-renderer';
import { Countdown } from './Countdown';
import { SIZE_SPEC, faceHeight, rollTranslateY } from './format';

/**
 * RN 版测试，对应 Web 版 `Countdown.test.tsx` 的 8 个用例。
 *
 * **被丢弃 / 改写的 Web 用例**：
 *   - `className="custom"` 透传 —— RN 无 className，改为断言 `style` / `testID`。
 *   - `{...rest}` 的任意 DOM 属性透传（`React.HTMLAttributes<HTMLDivElement>`）——
 *     RN 没有「任意属性透传」，只保留有对应物的 `id`（→ `nativeID`）与 `aria-*`。
 *     与 `Time.tsx` 同一处理。
 *   - `toHaveClass(styles.bordered)` —— 改为断言数字块（`.unit`）的 `borderWidth` /
 *     `borderColor`，那是 class 实际作用到的元素。
 *   - `container.querySelectorAll('.digitStrip')` —— RN 无类名，改用 testID
 *     （`<testID>-digit-<partIndex>-<digitIndex>`）定位，再读内层 `Animated.View` 的
 *     `translateY`。断言的是**像素**而不是 Web 的百分比（`5%` = 一面高）。
 *
 * **本文件覆盖不到的部分**（算术已抽到 `format.ts`，由 `format.test.ts` 兜住）：
 *   数字条的动画中间帧。`Animated` 在测试渲染器里不产生视觉帧，这里靠
 *   `act(advanceTimersByTime)` 把 JS 驱动的动画推到终点后读 `__getValue()`。
 *
 * ⚠️ 本文件用**假定时器**：组件用 `setInterval(250ms)` 轮询剩余时间，
 * 数字条是 JS 驱动的 `Animated`（`useNativeDriver: false`），逐帧都会触发更新。
 * 用真实定时器的话这些更新会落到 `act()` 之外，Jest 会刷一屏
 * 「Animated(View) ... was not wrapped in act(...)」（同 Collapse.test.tsx）。
 */
const child = (node: unknown) => node as TestInstance;

/** 数字条整块带 `aria-hidden`，RNTL 默认排除，查它们要显式带上 */
const HIDDEN = { includeHiddenElements: true } as const;

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

/** 读 Animated 插值当前的数值（`__getValue` 是 Animated 的内部求值方法） */
const animatedNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number') return value;
    const v = value as { __getValue?: () => number } | null;
    return typeof v?.__getValue === 'function' ? v.__getValue() : undefined;
};

/** 读某个数字位当前滚到哪：`digitCell` → 内层 `Animated.View` 的 translateY（px） */
const translateYOf = (cell: TestInstance): number | undefined => {
    const strip = child(cell.children[0]);
    const transform = styleOf(strip).transform as { translateY: unknown }[];
    return animatedNumber(transform[0].translateY);
};

/** 把 JS 驱动的动画推到底（`ROLL_DURATION_MS = 350`） */
const settleAnimation = (ms = 400) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

const advance = (ms: number) =>
    act(async () => {
        jest.advanceTimersByTime(ms);
    });

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-19T00:00:00Z'));
});

afterEach(() => {
    jest.useRealTimers();
});

describe('Countdown', () => {
    it('按指定格式渲染剩余时间', async () => {
        const { getByText } = await render(<Countdown value={Date.now() + 65_000} format="HH:mm:ss" />);
        // 滚动数字条对可读性断言不可用（20 面数字条里每个数字都有），
        // 读屏文本承载完整格式化值 —— 与 Web 版的断言口径一致
        expect(getByText('00:01:05')).toBeTruthy();
    });

    it('每秒更新并在归零时触发回调', async () => {
        const onChange = jest.fn();
        const onFinish = jest.fn();
        const { getByText } = await render(
            <Countdown value={Date.now() + 2_000} onChange={onChange} onFinish={onFinish} />
        );

        await advance(1_000);
        expect(getByText('00:00:01')).toBeTruthy();
        await advance(1_000);
        expect(getByText('00:00:00')).toBeTruthy();
        expect(onChange).toHaveBeenLastCalledWith(0);
        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('支持 Date、天数格式和前缀', async () => {
        const { getByText } = await render(
            <Countdown
                value={new Date(Date.now() + (24 * 60 * 60 + 2 * 60 * 60 + 3 * 60 + 4) * 1_000)}
                format="DD 天 HH:mm:ss"
                prefix="活动结束还有"
            />
        );
        expect(getByText('活动结束还有')).toBeTruthy();
        expect(getByText('01 天 02:03:04')).toBeTruthy();
    });

    it('过期时间稳定显示零且只完成一次', async () => {
        const onFinish = jest.fn();
        const { getByText, rerender } = await render(<Countdown value={Date.now() - 1_000} onFinish={onFinish} />);
        expect(getByText('00:00:00')).toBeTruthy();
        expect(onFinish).toHaveBeenCalledTimes(1);

        // value 未变（假定时器下 Date.now() 不变）→ 轮询已经停掉，重渲染不会再次触发
        await rerender(<Countdown value={Date.now() - 1_000} onFinish={() => onFinish()} />);
        await advance(2_000);
        expect(onFinish).toHaveBeenCalledTimes(1);
    });

    it('数字条通过 translateY 滚动到当前数字', async () => {
        const { getAllByTestId } = await render(<Countdown testID="t" value={Date.now() + 65_000} format="HH:mm:ss" />);
        const cells = getAllByTestId(/^t-digit-/, HIDDEN);
        expect(cells).toHaveLength(6);

        // '00:01:05' → 初始 pos = 数字本身（20 面数字条，每面 faceHeight(26) = 31.2px）
        const h = faceHeight(SIZE_SPEC.middle.digitFontSize);
        const expected = [0, 0, 0, 1, 0, 5].map((pos) => rollTranslateY(pos, SIZE_SPEC.middle.digitFontSize));
        cells.forEach((cell, i) => {
            expect(translateYOf(cell)).toBeCloseTo(expected[i]);
        });
        expect(h).toBeCloseTo(31.2);

        // 每个数字条包含 0-9 两轮共 20 个数字面
        expect(child(cells[0].children[0]).children).toHaveLength(20);
    });

    it('秒位 0→9 回绕时单向向下滚动', async () => {
        // 60s 剩余显示 '01:00'，1 秒后 '00:59'：秒个位 0→9 回绕
        const { getAllByTestId, getByText } = await render(
            <Countdown testID="t" value={Date.now() + 60_000} format="mm:ss" />
        );
        await advance(1_000);
        expect(getByText('00:59')).toBeTruthy();
        await settleAnimation();

        const cells = getAllByTestId(/^t-digit-/, HIDDEN);
        // 位序：mm 十位 / mm 个位 / ss 十位 / ss 个位 → 初始 '01:00' = [0, 0, 0, 0]
        // 1 秒后 '00:59' = [0, 0, 5, 9]
        // 秒个位 0→9：回绕后落在下一循环（pos 9），而非反向跳回第一循环
        expect(translateYOf(cells[3])).toBeCloseTo(rollTranslateY(9, SIZE_SPEC.middle.digitFontSize));
        expect(rollTranslateY(9, SIZE_SPEC.middle.digitFontSize)).toBeCloseTo(-280.8);
        // 秒十位 0→5：正常向下滚 5 步
        expect(translateYOf(cells[2])).toBeCloseTo(rollTranslateY(5, SIZE_SPEC.middle.digitFontSize));
        // 分个位 1→0：退 1 步
        expect(translateYOf(cells[1])).toBeCloseTo(0);
    });

    it('应用尺寸与风格（替代 Web 版的 class 断言）', async () => {
        const { getByTestId, getByRole } = await render(
            <Countdown
                testID="t"
                value={Date.now() + 1_000}
                size="large"
                variant="island"
                style={{ marginTop: 4 }}
                aria-label="出发倒计时"
            />
        );
        const root = getByTestId('t');
        // .large { min-height: 56px } / .island { padding: 13px 20px; background: rgb(247,243,223);
        //          border: 2px dashed #d4c4a8 } / .countdown { border-radius: 20px; gap: 8px }
        expect(root).toHaveStyle({
            minHeight: SIZE_SPEC.large.minHeight,
            paddingVertical: 13,
            paddingHorizontal: 20,
            backgroundColor: 'rgb(247, 243, 223)',
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#d4c4a8',
            borderRadius: 20,
            gap: 8,
            marginTop: 4,
        });
        // role="timer" 之外还必须显式 accessible，否则 RNTL 的 isAccessibilityElement 为 false
        expect(getByRole('timer', { name: '出发倒计时' })).toBeTruthy();
    });

    it('bordered 默认无边框，开启后应用边框', async () => {
        const { getByTestId, rerender } = await render(<Countdown testID="t" value={Date.now() + 1_000} />);
        // 第一个 unit（`.bordered .unit` 是边框真正落到的地方）
        const unit = () => child(getByTestId('t-digits', HIDDEN).children[0]);
        expect(styleOf(unit()).borderWidth).toBeUndefined();

        await rerender(<Countdown testID="t" value={Date.now() + 1_000} bordered />);
        expect(styleOf(unit()).borderWidth).toBe(1.5);
        expect(styleOf(unit()).borderColor).toBe('#d4c9b4');
    });

    it('default 与 island 的数字块底色不同（替代 .island .unit 的 class 断言）', async () => {
        const { getByTestId, rerender } = await render(<Countdown testID="t" value={Date.now() + 1_000} />);
        const unit = () => child(getByTestId('t-digits', HIDDEN).children[0]);
        // ⚠️ 上游是 linear-gradient(180deg, #fff 0%, #f8f8f0 100%)，RN 用起始色标做纯色（见组件注释）
        expect(styleOf(unit()).backgroundColor).toBe('#fff');

        await rerender(<Countdown testID="t" value={Date.now() + 1_000} variant="island" bordered />);
        expect(styleOf(unit()).backgroundColor).toBe('#fffdf4');
        // .bordered.island .unit { border-color: #d4c4a8 }
        expect(styleOf(unit()).borderColor).toBe('#d4c4a8');
    });

    // ---------- RN 专有 ----------

    it('卸载时清除定时器', async () => {
        // ⚠️ 不能断言 `jest.getTimerCount()`：RN 测试环境里定时器计数基线不是 0
        //（React 调度器与 RNTL 自身也占定时器，见 Time.test.tsx 的实测）。
        // 改为直接断言「组件创建的那个 interval 在卸载时被清掉了」。
        const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
        const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');

        const { unmount } = await render(<Countdown value={Date.now() + 60_000} />);
        const calls = setIntervalSpy.mock.calls as unknown as [unknown, number | undefined][];
        const ourCall = calls.findIndex(([, delay]) => delay === 250);
        expect(ourCall).toBeGreaterThanOrEqual(0);
        const timer = setIntervalSpy.mock.results[ourCall].value;

        await unmount();
        expect(clearIntervalSpy).toHaveBeenCalledWith(timer);

        setIntervalSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });

    it('卸载后不再轮询（定时器真的停了）', async () => {
        const onChange = jest.fn();
        const { unmount } = await render(<Countdown value={Date.now() + 60_000} onChange={onChange} />);
        await advance(500);
        const callsBeforeUnmount = onChange.mock.calls.length;

        await unmount();
        await advance(2_000);
        expect(onChange.mock.calls.length).toBe(callsBeforeUnmount);
    });

    it('归零后停掉轮询：onChange 不再被调用', async () => {
        const onChange = jest.fn();
        const { getByText } = await render(<Countdown value={Date.now() + 1_000} onChange={onChange} />);
        await advance(1_000);
        expect(getByText('00:00:00')).toBeTruthy();

        const callsAtZero = onChange.mock.calls.length;
        await advance(5_000);
        expect(onChange.mock.calls.length).toBe(callsAtZero);
        expect(onChange).toHaveBeenLastCalledWith(0);
    });

    it('数字条整块对无障碍隐藏，可读文本留在无障碍树里', async () => {
        const { getByText, getByTestId, queryByText } = await render(
            <Countdown testID="t" value={Date.now() + 65_000} format="HH:mm:ss" />
        );
        // 数字块带 aria-hidden → 默认查询查不到（反证 aria-hidden 生效）
        expect(() => getByTestId('t-digits')).toThrow();
        expect(getByTestId('t-digits', HIDDEN).props['aria-hidden']).toBe(true);

        // 可读文本不在任何 aria-hidden 之下 → 默认就能查到
        // （`.srOnly` 用 opacity: 0 视觉隐藏；RNTL 明确不把 opacity: 0 视为不可访问）
        expect(getByText('00:01:05')).toBeTruthy();
        expect(queryByText('00:01:05')).not.toBeNull();
        expect(getByTestId('t-readable').props.children).toBe('00:01:05');
    });

    it('根节点带 role="timer" / aria-live="off" / accessible', async () => {
        const { getByTestId } = await render(<Countdown testID="t" value={Date.now() + 1_000} />);
        const root = getByTestId('t');
        // ⚠️ jest preset 把 `View` 整体 mock 掉了（props 原样透传），所以这里看到的是
        // **原始** aria-* 名；真机上 RN 的 View.js 会改写（aria-live → accessibilityLiveRegion、
        // aria-label → accessibilityLabel）。也就是说这几条只能证明「prop 被透传」。
        expect(root.props.role).toBe('timer');
        expect(root.props['aria-live']).toBe('off');
        expect(root.props.accessible).toBe(true);
    });

    it('prefix 为任意节点时原样渲染', async () => {
        const { getByTestId } = await render(
            <Countdown
                testID="t"
                value={Date.now() + 1_000}
                prefix={<Countdown testID="inner" value={Date.now() + 5_000} />}
            />
        );
        expect(getByTestId('inner')).toBeTruthy();
    });
});
