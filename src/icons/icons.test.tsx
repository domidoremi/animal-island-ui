import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import {
    CheckIcon,
    CloseIcon,
    DonutIcon,
    EyeIcon,
    FileIcon,
    RocketIcon,
    StarIcon,
    UploadIcon,
    UserIcon,
} from './index';

const hidden = { includeHiddenElements: true } as const;

it.each(['web', 'ios', 'android'] as const)(
    'keeps decorative loading-icon accessibility native-only on %s',
    async (platform) => {
        const descriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
        Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
        try {
            const view = await render(<DonutIcon testID="loading-donut" />);
            const root = view.getByTestId('loading-donut', hidden);
            expect(root.props.accessible).toBe(platform === 'web' ? undefined : false);
            expect(root.props['aria-hidden']).toBe(true);
            expect(view.queryByTestId('loading-donut')).toBeNull();
            await view.unmount();
        } finally {
            Object.defineProperty(Platform, 'OS', descriptor);
        }
    }
);

it.each([UserIcon, CloseIcon, UploadIcon, RocketIcon, FileIcon, CheckIcon, EyeIcon, StarIcon])(
    '%s uses the shared decorative 48-unit canvas',
    async (Icon) => {
        const view = await render(<Icon testID="icon" size={32} />);
        const root = view.getByTestId('icon', hidden);
        expect(root.props).toMatchObject({ minX: 0, minY: 0, vbWidth: 48, vbHeight: 48 });
        expect(root).toHaveStyle({ width: 32, height: 32 });
        expect(root.props['aria-hidden']).toBe(true);
        expect(view.queryByTestId('icon')).toBeNull();
    }
);

it('retains the upstream UserIcon face and revised RocketIcon artwork', async () => {
    const view = await render(<UserIcon testID="user" />);
    expect(view.getByTestId('user', hidden).queryAll((node) => node.props.r === 8.5)[0].props).toMatchObject({
        cx: 24,
        cy: 16,
        r: 8.5,
    });
    await view.rerender(<RocketIcon testID="rocket" />);
    const rocket = view.getByTestId('rocket', hidden);
    expect(rocket.queryAll((node) => Boolean(node.props.d)).map((path) => path.props.d)).toContain(
        'M18 32 L24 42.5 L30 32 Z'
    );
    expect(rocket.queryAll((node) => node.props.r === 5)[0].props).toMatchObject({ cx: 24, cy: 20, r: 5 });
});

it('scales designed inner strokes and rejects invalid root stroke widths', async () => {
    const view = await render(<CloseIcon testID="close" strokeWidth={7} />);
    const root = view.getByTestId('close', hidden);
    expect(root.props.strokeWidth).toBe(7);
    expect(root.queryAll((node) => Boolean(node.props.d)).map((path) => path.props.strokeWidth)).toEqual([9, 9]);
    await view.rerender(<CloseIcon testID="close" strokeWidth={NaN} />);
    expect(view.getByTestId('close', hidden).props.strokeWidth).toBe(3.5);
    expect(
        view
            .getByTestId('close', hidden)
            .queryAll((node) => Boolean(node.props.d))
            .map((path) => path.props.strokeWidth)
    ).toEqual([4.5, 4.5]);
});
