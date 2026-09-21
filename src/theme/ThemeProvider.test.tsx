import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { resolveNativeTheme } from './appearance';
import { defaultTheme } from './tokens';

/**
 * ThemeProvider / useTheme 的 context 行为测试。
 *
 * 主题解析本身在 `appearance.test.ts` 里测过了，这里只测 Provider 这一层：
 * 无 Provider 时的默认值、props → context 的映射、accent 覆盖，以及 accent
 * 叠加在明/暗之上时不影响其余颜色。
 *
 * ⚠️ RNTL 14 的 `renderHook` 是 **async**（`result.current` 在渲染后的 useEffect
 * 里才赋值），所有用例都必须 `await`，否则 `result.current` 为 undefined。
 */

const wrapperFor = (props: React.ComponentProps<typeof ThemeProvider>) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
        return <ThemeProvider {...props}>{children}</ThemeProvider>;
    };

describe('useTheme（无 Provider）', () => {
    it('返回一组安全默认值：light / defaultTheme / reducedMotion=false', async () => {
        const { result } = await renderHook(() => useTheme());
        expect(result.current.mode).toBe('light');
        expect(result.current.theme).toBe(defaultTheme);
        expect(result.current.reducedMotion).toBe(false);
    });
});

describe('ThemeProvider', () => {
    it('默认（无 props）= light + defaultTheme', async () => {
        const { result } = await renderHook(() => useTheme(), { wrapper: wrapperFor({}) });
        expect(result.current.mode).toBe('light');
        expect(result.current.theme).toBe(defaultTheme);
        expect(result.current.reducedMotion).toBe(false);
    });

    it('mode="dark" 时 theme 等于 resolveNativeTheme("dark")', async () => {
        const { result } = await renderHook(() => useTheme(), { wrapper: wrapperFor({ mode: 'dark' }) });
        expect(result.current.mode).toBe('dark');
        expect(result.current.theme).toEqual(resolveNativeTheme('dark'));
    });

    it('reducedMotion 透传到 context', async () => {
        const { result } = await renderHook(() => useTheme(), { wrapper: wrapperFor({ reducedMotion: true }) });
        expect(result.current.reducedMotion).toBe(true);
    });

    describe('accent 覆盖', () => {
        it('在 light 之上只改 primary，其余颜色不变', async () => {
            const accent = '#ff8800';
            const { result } = await renderHook(() => useTheme(), { wrapper: wrapperFor({ accent }) });
            expect(result.current.theme.colors.primary).toBe(accent);
            // 其余颜色仍是 light（defaultTheme）的值
            expect(result.current.theme.colors.bg).toBe(defaultTheme.colors.bg);
            expect(result.current.theme.colors.text).toBe(defaultTheme.colors.text);
        });

        it('在 dark 之上只改 primary，其余仍是暗色', async () => {
            const accent = '#ff8800';
            const dark = resolveNativeTheme('dark');
            const { result } = await renderHook(() => useTheme(), { wrapper: wrapperFor({ mode: 'dark', accent }) });
            expect(result.current.theme.colors.primary).toBe(accent);
            expect(result.current.theme.colors.bg).toBe(dark.colors.bg);
            expect(result.current.theme.colors.text).toBe(dark.colors.text);
        });

        it('不传 accent 时不克隆、不改动默认 primary', async () => {
            const { result } = await renderHook(() => useTheme(), { wrapper: wrapperFor({}) });
            expect(result.current.theme.colors.primary).toBe(defaultTheme.colors.primary);
        });
    });
});
