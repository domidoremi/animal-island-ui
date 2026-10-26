import React from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Badge, type BadgeColor } from './Badge';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { resolveNativeTheme } from '../../theme/appearance';

it.each([undefined, null, '', '  ', 0, '0'])('hides empty or zero count %s', async (count) => {
    const view = await render(<Badge count={count} testID="badge" />);
    expect(view.queryByTestId('badge-indicator')).toBeNull();
});
it.each([0, '0'])('shows zero only with showZero: %s', async (count) => {
    const view = await render(<Badge count={count} showZero testID="badge" />);
    expect(view.getByText('0')).toBeTruthy();
});
it.each([100, '100'])('caps numeric content %s but announces the full count', async (count) => {
    const view = await render(<Badge count={count} testID="badge" />);
    expect(view.getByText('99+')).toBeTruthy();
    expect(view.getByTestId('badge-indicator').props.accessibilityLabel).toBe('100');
});
it('allows a custom cap and an explicit description', async () => {
    const view = await render(<Badge count={80} overflowCount={50} title="Unread messages" testID="badge" />);
    expect(view.getByText('50+')).toBeTruthy();
    expect(view.getByTestId('badge-indicator').props.accessibilityLabel).toBe('Unread messages');
});
it('does not cap a native element count', async () => {
    const view = await render(<Badge count={<Text>100</Text>} />);
    expect(view.getByText('100')).toBeTruthy();
    expect(view.queryByText('99+')).toBeNull();
});
it.each([undefined, null, '', '  ', 7])('dot mode is visible for nonzero count %s', async (count) => {
    const view = await render(<Badge count={count} dot testID="badge" />);
    expect(view.getByTestId('badge-indicator')).toHaveStyle({ width: 10, minHeight: 10 });
    expect(view.queryByText('7')).toBeNull();
});
it('zero dot remains hidden', async () => {
    const view = await render(<Badge count={0} dot testID="badge" />);
    expect(view.queryByTestId('badge-indicator')).toBeNull();
});
it.each(['small', 'medium'] as const)('keeps short content circular at %s size', async (size) => {
    const view = await render(<Badge count={99} size={size} testID="badge" />);
    const dimension = size === 'small' ? 16 : 20;
    expect(view.getByTestId('badge-indicator')).toHaveStyle({
        width: dimension,
        minHeight: dimension,
        paddingHorizontal: 0,
    });
});
it('lets longer and double-fullwidth content use a capsule', async () => {
    const view = await render(<Badge count="1000" overflowCount={2000} testID="badge" />);
    expect(view.getByTestId('badge-indicator')).toHaveStyle({ paddingHorizontal: 6 });
    await view.rerender(<Badge count="更新" testID="badge" />);
    expect(view.getByTestId('badge-indicator')).toHaveStyle({ paddingHorizontal: 6 });
});
it('positions an attached badge from its measured width', async () => {
    const view = await render(
        <Badge count="more" testID="badge">
            <View testID="child" />
        </Badge>
    );
    await fireEvent(view.getByTestId('badge-indicator'), 'layout', {
        nativeEvent: { layout: { width: 42, height: 20, x: 0, y: 0 } },
    });
    expect(view.getByTestId('badge-indicator')).toHaveStyle({ position: 'absolute', top: -10, right: -21 });
    expect(view.getByTestId('child')).toBeTruthy();
});
it('leaves standalone content in normal layout flow', async () => {
    const view = await render(<Badge count={3} testID="badge" style={{ opacity: 0.7 }} />);
    expect(view.getByTestId('badge-indicator')).toHaveStyle({ position: 'relative', borderColor: 'transparent' });
    expect(view.getByTestId('badge')).toHaveStyle({ opacity: 0.7 });
});
const colors: BadgeColor[] = [
    'app-red',
    'app-pink',
    'app-orange',
    'app-yellow',
    'app-teal',
    'app-green',
    'app-blue',
    'purple',
    'lime-green',
    'yellow-green',
    'brown',
    'warm-peach-pink',
];
for (const mode of ['light', 'dark'] as const)
    it.each(colors)('uses ' + mode + ' palette %s with reduced motion', async (color) => {
        const view = await render(
            <ThemeProvider mode={mode} reducedMotion>
                <Badge color={color} count={3} testID="badge" />
            </ThemeProvider>
        );
        const face = resolveNativeTheme(mode).brand[color];
        expect(view.getByTestId('badge-indicator')).toHaveStyle({ backgroundColor: face.solidBg });
        expect(view.getByText('3')).toHaveStyle({ color: face.onSolid });
    });
