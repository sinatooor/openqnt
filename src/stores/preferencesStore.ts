import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserPreferences {
    // Display preferences
    theme: 'light' | 'dark' | 'system';
    sidebarCollapsed: boolean;
    showCodePreview: boolean;

    // Trading preferences
    defaultSymbol: string;
    defaultTimeframe: string;
    defaultTradeSize: number;
    preferredBroker: string | null;

    // Backtest preferences
    defaultEngine: string;
    defaultStartDate: string;
    defaultEndDate: string;
    defaultInitialBalance: number;

    // Notification preferences
    soundEnabled: boolean;
    desktopNotifications: boolean;

    // AI preferences
    aiModel: 'deepseek' | 'gemini' | 'auto';
    fastMode: boolean;
}

interface PreferencesStore extends UserPreferences {
    // Actions
    setTheme: (theme: UserPreferences['theme']) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    setShowCodePreview: (show: boolean) => void;
    setDefaultSymbol: (symbol: string) => void;
    setDefaultTimeframe: (tf: string) => void;
    setDefaultTradeSize: (size: number) => void;
    setPreferredBroker: (broker: string | null) => void;
    setDefaultEngine: (engine: string) => void;
    setBacktestDates: (start: string, end: string) => void;
    setDefaultInitialBalance: (balance: number) => void;
    setSoundEnabled: (enabled: boolean) => void;
    setDesktopNotifications: (enabled: boolean) => void;
    setAiModel: (model: UserPreferences['aiModel']) => void;
    setFastMode: (fast: boolean) => void;
    resetToDefaults: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
    theme: 'dark',
    sidebarCollapsed: false,
    showCodePreview: true,
    defaultSymbol: 'EURUSD',
    defaultTimeframe: '1h',
    defaultTradeSize: 1,
    preferredBroker: null,
    defaultEngine: 'backtesting.py',
    defaultStartDate: '2024-01-01',
    defaultEndDate: '2024-06-30',
    defaultInitialBalance: 100000,
    soundEnabled: true,
    desktopNotifications: false,
    aiModel: 'auto',
    fastMode: false,
};

export const usePreferencesStore = create<PreferencesStore>()(
    persist(
        (set) => ({
            ...DEFAULT_PREFERENCES,

            setTheme: (theme) => set({ theme }),
            setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
            setShowCodePreview: (showCodePreview) => set({ showCodePreview }),
            setDefaultSymbol: (defaultSymbol) => set({ defaultSymbol }),
            setDefaultTimeframe: (defaultTimeframe) => set({ defaultTimeframe }),
            setDefaultTradeSize: (defaultTradeSize) => set({ defaultTradeSize }),
            setPreferredBroker: (preferredBroker) => set({ preferredBroker }),
            setDefaultEngine: (defaultEngine) => set({ defaultEngine }),
            setBacktestDates: (defaultStartDate, defaultEndDate) =>
                set({ defaultStartDate, defaultEndDate }),
            setDefaultInitialBalance: (defaultInitialBalance) =>
                set({ defaultInitialBalance }),
            setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
            setDesktopNotifications: (desktopNotifications) =>
                set({ desktopNotifications }),
            setAiModel: (aiModel) => set({ aiModel }),
            setFastMode: (fastMode) => set({ fastMode }),
            resetToDefaults: () => set(DEFAULT_PREFERENCES),
        }),
        {
            name: 'ppm-user-preferences',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

// Convenience hook for common preferences
export const useThemePreference = () => {
    const theme = usePreferencesStore((s) => s.theme);
    const setTheme = usePreferencesStore((s) => s.setTheme);
    return { theme, setTheme };
};

export const useBacktestPreferences = () => {
    const store = usePreferencesStore();
    return {
        defaultEngine: store.defaultEngine,
        defaultStartDate: store.defaultStartDate,
        defaultEndDate: store.defaultEndDate,
        defaultInitialBalance: store.defaultInitialBalance,
        defaultSymbol: store.defaultSymbol,
        setDefaultEngine: store.setDefaultEngine,
        setBacktestDates: store.setBacktestDates,
        setDefaultInitialBalance: store.setDefaultInitialBalance,
        setDefaultSymbol: store.setDefaultSymbol,
    };
};

export default usePreferencesStore;
