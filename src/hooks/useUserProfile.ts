/**
 * useUserProfile - Custom hook for user profile and saved strategies
 * Uses localStorage for MVP persistence
 */

import { useState, useEffect, useCallback } from 'react';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    createdAt: string;
}

export interface SavedStrategy {
    id: string;
    name: string;
    xml: string;
    savedAt: string;
    blockCount: number;
}

interface UserSettings {
    theme: 'light' | 'dark' | 'system';
    defaultSymbol: string;
    defaultTimeframe: string;
    autoSave: boolean;
}

const STORAGE_KEYS = {
    USER: 'ppm_user_profile',
    STRATEGIES: 'ppm_saved_strategies',
    SETTINGS: 'ppm_user_settings',
};

const DEFAULT_SETTINGS: UserSettings = {
    theme: 'dark',
    defaultSymbol: 'EURUSD',
    defaultTimeframe: '1H',
    autoSave: true,
};

export const useUserProfile = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
            const storedStrategies = localStorage.getItem(STORAGE_KEYS.STRATEGIES);
            const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
            if (storedStrategies) {
                setSavedStrategies(JSON.parse(storedStrategies));
            }
            if (storedSettings) {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Save user to localStorage
    const saveUser = useCallback((userData: UserProfile | null) => {
        if (userData) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER);
        }
        setUser(userData);
    }, []);

    // Login (mock for MVP)
    const login = useCallback((name: string, email: string) => {
        const newUser: UserProfile = {
            id: `user_${Date.now()}`,
            name,
            email,
            createdAt: new Date().toISOString(),
        };
        saveUser(newUser);
        return newUser;
    }, [saveUser]);

    // Logout
    const logout = useCallback(() => {
        saveUser(null);
    }, [saveUser]);

    // Update user profile
    const updateProfile = useCallback((updates: Partial<UserProfile>) => {
        if (!user) return;
        const updatedUser = { ...user, ...updates };
        saveUser(updatedUser);
    }, [user, saveUser]);

    // Save a strategy
    const saveStrategy = useCallback((name: string, xml: string) => {
        const blockCount = (xml.match(/<block /g) || []).length;
        const newStrategy: SavedStrategy = {
            id: `strategy_${Date.now()}`,
            name,
            xml,
            savedAt: new Date().toISOString(),
            blockCount,
        };

        const updatedStrategies = [newStrategy, ...savedStrategies];
        setSavedStrategies(updatedStrategies);
        localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(updatedStrategies));
        return newStrategy;
    }, [savedStrategies]);

    // Delete a strategy
    const deleteStrategy = useCallback((id: string) => {
        const updatedStrategies = savedStrategies.filter(s => s.id !== id);
        setSavedStrategies(updatedStrategies);
        localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(updatedStrategies));
    }, [savedStrategies]);

    // Update settings
    const updateSettings = useCallback((updates: Partial<UserSettings>) => {
        const updatedSettings = { ...settings, ...updates };
        setSettings(updatedSettings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    }, [settings]);

    return {
        // User state
        user,
        isLoggedIn: !!user,
        isLoading,

        // Auth actions
        login,
        logout,
        updateProfile,

        // Strategies
        savedStrategies,
        saveStrategy,
        deleteStrategy,

        // Settings
        settings,
        updateSettings,
    };
};

export default useUserProfile;
