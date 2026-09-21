import React, { createContext, useContext, useMemo } from 'react';
import { resolveNativeTheme, type ThemeMode } from './appearance';
import { defaultTheme, type Theme } from './tokens';

export interface ThemeProviderProps {
    children?: React.ReactNode;
    /** Follow the host's resolved light/dark setting, not a second system listener. */
    mode?: ThemeMode;
    /** Host motion preference; true disables decorative animation. */
    reducedMotion?: boolean;
    /** Optional brand accent. Default colors remain owned by this package. */
    accent?: string;
}

const ThemeContext = createContext<{ mode: ThemeMode; theme: Theme; reducedMotion: boolean }>({
    mode: 'light',
    theme: defaultTheme,
    reducedMotion: false,
});

export function ThemeProvider({ children, mode = 'light', reducedMotion = false, accent }: ThemeProviderProps) {
    const value = useMemo(() => {
        const base = resolveNativeTheme(mode);
        const theme = accent ? { ...base, colors: { ...base.colors, primary: accent } } : base;
        return { mode, theme, reducedMotion };
    }, [mode, reducedMotion, accent]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
