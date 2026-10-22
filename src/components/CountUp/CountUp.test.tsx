import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountUp } from './CountUp';
import type { CountUpEasing, CountUpEasingName, CountUpRenderState } from './CountUp';
import styles from './count-up.module.less';

describe('CountUp', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    /** 推进假时钟（rAF 与 setTimeout 都受它驱动） */
    const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

    const numberText = (container: HTMLElement) => container.querySelector(`.${styles.number}`)?.textContent;
    const readableText = (container: HTMLElement) => container.querySelector(`.${styles.srOnly}`)?.textContent;

    it('未开始计数时展示起始值，并把它播报给读屏', () => {
        const { container } = render(<CountUp end={1320} start={100} />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(numberText(container)).toBe('100');
        expect(readableText(container)).toBe('100');
    });

    it('按 duration 从 start 计数到 end，计数中不打扰读屏', () => {
        const { container } = render(<CountUp isCounting end={1000} duration={1} />);
        expect(readableText(container)).toBe('');

        advance(500);
        const midway = Number(numberText(container));
        expect(midway).toBeGreaterThan(0);
        expect(midway).toBeLessThan(1000);

        advance(700);
        expect(numberText(container)).toBe('1000');
        expect(readableText(container)).toBe('1000');
    });

    it('结束时触发 onComplete 与 onUpdate', () => {
        const onComplete = vi.fn();
        const onUpdate = vi.fn();
        render(<CountUp isCounting end={100} duration={1} onComplete={onComplete} onUpdate={onUpdate} />);

        advance(1_200);
        expect(onComplete).toHaveBeenCalledTimes(1);
        // 回调参数是累计动画时长（秒）
        expect(onComplete.mock.calls[0][0]).toBeGreaterThanOrEqual(1);
        expect(onUpdate).toHaveBeenLastCalledWith(100);
    });

    it('duration=0 直接显示目标值', () => {
        const { container } = render(<CountUp isCounting end={86} duration={0} />);
        expect(numberText(container)).toBe('86');
        expect(readableText(container)).toBe('86');
    });

    it('支持千分位、小数位、小数点与前后缀', () => {
        const { container } = render(
            <CountUp
                isCounting
                end={1320.5}
                decimalPlaces={1}
                thousandsSeparator=","
                suffix="分"
                prefix="¥"
                duration={0}
            />
        );
        expect(numberText(container)).toBe('1,320.5');
        expect(readableText(container)).toBe('1,320.5');
        expect(screen.getByText('分')).toBeInTheDocument();
        expect(screen.getByText('¥')).toBeInTheDocument();
    });

    it('小数位默认取 start / end 中较大的小数位数', () => {
        const { container } = render(<CountUp isCounting start={0.5} end={2.25} duration={0} />);
        expect(numberText(container)).toBe('2.25');
    });

    it('支持自定义小数点符号', () => {
        const { container } = render(
            <CountUp isCounting end={1.5} decimalPlaces={1} decimalSeparator="," duration={0} />
        );
        expect(numberText(container)).toBe('1,5');
    });

    it('formatter 优先级高于内置格式化', () => {
        const { container } = render(
            <CountUp
                isCounting
                end={100}
                duration={0}
                thousandsSeparator=","
                formatter={(value) => `${Math.round(value)} 分`}
            />
        );
        expect(numberText(container)).toBe('100 分');
        // 读屏文本始终使用默认数字格式，保证可读性
        expect(readableText(container)).toBe('100');
    });

    it('children 渲染函数接管渲染，并可 reset 重播', () => {
        let state: CountUpRenderState | null = null;
        const { container } = render(
            <CountUp isCounting end={10} duration={1}>
                {({ value, reset }) => {
                    state = { value, reset };
                    return `v${Math.round(value)}`;
                }}
            </CountUp>
        );
        advance(1_200);
        expect(numberText(container)).toBe('v10');

        act(() => state?.reset());
        expect(numberText(container)).toBe('v0');
        advance(1_200);
        expect(numberText(container)).toBe('v10');
    });

    it('reset(newStartAt) 从指定值重播', () => {
        let state: CountUpRenderState | null = null;
        const { container } = render(
            <CountUp isCounting start={0} end={100} duration={1}>
                {({ value, reset }) => {
                    state = { value, reset };
                    return String(Math.round(value));
                }}
            </CountUp>
        );
        advance(1_200);
        expect(numberText(container)).toBe('100');

        act(() => state?.reset(50));
        expect(numberText(container)).toBe('50');
    });

    it('内置缓动曲线都能走到目标值，自定义与未知曲线也不会中断', () => {
        const easings: CountUpEasingName[] = ['linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeOutExpo'];
        const custom = vi.fn((progress: number) => progress * progress);
        const samples: CountUpEasing[] = [...easings, custom, 'not-a-curve' as CountUpEasing];

        const { container } = render(
            <div>
                {samples.map((easing, index) => (
                    <CountUp key={index} isCounting end={100} duration={1} easing={easing} />
                ))}
            </div>
        );

        advance(1_200);
        const numbers = Array.from(container.querySelectorAll(`.${styles.number}`)).map((node) => node.textContent);
        expect(numbers).toHaveLength(samples.length);
        expect(numbers.every((text) => text === '100')).toBe(true);
        expect(custom).toHaveBeenCalled();
    });

    it('updateInterval 控制刷新频率', () => {
        const { container } = render(<CountUp isCounting end={100} duration={1} updateInterval={1} easing="linear" />);
        advance(500);
        // 间隔 1 秒：前半段仍显示起点
        expect(numberText(container)).toBe('0');
        advance(700);
        expect(numberText(container)).toBe('100');
    });

    it('isCounting 置为 false 暂停，再置为 true 从暂停处继续', () => {
        const { container, rerender } = render(<CountUp isCounting end={1000} duration={2} />);
        advance(500);
        const paused = Number(numberText(container));
        expect(paused).toBeGreaterThan(0);

        rerender(<CountUp isCounting={false} end={1000} duration={2} />);
        advance(1_000);
        expect(Number(numberText(container))).toBe(paused);

        rerender(<CountUp isCounting end={1000} duration={2} />);
        advance(500);
        expect(Number(numberText(container))).toBeGreaterThan(paused);
    });

    it('end 变化时自动重播', () => {
        const { container, rerender } = render(<CountUp isCounting end={100} duration={1} />);
        advance(1_200);
        expect(numberText(container)).toBe('100');

        rerender(<CountUp isCounting end={500} duration={1} />);
        expect(numberText(container)).toBe('0');
        advance(1_200);
        expect(numberText(container)).toBe('500');
    });

    it('onComplete 返回 shouldRepeat 时延迟重播', () => {
        const onComplete = vi.fn().mockReturnValue({ shouldRepeat: true, delay: 0.5 });
        const { container } = render(<CountUp isCounting end={100} duration={1} onComplete={onComplete} />);

        advance(1_200);
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(numberText(container)).toBe('100');

        advance(600);
        expect(numberText(container)).toBe('0');

        advance(1_200);
        expect(onComplete).toHaveBeenCalledTimes(2);
        expect(numberText(container)).toBe('100');
    });

    it('duration=0 排下的重播计时器会在依赖变化时被取消', () => {
        const onComplete = vi.fn().mockReturnValueOnce({ shouldRepeat: true, delay: 0.5 });
        const { rerender } = render(<CountUp isCounting end={10} duration={0} onComplete={onComplete} />);
        expect(onComplete).toHaveBeenCalledTimes(1);

        // duration 变化会重跑 effect：上一次（duration=0 分支）排的重播计时器必须一起被清掉
        rerender(<CountUp isCounting end={10} duration={0.3} onComplete={onComplete} />);
        advance(600); // duration=0.3 跑完（第 2 次回调）；旧计时器本该在 t=500 触发重播
        advance(1_200); // 再留足时间：旧计时器若残留，这一轮会跑到终点，多出第 3 次回调
        expect(onComplete).toHaveBeenCalledTimes(2);
    });

    it('环境不支持 requestAnimationFrame 时静态展示且不报错', () => {
        vi.stubGlobal('requestAnimationFrame', undefined);
        const { container } = render(<CountUp isCounting end={100} duration={1} />);
        advance(1_200);
        expect(numberText(container)).toBe('0');
    });

    it('默认不渲染庆祝动效', () => {
        render(<CountUp isCounting end={10} duration={1} />);
        advance(1_200);
        expect(screen.queryByText('完美！')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).not.toHaveClass(styles.celebrating);
    });

    it('celebrate 不传 text 时不渲染贴纸，动效结束后收起', () => {
        const { container } = render(<CountUp isCounting end={10} duration={1} celebrate />);
        advance(1_200);

        const root = screen.getByRole('status');
        expect(root).toHaveClass(styles.celebrating);
        // 没传 text 就没有贴纸
        expect(container.querySelector(`.${styles.badgeWrap}`)).toBeNull();
        // 装饰层对辅助技术隐藏
        expect(container.querySelector(`.${styles.effects}`)).toHaveAttribute('aria-hidden', 'true');

        advance(1_000);
        expect(root).not.toHaveClass(styles.celebrating);
    });

    it('celebrate.text 支持任意文案，并在动效结束后收起', () => {
        const { container } = render(<CountUp isCounting end={10} duration={1} celebrate={{ text: '完美！' }} />);
        advance(1_200);
        expect(screen.getByText('完美！')).toBeInTheDocument();

        advance(1_000);
        expect(container.querySelector(`.${styles.badgeWrap}`)).toBeNull();
    });

    it('应用尺寸、风格、边框与自定义属性', () => {
        render(
            <CountUp
                end={10}
                size="large"
                variant="island"
                bordered
                className="custom"
                aria-label="本局得分"
                data-testid="score"
            />
        );
        const root = screen.getByRole('status');
        expect(root).toHaveClass(styles.large, styles.island, styles.bordered, 'custom');
        expect(root).toHaveAttribute('data-testid', 'score');
        expect(root).toHaveAccessibleName('本局得分');
    });
});
