import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { Select } from './Select';
import { ThemeProvider } from '../../theme/ThemeProvider';

const originalPlatform = Platform.OS;
afterEach(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }));
const cases = (['android', 'ios', 'web'] as const).flatMap(platform => (['light', 'dark'] as const).map(mode => ({ platform, mode })));
const typography = { fontFamily: 'HostFixtureFont', fontSize: 19, lineHeight: 29, fontWeight: '400' as const, letterSpacing: 0.7 };
const options = [{ key: 'first', label: '已保存 Saved 保存済み' }, { key: 'next', label: '手动 Manual 手動' }, { key: 'off', label: '不可用 Unavailable 使用不可', disabled: true }];
it.each(cases)('applies opt-in host typography on $platform/$mode while retaining selection and search', async ({ platform, mode }) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    const change = jest.fn(), search = jest.fn();
    const tree = (value = 'first', showSearch = false, disabled = false) => <ThemeProvider mode={mode} reducedMotion>
        <Select testID="host-select" value={value} options={options} placeholder="选择 Choose 選択" onChange={change}
            showSearch={showSearch} onSearch={search} disabled={disabled} textStyle={[{ fontSize: 11 }, typography]} />
    </ThemeProvider>;
    const screen = await render(tree());
    expect(screen.getByText(options[0].label)).toHaveStyle(typography);
    await fireEvent.press(screen.getByTestId('host-select-trigger'));
    const option = screen.getByTestId('host-select-option-next');
    for (const label of options.map(row => row.label)) for (const host of screen.getAllByText(label, { includeHiddenElements: true })) expect(host).toHaveStyle(typography);
    await fireEvent.press(screen.getByTestId('host-select-option-off'));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByTestId('host-select-option-next')).toBe(option);
    await fireEvent.press(option);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith('next');
    await screen.rerender(tree('', true));
    expect(screen.getByTestId('host-select-search')).toHaveStyle(typography);
    await fireEvent.press(screen.getByTestId('host-select-trigger'));
    const input = screen.getByTestId('host-select-panel-search');
    expect(input).toHaveStyle(typography);
    await fireEvent.changeText(input, 'no-matching-fixture');
    expect(search).toHaveBeenCalledWith('no-matching-fixture');
    expect(screen.getByText('暂无数据')).toHaveStyle(typography);
    await screen.rerender(tree('', true, true));
    expect(screen.queryByTestId('host-select-listbox')).toBeNull();
    expect(screen.getByTestId('host-select-search')).toHaveStyle(typography);
    await screen.unmount();
});

it.each(cases)('retains upstream typography without the opt-in on $platform/$mode', async ({ platform, mode }) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    const tree = (value = 'first', showSearch = false) => <ThemeProvider mode={mode} reducedMotion>
        <Select testID="default-select" value={value} options={options} placeholder="Choose" onChange={() => {}} showSearch={showSearch} />
    </ThemeProvider>;
    const screen = await render(tree());
    expect(screen.getByText(options[0].label)).toHaveStyle({ fontSize: 14, fontWeight: '600' });
    await fireEvent.press(screen.getByTestId('default-select-trigger'));
    expect(within(screen.getByTestId('default-select-option-first')).getByText(options[0].label)).toHaveStyle({ fontSize: 14, fontWeight: '700' });
    expect(screen.getByText(options[1].label)).toHaveStyle({ fontSize: 14, fontWeight: '500' });
    await fireEvent.press(screen.getByTestId('default-select-backdrop'));
    await screen.rerender(tree(''));
    expect(screen.getByText('Choose')).toHaveStyle({ fontSize: 14 });
    await screen.rerender(tree('', true));
    expect(screen.getByTestId('default-select-search')).toHaveStyle({ fontSize: 14, fontWeight: '600' });
    await screen.unmount();
});
