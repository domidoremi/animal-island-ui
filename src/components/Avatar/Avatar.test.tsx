import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Avatar, AvatarGroup } from './Avatar';
import { ThemeProvider } from '../../theme/ThemeProvider';

it('renders the accessible native placeholder without a source', async () => {
    const view = await render(<Avatar testID="avatar" />);
    expect(view.getByRole('image', { name: 'avatar' })).toBeTruthy();
    expect(view.queryByTestId('avatar-image')).toBeNull();
});
it.each([
    ['small', 32],
    ['middle', 40],
    ['large', 48],
    [72, 72],
] as const)('maps size %s to native geometry', async (size, width) => {
    const view = await render(
        <Avatar size={size} testID="avatar">
            A
        </Avatar>
    );
    expect(view.getByTestId('avatar')).toHaveStyle({ width, height: width });
});
it('uses native text fitting instead of DOM measurements', async () => {
    const view = await render(
        <Avatar size={40} gap={6}>
            Long name
        </Avatar>
    );
    expect(view.getByText('Long name').props.adjustsFontSizeToFit).toBe(true);
    expect(view.getByText('Long name')).toHaveStyle({ maxWidth: 28 });
});
it('preserves numeric zero text', async () => {
    const view = await render(<Avatar>{0}</Avatar>);
    expect(view.getByRole('image', { name: '0' })).toBeTruthy();
});
it('accepts custom native icon content', async () => {
    const view = await render(<Avatar icon={<Text testID="icon">Icon</Text>} />);
    expect(view.getByTestId('icon')).toBeTruthy();
});
it('maps square shape and consumer style without a CSS class', async () => {
    const view = await render(<Avatar shape="square" testID="avatar" style={{ opacity: 0.5 }} />);
    expect(view.getByTestId('avatar')).toHaveStyle({ borderRadius: 8, opacity: 0.5 });
});
it('accepts URI images and keeps their accessible description', async () => {
    const view = await render(<Avatar src="file:///owned/avatar.png" alt="Profile" testID="avatar" />);
    expect(view.getByRole('image', { name: 'Profile' })).toBeTruthy();
    expect(view.getByTestId('avatar-image').props.source).toEqual({ uri: 'file:///owned/avatar.png' });
});
it('accepts a bundled native source', async () => {
    const view = await render(<Avatar src={123} testID="avatar" />);
    expect(view.getByTestId('avatar-image').props.source).toBe(123);
});
it('falls back after failure and retries a different source', async () => {
    const view = await render(
        <Avatar src="file:///one.png" testID="avatar">
            A
        </Avatar>
    );
    await fireEvent(view.getByTestId('avatar-image'), 'error', {});
    expect(view.queryByTestId('avatar-image')).toBeNull();
    await view.rerender(
        <Avatar src="file:///two.png" testID="avatar">
            A
        </Avatar>
    );
    expect(view.getByTestId('avatar-image').props.source.uri).toBe('file:///two.png');
});
it('honors an explicit fallback veto', async () => {
    const onError = jest.fn(() => false);
    const view = await render(<Avatar src="file:///one.png" onError={onError} testID="avatar" />);
    await fireEvent(view.getByTestId('avatar-image'), 'error', {});
    expect(onError).toHaveBeenCalledTimes(1);
    expect(view.getByTestId('avatar-image')).toBeTruthy();
});
it('does not let an old image failure reject a new source', async () => {
    const view = await render(<Avatar src="file:///old.png" testID="avatar" />);
    const oldError = view.getByTestId('avatar-image').props.onError;
    await view.rerender(<Avatar src="file:///new.png" testID="avatar" />);
    await act(() => oldError());
    expect(view.getByTestId('avatar-image').props.source.uri).toBe('file:///new.png');
});
it('keeps all group children when maxCount is absent', async () => {
    const view = await render(
        <AvatarGroup>
            <Avatar>A</Avatar>
            <Avatar>B</Avatar>
        </AvatarGroup>
    );
    expect(view.getByText('A')).toBeTruthy();
    expect(view.getByText('B')).toBeTruthy();
});
it('collapses only excess avatars and shares group size and shape', async () => {
    const view = await render(
        <Avatar.Group maxCount={1} size="large" shape="square">
            <Avatar testID="a">A</Avatar>
            <Avatar>B</Avatar>
            <Avatar>C</Avatar>
        </Avatar.Group>
    );
    expect(view.getByTestId('a')).toHaveStyle({ width: 48, height: 48, borderRadius: 8 });
    expect(view.getByText('+2')).toBeTruthy();
    expect(view.queryByText('B')).toBeNull();
});
it('does not override an explicit child size or shape', async () => {
    const view = await render(
        <AvatarGroup size="large" shape="square">
            <Avatar testID="a" size={24} shape="circle">
                A
            </Avatar>
        </AvatarGroup>
    );
    expect(view.getByTestId('a')).toHaveStyle({ width: 24, borderRadius: 12 });
});
it('does not collapse an exact-sized group', async () => {
    const view = await render(
        <AvatarGroup maxCount={2}>
            <Avatar>A</Avatar>
            <Avatar>B</Avatar>
        </AvatarGroup>
    );
    expect(view.queryByText('+0')).toBeNull();
    expect(view.getByText('B')).toBeTruthy();
});
it.each(['light', 'dark'] as const)('uses the host %s theme without a second appearance listener', async (mode) => {
    const view = await render(
        <ThemeProvider mode={mode} accent="#996633">
            <Avatar testID="avatar">A</Avatar>
        </ThemeProvider>
    );
    expect(view.getByText('A')).toHaveStyle({ color: '#996633' });
});
