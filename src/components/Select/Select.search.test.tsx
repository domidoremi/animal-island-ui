import React, { useState } from 'react';
import { Animated, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Select, type SelectProps } from './Select';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { attachSelectKeyboard, focusSelect, setSelectWebSemantics } from './selectWeb';

const options = [
    { key: 'a', label: 'Apple' },
    { key: 'b', label: 'Banana' },
    { key: 'c', label: 'Cherry', disabled: true },
];

const control = (props: Partial<SelectProps> = {}) => (
    <ThemeProvider reducedMotion>
        <Select options={options} value="" onChange={() => {}} showSearch testID="search" {...props} />
    </ThemeProvider>
);

it('search edits use the real native input and retain the host value until explicit selection', async () => {
    const change = jest.fn(),
        query = jest.fn();
    const view = await render(control({ value: 'a', onChange: change, onSearch: query }));
    expect(view.getByTestId('search-search').props.value).toBe('Apple');
    await fireEvent.changeText(view.getByTestId('search-search'), 'Appleb');
    expect(query).toHaveBeenCalledWith('b');
    expect(view.getByTestId('search-panel-search').props.value).toBe('b');
    expect(view.queryByTestId('search-option-a')).toBeNull();
    expect(view.getByTestId('search-option-b')).toBeTruthy();
    expect(change).not.toHaveBeenCalled();
    await fireEvent.press(view.getByTestId('search-option-b'));
    expect(change).toHaveBeenCalledWith('b');
    expect(query).toHaveBeenLastCalledWith('');
    expect(view.getByTestId('search-search').props.value).toBe('Apple');
});

it.each([
    { optionFilterProp: 'label' as const, query: 'BAN', visible: 'b' },
    { optionFilterProp: 'key' as const, query: 'B', visible: 'b' },
])('supports built-in case-insensitive $optionFilterProp matching', async ({ optionFilterProp, query, visible }) => {
    const view = await render(control({ optionFilterProp }));
    await fireEvent.changeText(view.getByTestId('search-search'), query);
    expect(view.getByTestId('search-option-' + visible)).toBeTruthy();
    expect(view.queryByTestId('search-option-a')).toBeNull();
});

it('filterOption false preserves remote results while exposing the raw query', async () => {
    const query = jest.fn();
    const view = await render(control({ filterOption: false, onSearch: query }));
    await fireEvent.changeText(view.getByTestId('search-search'), 'unmatched');
    expect(query).toHaveBeenCalledWith('unmatched');
    for (const option of options) expect(view.getByTestId('search-option-' + option.key)).toBeTruthy();
});

it('custom matchers receive current options and expose a native empty-state element', async () => {
    const filterOption = jest.fn((input: string, option: (typeof options)[number]) => option.key === input);
    const view = await render(control({ filterOption, notFoundContent: <Text>No owned results</Text> }));
    await fireEvent.changeText(view.getByTestId('search-search'), 'missing');
    expect(filterOption).toHaveBeenCalledWith('missing', options[0]);
    expect(view.getByText('No owned results')).toBeTruthy();
    expect(view.getByTestId('search-not-found').props.accessibilityState).toMatchObject({
        disabled: true,
        selected: false,
    });
});

it('Escape resets a query before closing and never selects a result', async () => {
    const change = jest.fn(),
        query = jest.fn();
    const view = await render(control({ onChange: change, onSearch: query }));
    await fireEvent.changeText(view.getByTestId('search-search'), 'ban');
    await fireEvent(view.getByTestId('search-panel-search'), 'keyPress', { nativeEvent: { key: 'Escape' } });
    expect(query).toHaveBeenLastCalledWith('');
    expect(view.getByTestId('search-listbox')).toBeTruthy();
    expect(view.getByTestId('search-panel-search').props.value).toBe('');
    await fireEvent(view.getByTestId('search-panel-search'), 'keyPress', { nativeEvent: { key: 'Escape' } });
    expect(view.queryByTestId('search-listbox')).toBeNull();
    expect(change).not.toHaveBeenCalled();
});

it('native arrows skip disabled options and native Enter commits only on submit', async () => {
    const change = jest.fn();
    const view = await render(control({ onChange: change }));
    await fireEvent.press(view.getByTestId('search-trigger'));
    await fireEvent(view.getByTestId('search-panel-search'), 'keyPress', { nativeEvent: { key: 'End' } });
    await fireEvent(view.getByTestId('search-panel-search'), 'keyPress', { nativeEvent: { key: 'Enter' } });
    expect(change).not.toHaveBeenCalled();
    await fireEvent(view.getByTestId('search-panel-search'), 'submitEditing');
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith('b');
});

