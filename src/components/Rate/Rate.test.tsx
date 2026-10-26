import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Rate } from './Rate';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { attachRateKeyboard } from './rateWeb';

it('renders five individually accessible native radios', async () => {
    const view = await render(<Rate />);
    expect(view.getAllByRole('radio')).toHaveLength(5);
    expect(view.getByRole('radio', { name: '1 stars' }).props.tabIndex).toBe(0);
});
it.each([
    [9, 5],
    [-1, 0],
    [3.6, 4],
    [NaN, 0],
] as const)('clamps rating %s to %s while keeping one tab stop', async (value, expected) => {
    const view = await render(<Rate value={value} />);
    const radios = view.getAllByRole('radio');
    expect(radios.filter((radio) => radio.props.accessibilityState.checked)).toHaveLength(expected ? 1 : 0);
    expect(radios.filter((radio) => radio.props.tabIndex === 0)).toHaveLength(1);
    if (expected)
        expect(view.getByRole('radio', { name: expected + ' stars' }).props.accessibilityState.checked).toBe(true);
});
it('resizes the count without retaining an unreachable selected radio', async () => {
    const view = await render(<Rate value={5} count={5} />);
    await view.rerender(<Rate value={5} count={3} />);
    expect(view.getAllByRole('radio')).toHaveLength(3);
    expect(view.getByRole('radio', { name: '3 stars' }).props.tabIndex).toBe(0);
});
it('commits an uncontrolled rating and supports clear', async () => {
    const change = jest.fn();
    const view = await render(
        <ThemeProvider reducedMotion>
            <Rate onChange={change} />
        </ThemeProvider>
    );
    await fireEvent.press(view.getByRole('radio', { name: '3 stars' }));
    expect(change).toHaveBeenLastCalledWith(3);
    expect(view.getByRole('radio', { name: '3 stars' }).props.accessibilityState.checked).toBe(true);
    await fireEvent.press(view.getByRole('radio', { name: '3 stars' }));
    expect(change).toHaveBeenLastCalledWith(0);
});
it('allowClear=false never emits an unchanged value', async () => {
    const change = jest.fn();
    const view = await render(<Rate defaultValue={3} allowClear={false} onChange={change} />);
    await fireEvent.press(view.getByRole('radio', { name: '3 stars' }));
    expect(change).not.toHaveBeenCalled();
});
it('does not change a controlled rating without parent writeback', async () => {
    const change = jest.fn();
    const view = await render(<Rate value={1} onChange={change} />);
    await fireEvent.press(view.getByRole('radio', { name: '4 stars' }));
    expect(change).toHaveBeenLastCalledWith(4);
    expect(view.getByRole('radio', { name: '1 stars' }).props.accessibilityState.checked).toBe(true);
});
it('accepts actual controlled parent writeback', async () => {
    function Owner() {
        const [value, setValue] = useState(1);
        return <Rate value={value} onChange={setValue} />;
    }
    const view = await render(
        <ThemeProvider reducedMotion>
            <Owner />
        </ThemeProvider>
    );
    await fireEvent.press(view.getByRole('radio', { name: '4 stars' }));
    expect(view.getByRole('radio', { name: '4 stars' }).props.accessibilityState.checked).toBe(true);
});
it('read-only ratings announce their value without interactive radios', async () => {
    const view = await render(<Rate readonly value={3} accessibilityLabel="Score" />);
    expect(view.queryAllByRole('radio')).toHaveLength(0);
    expect(view.getByRole('image', { name: 'Score' }).props.accessibilityValue).toEqual({
        min: 0,
        max: 5,
        now: 3,
        text: '3 / 5',
    });
});
it.each(['small', 'middle', 'large'] as const)('keeps %s interactive hit targets at least 44 units', async (size) => {
    const view = await render(<Rate size={size} />);
    expect(view.getByRole('radio', { name: '1 stars' })).toHaveStyle({ minWidth: 44, minHeight: 44 });
});
it('uses host focus colors and forwards consumer style', async () => {
    const view = await render(
        <ThemeProvider accent="#996633" reducedMotion>
            <Rate testID="rate" style={{ opacity: 0.8 }} />
        </ThemeProvider>
    );
    await fireEvent(view.getByRole('radio', { name: '2 stars' }), 'focus');
    expect(view.getByRole('radio', { name: '2 stars' })).toHaveStyle({ borderColor: '#996633' });
    expect(view.getByTestId('rate')).toHaveStyle({ opacity: 0.8 });
});
for (const [key, value, result] of [
    ['ArrowRight', 0, 1],
    ['ArrowUp', 2, 3],
    ['ArrowLeft', 3, 2],
    ['ArrowDown', 0, 1],
    ['Home', 3, 1],
    ['End', 3, 5],
] as const) {
    it('retains bounded Web keyboard semantics: ' + key + ' from ' + value, () => {
        let listener: (event: any) => void = () => undefined;
        const stars = Array.from({ length: 5 }, () => ({ focus: jest.fn() }));
        const root = {
            querySelectorAll: () => stars,
            addEventListener: jest.fn((_type, cb) => {
                listener = cb;
            }),
            removeEventListener: jest.fn(),
        };
        const change = jest.fn();
        const cleanup = attachRateKeyboard(root, value, 5, change);
        const event = { key, target: stars[0], preventDefault: jest.fn() };
        listener(event);
        expect(change).toHaveBeenCalledWith(result);
        expect(stars[result - 1].focus).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        cleanup?.();
        expect(root.removeEventListener).toHaveBeenCalled();
    });
}
it.each([
    ['ArrowRight', 5],
    ['ArrowLeft', 1],
] as const)('never wraps or clears at the %s boundary', (key, value) => {
    let listener: (event: any) => void = () => undefined;
    const stars = Array.from({ length: 5 }, () => ({ focus: jest.fn() }));
    const change = jest.fn();
    attachRateKeyboard(
        {
            querySelectorAll: () => stars,
            addEventListener: (_type: string, cb: typeof listener) => {
                listener = cb;
            },
        },
        value,
        5,
        change
    );
    listener({ key, target: stars[0], preventDefault: jest.fn() });
    expect(change).not.toHaveBeenCalled();
});
it('does not consume nested-control or composing keyboard events', () => {
    let listener: (event: any) => void = () => undefined;
    const star = { focus: jest.fn() };
    const change = jest.fn();
    attachRateKeyboard(
        {
            querySelectorAll: () => [star],
            addEventListener: (_type: string, cb: typeof listener) => {
                listener = cb;
            },
        },
        0,
        1,
        change
    );
    for (const extra of [
        { target: {} },
        { target: star, isComposing: true },
        { target: star, ctrlKey: true },
        { target: star, defaultPrevented: true },
    ]) {
        const preventDefault = jest.fn();
        listener({ key: 'ArrowRight', preventDefault, ...extra });
        expect(preventDefault).not.toHaveBeenCalled();
    }
    expect(change).not.toHaveBeenCalled();
});
