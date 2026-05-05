/**
 * ThemeContext — global theme switcher with four named themes plus system.
 *
 * Themes:
 *   - dark        (default — Webull-inspired)
 *   - light       (daylight reading)
 *   - hicontrast  (AAA-accessible black/white)
 *   - bloomberg   (terminal amber on near-black)
 *   - system      (follows OS preference, resolves to dark or light)
 *
 * Applied via `data-theme` attribute on <html>, plus a `dark` class for
 * Tailwind's class-based dark variants. The current resolved theme is
 * exposed so components like the Radix UI Theme provider can react.
 */

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'hicontrast' | 'bloomberg' | 'system';
export type ResolvedTheme = 'dark' | 'light' | 'hicontrast' | 'bloomberg';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const VALID_THEMES: readonly Theme[] = ['dark', 'light', 'hicontrast', 'bloomberg', 'system'];
const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (VALID_THEMES as readonly string[]).includes(v);

function resolveSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
    const root = window.document.documentElement;
    root.setAttribute('data-theme', resolved);
    // Tailwind class-based dark mode — treat dark/hicontrast/bloomberg as dark
    // for components that only know the binary distinction.
    root.classList.remove('light', 'dark');
    root.classList.add(resolved === 'light' ? 'light' : 'dark');
}

export function ThemeProvider({
    children,
    defaultTheme = 'dark',
    storageKey = 'ppm-ui-theme',
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window === 'undefined') return defaultTheme;
        const stored = localStorage.getItem(storageKey);
        return isTheme(stored) ? stored : defaultTheme;
    });

    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
        const initial = theme === 'system' ? resolveSystemTheme() : theme;
        if (typeof window !== 'undefined') applyTheme(initial);
        return initial;
    });

    useEffect(() => {
        const next: ResolvedTheme = theme === 'system' ? resolveSystemTheme() : theme;
        applyTheme(next);
        setResolvedTheme(next);
    }, [theme]);

    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            const next = mq.matches ? 'dark' : 'light';
            applyTheme(next);
            setResolvedTheme(next);
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = useCallback(
        (next: Theme) => {
            if (typeof window !== 'undefined') localStorage.setItem(storageKey, next);
            setThemeState(next);
        },
        [storageKey],
    );

    const value = useMemo(
        () => ({ theme, setTheme, resolvedTheme }),
        [theme, setTheme, resolvedTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export default ThemeProvider;
