import React, { useState } from 'react';
import dayjs from 'dayjs';
import { Dimensions, Text, View, StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Calendar, type CalendarEvent } from './Calendar';
import { attachCalendarKeyboard } from './calendarWeb';
import { ThemeProvider } from '../../theme/ThemeProvider';

const date = (view: Awaited<ReturnType<typeof render>>, key: string) => view.getByTestId('calendar-day-' + key);
const screen = (props: React.ComponentProps<typeof Calendar> = {}) => (
    <Calendar defaultValue="2026-10-05" {...props} testID="calendar" />
);
it('renders six complete weeks and the actual selected month', async () => {
    const view = await render(screen());
    expect(view.getByText('2026-10')).toBeTruthy();
    expect(
        view.getAllByRole('button').filter((button) => button.props.nativeID?.startsWith('animal-calendar-'))
    ).toHaveLength(42);
    expect(date(view, '2026-09-27')).toBeTruthy();
    expect(date(view, '2026-11-07')).toBeTruthy();
    expect(date(view, '2026-10-05').props.accessibilityState.selected).toBe(true);
});
it('defaults to today without modifying a stored selection', async () => {
    const view = await render(<Calendar testID="calendar" />);
    expect(date(view, dayjs().format('YYYY-MM-DD')).props.accessibilityState.selected).toBe(true);
});
it('commits an uncontrolled date only after an explicit press', async () => {
    const change = jest.fn();
    const view = await render(screen({ onChange: change }));
    expect(change).not.toHaveBeenCalled();
    await fireEvent.press(date(view, '2026-10-06'));
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith('2026-10-06');
    expect(date(view, '2026-10-06').props.accessibilityState.selected).toBe(true);
});
it('does not mutate a controlled value without writeback', async () => {
    const change = jest.fn();
    const view = await render(screen({ value: '2026-10-05', onChange: change }));
    await fireEvent.press(date(view, '2026-10-06'));
    expect(change).toHaveBeenCalledWith('2026-10-06');
    expect(date(view, '2026-10-05').props.accessibilityState.selected).toBe(true);
});
it('supports the real controlled parent selection', async () => {
    function Owner() {
        const [value, setValue] = useState('2026-10-05');
        return <Calendar value={value} onChange={setValue} testID="calendar" />;
    }
    const view = await render(<Owner />);
    await fireEvent.press(date(view, '2026-10-06'));
    expect(date(view, '2026-10-06').props.accessibilityState.selected).toBe(true);
});
it.each([
    ['Next month', '2026-11'],
    ['Previous month', '2026-09'],
    ['Next year', '2027-10'],
    ['Previous year', '2025-10'],
] as const)('navigates %s without committing a date', async (button, expected) => {
    const change = jest.fn(),
        panel = jest.fn();
    const view = await render(screen({ onChange: change, onPanelChange: panel }));
    await fireEvent.press(view.getByRole('button', { name: button }));
    expect(view.getByText(expected)).toBeTruthy();
    expect(panel).toHaveBeenCalledWith(expected);
    expect(change).not.toHaveBeenCalled();
});
it('keeps a controlled panel on its current month until the owner writes back', async () => {
    const panel = jest.fn();
    const view = await render(screen({ panelValue: '2026-10', onPanelChange: panel }));
    await fireEvent.press(view.getByRole('button', { name: 'Next month' }));
    expect(panel).toHaveBeenCalledWith('2026-11');
    expect(view.getByText('2026-10')).toBeTruthy();
    expect(
        view.getAllByRole('button').filter((button) => button.props.nativeID && button.props.tabIndex === 0)
    ).toHaveLength(1);
});
it('clamps both selected and focus state when controlled value is outside the panel', async () => {
    const view = await render(screen({ value: '2030-12-31', panelValue: '2026-10' }));
    expect(date(view, '2026-11-07').props.accessibilityState.selected).toBe(true);
    expect(date(view, '2026-11-07').props.tabIndex).toBe(0);
});
it('selecting a neighboring-month cell requests the panel change', async () => {
    const panel = jest.fn();
    const view = await render(screen({ onPanelChange: panel }));
    await fireEvent.press(date(view, '2026-11-01'));
    expect(panel).toHaveBeenCalledWith('2026-11');
    expect(view.getByText('2026-11')).toBeTruthy();
    expect(date(view, '2026-11-01').props.accessibilityState.selected).toBe(true);
});
it('Today requests rather than overriding a controlled panel', async () => {
    const change = jest.fn(),
        panel = jest.fn();
    const view = await render(screen({ panelValue: '2000-01', onChange: change, onPanelChange: panel }));
    await fireEvent.press(view.getByRole('button', { name: 'Today' }));
    expect(change).toHaveBeenCalledWith(dayjs().format('YYYY-MM-DD'));
    expect(view.getByText('2000-01')).toBeTruthy();
    expect(panel).toHaveBeenCalledWith(dayjs().format('YYYY-MM'));
});
it('renders two cross-week event segments with time only on the first', async () => {
    const events: CalendarEvent[] = [
        { start: '2026-10-03T09:30:00', end: '2026-10-05', showTime: true, title: 'Trip' },
    ];
    const view = await render(screen({ events }));
    expect(view.getAllByText('Trip', { includeHiddenElements: true })).toHaveLength(2);
    expect(view.getAllByText('09:30 ', { includeHiddenElements: true })).toHaveLength(1);
    expect(date(view, '2026-10-05').props.accessibilityLabel).toContain('Trip');
});
it('folds the third same-day event without hiding its accessible title', async () => {
    const events = ['One', 'Two', 'Three'].map((title) => ({ title, start: '2026-10-05' }));
    const view = await render(screen({ events }));
    expect(view.getByText('+1', { includeHiddenElements: true })).toBeTruthy();
    expect(date(view, '2026-10-05').props.accessibilityLabel).toContain('Three');
});
it('extracts native element and numeric titles for accessible dates', async () => {
    const view = await render(
        screen({
            events: [
                { title: <Text>Meeting</Text>, start: '2026-10-05' },
                { title: 0, start: '2026-10-05' },
            ],
        })
    );
    expect(date(view, '2026-10-05').props.accessibilityLabel).toBe('2026-10-05, Meeting, 0');
});
it('retains arbitrary native event content outside Text while announcing its textual children', async () => {
    const view = await render(
        screen({
            events: [
                {
                    title: (
                        <View testID="custom-title">
                            <Text>Meeting</Text>
                        </View>
                    ),
                    start: '2026-10-05',
                },
            ],
        })
    );
    const title = view.getByTestId('custom-title', { includeHiddenElements: true });
    expect(title.parent!.type).not.toBe('Text');
    expect(date(view, '2026-10-05').props.accessibilityLabel).toContain('Meeting');
});
it('keeps accessible hit targets and event rows inside their cells on a small large-font host', async () => {
    const previous = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
    const small = { width: 360, height: 640, scale: 1, fontScale: 1.6 };
    await act(async () => {
        Dimensions.set({ window: small, screen: small });
    });
    const view = await render(
        screen({
            width: 320,
            events: [
                { title: 'One', start: '2026-10-05' },
                { title: 'Two', start: '2026-10-05' },
            ],
        })
    );
    try {
        expect(date(view, '2026-10-05')).toHaveStyle({ minWidth: 44 });
        // Event artwork is hidden because the date button announces every event title.
        const first = StyleSheet.flatten(
            view.getByTestId('calendar-event-1-0', { includeHiddenElements: true }).props.style
        );
        const second = StyleSheet.flatten(
            view.getByTestId('calendar-event-1-1', { includeHiddenElements: true }).props.style
        );
        const cell = StyleSheet.flatten(date(view, '2026-10-05').parent!.props.style);
        expect(second.top).toBeGreaterThanOrEqual(first.top + first.height);
        expect(second.top + second.height).toBeLessThanOrEqual(cell.height);
        expect(second.height).toBeGreaterThan(20);
    } finally {
        await view.unmount();
        await act(async () => {
            Dimensions.set(previous);
        });
    }
});
it.each(['light', 'dark'] as const)('inherits the %s theme and consumer styling', async (mode) => {
    const view = await render(
        <ThemeProvider mode={mode} reducedMotion>
            {screen({ style: { opacity: 0.8 } })}
        </ThemeProvider>
    );
    expect(view.getByTestId('calendar')).toHaveStyle({ opacity: 0.8 });
});
it('offers equivalent native accessibility range creation with ordered endpoints', async () => {
    const create = jest.fn();
    const view = await render(screen({ draggableEvents: true, onEventCreate: create }));
    await fireEvent(date(view, '2026-10-09'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeStart' } });
    await fireEvent(date(view, '2026-10-05'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeEnd' } });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith('2026-10-05', '2026-10-09');
});
it('same-day or canceled native ranges never create an event', async () => {
    const create = jest.fn();
    const view = await render(screen({ draggableEvents: true, onEventCreate: create }));
    await fireEvent(date(view, '2026-10-05'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeStart' } });
    await fireEvent(date(view, '2026-10-05'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeEnd' } });
    await fireEvent(date(view, '2026-10-05'), 'longPress');
    await fireEvent(view.getByTestId('calendar-grid'), 'responderTerminate');
    await fireEvent(date(view, '2026-10-09'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeEnd' } });
    expect(create).not.toHaveBeenCalled();
});
it('disabling ranges invalidates an already started selection', async () => {
    const create = jest.fn();
    const view = await render(screen({ draggableEvents: true, onEventCreate: create }));
    await fireEvent(date(view, '2026-10-05'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeStart' } });
    await view.rerender(screen({ draggableEvents: false, onEventCreate: create }));
    await fireEvent(date(view, '2026-10-09'), 'accessibilityAction', { nativeEvent: { actionName: 'rangeEnd' } });
    expect(create).not.toHaveBeenCalled();
});
it('native keyboard adapter ignores unrelated targets, composition and modifier shortcuts', () => {
    let listener: (event: any) => void = () => undefined;
    const handle = jest.fn(() => true),
        remove = jest.fn();
    const root = {
        addEventListener: (_type: string, cb: typeof listener) => {
            listener = cb;
        },
        removeEventListener: remove,
    };
    const cleanup = attachCalendarKeyboard(root, 'calendar-', handle);
    for (const extra of [
        { target: { id: 'other' } },
        { target: { id: 'calendar-1' }, isComposing: true },
        { target: { id: 'calendar-1' }, ctrlKey: true },
    ]) {
        const preventDefault = jest.fn();
        listener({ key: 'ArrowRight', preventDefault, ...extra });
        expect(preventDefault).not.toHaveBeenCalled();
    }
    listener({ key: 'ArrowRight', target: { id: 'calendar-1' }, preventDefault: jest.fn() });
    expect(handle).toHaveBeenCalledWith('ArrowRight');
    cleanup?.();
    expect(remove).toHaveBeenCalled();
});