it('closing by native Back resets remote search state without changing the value', async () => {
    const query = jest.fn(),
        change = jest.fn();
    const view = await render(control({ onSearch: query, onChange: change }));
    await fireEvent.changeText(view.getByTestId('search-search'), 'ban');
    const modal = view.container.queryAll((node) => typeof node.props.onRequestClose === 'function')[0];
    await act(async () => {
        modal.props.onRequestClose();
    });
    expect(query).toHaveBeenLastCalledWith('');
    expect(change).not.toHaveBeenCalled();
    expect(view.queryByTestId('search-listbox')).toBeNull();
});

it('clear is an explicit native action and requires controlled writeback', async () => {
    const change = jest.fn(),
        clear = jest.fn();
    const view = await render(
        control({ value: 'a', allowClear: true, onChange: change, onClear: clear, clearAriaLabel: 'Clear fruit' })
    );
    await fireEvent.press(view.getByRole('button', { name: 'Clear fruit' }));
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith('');
    expect(clear).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('search-search').props.value).toBe('Apple');
    expect(view.queryByTestId('search-listbox')).toBeNull();
});

it('a real controlled owner removes the clear action only after saving the empty value', async () => {
    function Owner() {
        const [value, setValue] = useState('a');
        return control({ value, onChange: setValue, allowClear: true });
    }
    const view = await render(<Owner />);
    await fireEvent.press(view.getByTestId('search-clear'));
    expect(view.queryByTestId('search-clear')).toBeNull();
    expect(view.getByTestId('search-search').props.value).toBe('');
});

it('disabling a mounted search closes its panel and does not grant selection or clear authority', async () => {
    const change = jest.fn();
    const view = await render(control({ value: 'a', allowClear: true, onChange: change }));
    await fireEvent.press(view.getByTestId('search-trigger'));
    await view.rerender(control({ value: 'a', allowClear: true, onChange: change, disabled: true }));
    expect(view.queryByTestId('search-listbox')).toBeNull();
    expect(view.queryByTestId('search-clear')).toBeNull();
    expect(view.getByTestId('search-search').props.editable).toBe(false);
    expect(change).not.toHaveBeenCalled();
});

it('reduced motion opens a visible menu without scheduling decorative timing', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    try {
        const view = await render(control());
        await fireEvent.press(view.getByTestId('search-trigger'));
        expect(view.getByTestId('search-listbox')).toBeTruthy();
        expect(timing).not.toHaveBeenCalled();
    } finally {
        timing.mockRestore();
    }
});

it('the Web adapter leaves clear buttons, text composition and modifier shortcuts alone', () => {
    let listener: (event: any) => void = () => undefined;
    const remove = jest.fn(),
        handle = jest.fn(() => true);
    const root = {
        addEventListener: (_name: string, cb: typeof listener) => {
            listener = cb;
        },
        removeEventListener: remove,
    };
    const cleanup = attachSelectKeyboard(root, 'control', 'option-', handle);
    for (const extra of [
        { target: { id: 'clear' } },
        { target: { id: 'control' }, isComposing: true },
        { target: { id: 'control' }, ctrlKey: true },
    ]) {
        const preventDefault = jest.fn();
        listener({ key: 'Enter', preventDefault, ...extra });
        expect(preventDefault).not.toHaveBeenCalled();
    }
    listener({ key: 'ArrowDown', target: { id: 'control' }, preventDefault: jest.fn() });
    listener({ key: ' ', target: { id: 'option-b' }, preventDefault: jest.fn() });
    expect(handle).toHaveBeenNthCalledWith(1, 'ArrowDown', false);
    expect(handle).toHaveBeenNthCalledWith(2, ' ', true);
    cleanup?.();
    expect(remove).toHaveBeenCalledWith('keydown', listener);
});

it('the Web adapter owns only list relationships and restores them on cleanup', () => {
    const set = jest.fn(),
        remove = jest.fn(),
        focus = jest.fn();
    const element = { setAttribute: set, removeAttribute: remove, querySelector: jest.fn(() => ({ focus })) };
    const cleanup = setSelectWebSemantics(element, 'list', 'option-b');
    expect(set).toHaveBeenCalledWith('aria-haspopup', 'listbox');
    expect(set).toHaveBeenCalledWith('aria-controls', 'list');
    expect(set).toHaveBeenCalledWith('aria-activedescendant', 'option-b');
    focusSelect(element, 'option-b');
    expect(focus).toHaveBeenCalledTimes(1);
    cleanup?.();
    expect(remove.mock.calls.map(([name]) => name)).toEqual([
        'aria-haspopup',
        'aria-controls',
        'aria-activedescendant',
    ]);
});
