import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { CountUp, type CountUpRenderState, type CountUpEasing } from './CountUp';
import { ThemeProvider } from '../../theme/ThemeProvider';

let frames: Map<number, (timestamp: number) => void>;
let sequence: number;
beforeEach(() => {
    jest.useFakeTimers();
    frames = new Map();
    sequence = 0;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.set(++sequence, callback);
        return sequence;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((key) => {
        if (key != null) frames.delete(key);
    });
});
afterEach(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
    jest.useRealTimers();
});
const advance = async (time: number) => {
    await act(() => {
        const pending = [...frames];
        for (const [key, callback] of pending) {
            frames.delete(key);
            callback(time);
        }
    });
};
const label = (view: Awaited<ReturnType<typeof render>>) => view.getByTestId('count').props.accessibilityLabel;
const count = (props: React.ComponentProps<typeof CountUp>) => <CountUp {...props} testID="count" />;

it('stays at the start and announces it before counting', async () => {
    const view = await render(count({ start: 10, end: 100 }));
    expect(label(view)).toBe('10');
    expect(frames.size).toBe(0);
});
it('counts through the actual owned frame clock then announces the final value', async () => {
    const update = jest.fn(),
        complete = jest.fn();
    const view = await render(
        count({
            start: 0,
            end: 100,
            duration: 1,
            isCounting: true,
            easing: 'linear',
            onUpdate: update,
            onComplete: complete,
        })
    );
    expect(label(view)).toBe('');
    await advance(0);
    await advance(500);
    expect(update).toHaveBeenLastCalledWith(50);
    expect(label(view)).toBe('');
    await advance(1000);
    expect(label(view)).toBe('100');
    expect(complete).toHaveBeenCalledWith(1);
    expect(frames.size).toBe(0);
});
it('duration zero commits without requiring a frame', async () => {
    const complete = jest.fn(),
        update = jest.fn();
    const view = await render(
        count({ end: 10, duration: 0, isCounting: true, onComplete: complete, onUpdate: update })
    );
    expect(label(view)).toBe('10');
    expect(complete).toHaveBeenCalledWith(0);
    expect(update).toHaveBeenCalledWith(10);
    expect(frames.size).toBe(0);
});
it('reduced motion resolves the value once without celebration or automatic replay', async () => {
    const complete = jest.fn(() => ({ shouldRepeat: true }));
    const view = await render(
        <ThemeProvider reducedMotion>
            {count({ end: 20, isCounting: true, celebrate: { text: 'Done' }, onComplete: complete })}
        </ThemeProvider>
    );
    expect(label(view)).toBe('20');
    expect(frames.size).toBe(0);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('count-celebration')).toBeNull();
});
it('formats grouping, decimal separator and affixes', async () => {
    const view = await render(
        count({
            start: 1234.5,
            end: 1234.5,
            decimalPlaces: 2,
            decimalSeparator: ',',
            thousandsSeparator: '.',
            prefix: '$',
            suffix: ' points',
        })
    );
    expect(label(view)).toBe('1.234,50');
    expect(view.getByText('$', { includeHiddenElements: true })).toBeTruthy();
});
it('infers decimal places from start and end', async () => {
    const view = await render(count({ start: 1.2, end: 3.45 }));
    expect(label(view)).toBe('1.20');
});
it('infers scientific-notation precision and groups large finite numbers without exponent text', async () => {
    const view = await render(count({ start: 0, end: 1.2e-7 }));
    expect(label(view)).toBe('0.00000000');
    await view.rerender(count({ start: 1e21, end: 1e21, decimalPlaces: 2, thousandsSeparator: ',' }));
    expect(label(view)).toBe('1,000,000,000,000,000,000,000.00');
});
it.each([-5, 101, 1.9, NaN, Infinity])('normalizes decimalPlaces=%s without a RangeError', async (decimalPlaces) => {
    const view = await render(count({ start: 1.5, end: 2.5, decimalPlaces }));
    expect(label(view)).not.toContain('undefined');
});
it.each([
    { start: Infinity, end: 10 },
    { start: 0, end: NaN },
    { start: 0, end: 10, duration: Infinity },
])('does not schedule an unbounded frame loop for non-finite input %j', async (props) => {
    const complete = jest.fn();
    await render(count({ ...props, isCounting: true, onComplete: complete }));
    expect(frames.size).toBe(0);
    expect(complete).not.toHaveBeenCalled();
});
it('allows an arbitrary native formatter while retaining a numeric announcement', async () => {
    const view = await render(count({ start: 12, end: 20, formatter: (value) => <Text>{'Score ' + value}</Text> }));
    expect(view.getByText('Score 12', { includeHiddenElements: true })).toBeTruthy();
    expect(label(view)).toBe('12');
});
it('pauses and resumes without resetting the elapsed value', async () => {
    const props = { end: 100, duration: 1, easing: 'linear' as const, isCounting: true };
    const view = await render(count(props));
    await advance(0);
    await advance(400);
    await view.rerender(count({ ...props, isCounting: false }));
    expect(label(view)).toBe('40');
    expect(frames.size).toBe(0);
    await view.rerender(count(props));
    await advance(9000);
    await advance(9600);
    expect(label(view)).toBe('100');
});
it('reset(newStartAt) uses the new start for every frame, not just the first displayed value', async () => {
    let state: CountUpRenderState = { value: 0, reset: () => undefined };
    const update = jest.fn();
    const view = await render(
        count({
            start: 0,
            end: 100,
            duration: 1,
            easing: 'linear',
            isCounting: true,
            onUpdate: update,
            children: (next) => {
                state = next;
                return String(next.value);
            },
        })
    );
    await advance(0);
    await advance(1000);
    await act(() => state.reset(50));
    await advance(2000);
    await advance(2500);
    expect(update).toHaveBeenLastCalledWith(75);
    await advance(3000);
    expect(label(view)).toBe('100');
});
it('restarts when the end prop changes', async () => {
    const view = await render(count({ end: 10, isCounting: true, duration: 1 }));
    await advance(0);
    await advance(1000);
    await view.rerender(count({ end: 20, isCounting: true, duration: 1 }));
    await advance(2000);
    await advance(3000);
    expect(label(view)).toBe('20');
});
it('replays only after the requested delay and uses newStartAt', async () => {
    const complete = jest.fn().mockReturnValueOnce({ shouldRepeat: true, delay: 1, newStartAt: 50 });
    const update = jest.fn();
    const view = await render(
        count({ end: 100, duration: 1, isCounting: true, easing: 'linear', onComplete: complete, onUpdate: update })
    );
    await advance(0);
    await advance(1000);
    expect(frames.size).toBe(0);
    await act(() => jest.advanceTimersByTime(1000));
    await advance(2000);
    await advance(2500);
    expect(update).toHaveBeenLastCalledWith(75);
    await advance(3000);
    expect(label(view)).toBe('100');
    expect(complete).toHaveBeenCalledTimes(2);
});
it('cancels an admitted repeat when paused', async () => {
    const complete = jest.fn(() => ({ shouldRepeat: true, delay: 1 }));
    const view = await render(count({ end: 10, duration: 0, isCounting: true, onComplete: complete }));
    await view.rerender(count({ end: 10, duration: 0, isCounting: false, onComplete: complete }));
    await act(() => jest.advanceTimersByTime(1000));
    expect(complete).toHaveBeenCalledTimes(1);
});
it('quantizes updates by updateInterval while keeping the final completion exact', async () => {
    const update = jest.fn();
    const view = await render(
        count({ end: 100, duration: 1, updateInterval: 0.25, easing: 'linear', isCounting: true, onUpdate: update })
    );
    await advance(0);
    await advance(300);
    expect(update).toHaveBeenLastCalledWith(25);
    await advance(1000);
    expect(label(view)).toBe('100');
});
it('unmount cleans frames and repeat timers without a late completion', async () => {
    const complete = jest.fn();
    const view = await render(count({ end: 100, duration: 1, isCounting: true, onComplete: complete }));
    await advance(0);
    await view.unmount();
    await advance(1000);
    expect(complete).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
});
it('shows and naturally removes optional celebration text', async () => {
    const view = await render(count({ end: 10, duration: 0, isCounting: true, celebrate: { text: 'Done' } }));
    const hidden = { includeHiddenElements: true } as const;
    expect(view.getByTestId('count-celebration', hidden)).toBeTruthy();
    expect(view.getByTestId('count-celebration-ring-0', hidden)).toBeTruthy();
    expect(view.getByTestId('count-celebration-ring-1', hidden)).toBeTruthy();
    for (let index = 0; index < 4; index++)
        expect(view.getByTestId('count-celebration-sparkle-' + index, hidden)).toBeTruthy();
    expect(view.queryByText('Done')).toBeNull();
    expect(view.getByText('Done', hidden)).toBeTruthy();
    await act(() => jest.advanceTimersByTime(900));
    expect(view.queryByTestId('count-celebration', hidden)).toBeNull();
});
it.each(['linear', 'easeInCubic', 'easeOutCubic', 'easeInOutCubic', 'easeOutExpo', 'unknown'] as const)(
    'completes easing %s',
    async (easing) => {
        const view = await render(count({ end: 10, isCounting: true, duration: 1, easing: easing as CountUpEasing }));
        await advance(0);
        await advance(1000);
        expect(label(view)).toBe('10');
    }
);
it('keeps native style and bordered island skin', async () => {
    const view = await render(count({ end: 10, variant: 'island', bordered: true, style: { opacity: 0.8 } }));
    expect(view.getByTestId('count')).toHaveStyle({ borderWidth: 2, opacity: 0.8 });
});
