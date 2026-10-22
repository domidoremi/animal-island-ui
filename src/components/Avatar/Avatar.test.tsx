import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Avatar, AvatarGroup } from './Avatar';
import { UserIcon } from 'naive-icons';

// 根元素定位：文字/图标内容的外层是根 span，图片的父节点是根 span
const rootOf = (el: HTMLElement | null): HTMLElement | null => (el ? (el.parentElement as HTMLElement | null) : null);

describe('Avatar', () => {
    it('renders a placeholder with the default user icon when no src', () => {
        render(<Avatar />);
        const avatar = screen.getByRole('img', { name: 'avatar' });
        expect(avatar.className).toContain('avatar');
        expect(avatar.className).toContain('placeholder');
    });

    it('renders text children as the placeholder content', () => {
        render(<Avatar>U</Avatar>);
        expect(screen.getByText('U').className).toContain('string');
    });

    it('renders a naive-icons style component child as an icon avatar', () => {
        const FishMock = () => <svg data-testid="fish-icon" aria-hidden="true" />;
        render(
            <Avatar>
                <FishMock />
            </Avatar>
        );
        const icon = screen.getByTestId('fish-icon');
        expect(rootOf(rootOf(icon))?.className).toContain('avatar');
        expect(rootOf(rootOf(icon))?.className).toContain('placeholder');
        // 图标头像由居中容器包裹，但不会套用文字测量缩放（无内联 fontSize）
        const wrapper = icon.closest('span');
        expect(wrapper).not.toBeNull();
        expect(wrapper?.getAttribute('style')).toBeNull();
    });

    it('renders a custom icon node as the placeholder content', () => {
        render(<Avatar icon={<UserIcon data-testid="custom-icon" />} />);
        expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('applies the numeric size to width/height', () => {
        render(<Avatar size={56}>A</Avatar>);
        const avatar = rootOf(screen.getByText('A'));
        expect(avatar).toHaveStyle({ width: '56px', height: '56px' });
    });

    it('applies square shape class', () => {
        render(<Avatar shape="square" />);
        const avatar = screen.getByRole('img', { name: 'avatar' });
        expect(avatar.className).toContain('shape-square');
    });

    it('renders an img with alt text when src is provided', () => {
        render(<Avatar src="/u.png" alt="U" />);
        expect(screen.getByRole('img', { name: 'U' })).toBeInTheDocument();
    });

    it('renders a decorative image when alt is omitted', () => {
        const { container } = render(<Avatar src="/u.png" />);
        const img = container.querySelector('img');
        expect(img).toHaveAttribute('alt', '');
    });

    it('falls back to placeholder content when the image fails to load', () => {
        const { container } = render(<Avatar src="/broken.png">U</Avatar>);
        fireEvent.error(container.querySelector('img')!);
        expect(container.querySelector('img')).not.toBeInTheDocument();
        expect(screen.getByText('U')).toBeInTheDocument();
    });

    it('keeps the img when onError returns false', () => {
        const { container } = render(<Avatar src="/broken.png" onError={() => false} />);
        fireEvent.error(container.querySelector('img')!);
        expect(container.querySelector('img')).toBeInTheDocument();
    });

    it('does not apply the placeholder class when an image is loaded', () => {
        const { container } = render(<Avatar src="/ok.png" />);
        const root = rootOf(container.querySelector('img'));
        expect(root?.className).toContain('avatar');
        expect(root?.className).not.toContain('placeholder');
    });

    it('renders custom className and spreads HTML attributes', () => {
        render(<Avatar className="my-avatar" data-role="x" />);
        const avatar = screen.getByRole('img', { name: 'avatar' });
        expect(avatar).toHaveClass('my-avatar');
        expect(avatar).toHaveAttribute('data-role', 'x');
    });
});

describe('AvatarGroup', () => {
    it('renders all children without maxCount', () => {
        render(
            <AvatarGroup>
                <Avatar>A</Avatar>
                <Avatar>B</Avatar>
                <Avatar>C</Avatar>
            </AvatarGroup>
        );
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('collapses beyond maxCount into a "+N" badge', () => {
        render(
            <AvatarGroup maxCount={2}>
                <Avatar>A</Avatar>
                <Avatar>B</Avatar>
                <Avatar>C</Avatar>
                <Avatar>D</Avatar>
            </AvatarGroup>
        );
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
        expect(screen.queryByText('C')).not.toBeInTheDocument();
        expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('injects group-level size and shape into child Avatars', () => {
        render(
            <AvatarGroup size="large" shape="square">
                <Avatar>A</Avatar>
            </AvatarGroup>
        );
        const avatar = rootOf(screen.getByText('A'));
        expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
        expect(avatar?.className).toContain('shape-square');
    });

    it('does not override a child Avatar that sets its own size', () => {
        render(
            <AvatarGroup size="large">
                <Avatar size={24}>A</Avatar>
            </AvatarGroup>
        );
        const avatar = rootOf(screen.getByText('A'));
        expect(avatar).toHaveStyle({ width: '24px', height: '24px' });
    });

    it('does not render the "+N" badge when children count equals maxCount', () => {
        render(
            <AvatarGroup maxCount={3}>
                <Avatar>A</Avatar>
                <Avatar>B</Avatar>
                <Avatar>C</Avatar>
            </AvatarGroup>
        );
        expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('is accessible via the static Avatar.Group alias', () => {
        render(
            <Avatar.Group maxCount={1}>
                <Avatar>A</Avatar>
                <Avatar>B</Avatar>
            </Avatar.Group>
        );
        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.getByText('+1')).toBeInTheDocument();
    });
});
