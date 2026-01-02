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

const BACKEND_URL = "http://localhost:8000";

export const useUserProfile = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);

    // Initial load
    useEffect(() => {
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            fetchStrategies(parsedUser.id);
        }

        const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (storedSettings) {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
        }
        setIsLoading(false);
    }, []);

    const fetchStrategies = async (userId: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/strategies?user_id=${userId}`);
            if (res.ok) {
                const data = await res.json();
                // Map DB fields to frontend interface if needed
                // DB: id, user_id, name, xml, python_code, block_count, saved_at
                // Frontend: id, name, xml, savedAt, blockCount
                const strategies: SavedStrategy[] = data.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    xml: s.xml,
                    savedAt: s.saved_at,
                    blockCount: s.block_count
                }));
                setSavedStrategies(strategies);
            }
        } catch (e) {
            console.error("Failed to fetch strategies", e);
        }
    };

    // Save user to localStorage
    const saveUserToStorage = (userData: UserProfile | null) => {
        if (userData) {
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER);
            setSavedStrategies([]);
        }
        setUser(userData);
    };

    // Login
    const login = useCallback(async (email: string, password: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (res.ok) {
                const data = await res.json();
                const userProfile: UserProfile = {
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    createdAt: data.user.created_at
                };
                saveUserToStorage(userProfile);
                fetchStrategies(userProfile.id);
                return userProfile;
            } else {
                throw new Error("Invalid credentials");
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    }, []);

    // Logout
    const logout = useCallback(() => {
        saveUserToStorage(null);
    }, []);

    // Update user profile (Mock for now, or add endpoint later)
    const updateProfile = useCallback((updates: Partial<UserProfile>) => {
        if (!user) return;
        const updatedUser = { ...user, ...updates };
        saveUserToStorage(updatedUser);
    }, [user]);

    // Save a strategy
    const saveStrategy = useCallback(async (name: string, xml: string, python_code?: string) => {
        if (!user) return null;

        const blockCount = (xml.match(/<block /g) || []).length;

        try {
            const res = await fetch(`${BACKEND_URL}/api/strategies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    name,
                    xml,
                    python_code: python_code || "",
                    block_count: blockCount
                })
            });

            if (res.ok) {
                const data = await res.json();
                // Refresh list
                await fetchStrategies(user.id);
                return { id: data.id };
            }
        } catch (e) {
            console.error("Failed to save strategy", e);
            throw e;
        }
    }, [user]);

    // Delete a strategy
    const deleteStrategy = useCallback(async (id: string) => {
        if (!user) return;
        try {
            await fetch(`${BACKEND_URL}/api/strategies/${id}?user_id=${user.id}`, { method: 'DELETE' });
            await fetchStrategies(user.id);
        } catch (e) {
            console.error("Failed to delete", e);
        }
    }, [user]);

    // Update settings
    const updateSettings = useCallback((updates: Partial<UserSettings>) => {
        const updatedSettings = { ...settings, ...updates };
        setSettings(updatedSettings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    }, [settings]);

    return {
        user,
        isLoggedIn: !!user,
        isLoading,
        login,
        logout,
        updateProfile,
        savedStrategies,
        saveStrategy,
        deleteStrategy,
        settings,
        updateSettings,
    };
};

export default useUserProfile;
