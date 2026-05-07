/**
 * useUserProfile - Custom hook for user profile and saved strategies
 * Uses localStorage for MVP persistence + orchestrator API
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

import { orchestratorBase } from '@/lib/runtimeConfig';
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
    nodes: any[];
    edges: any[];
    savedAt: string;
    status: string;
    version: number;
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

const BACKEND_URL = orchestratorBase();

export const useUserProfile = () => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    
    const { user: authUser, isAuthenticated, logout: authLogout, login: authLogin } = useAuthStore();

    const fetchStrategies = useCallback(async () => {
        if (!isAuthenticated) return;
        
        try {
            const response = await api.listStrategies();
            if (response.strategies) {
                const strategies: SavedStrategy[] = response.strategies.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    nodes: [],
                    edges: [],
                    savedAt: s.updatedAt,
                    status: s.status,
                    version: s.currentVersion,
                }));
                setSavedStrategies(strategies);
            }
        } catch (e) {
            console.error("Failed to fetch strategies", e);
        }
    }, [isAuthenticated]);

    // Sync auth user with local user
    useEffect(() => {
        if (authUser && isAuthenticated) {
            const userProfile: UserProfile = {
                id: authUser.id,
                name: authUser.name || authUser.email,
                email: authUser.email,
                createdAt: new Date().toISOString(),
            };
            setUser(userProfile);
            fetchStrategies();
        } else {
            setUser(null);
            setSavedStrategies([]);
        }
        setIsLoading(false);
    }, [authUser, isAuthenticated, fetchStrategies]);

    // Load settings from localStorage
    useEffect(() => {
        const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (storedSettings) {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
        }
    }, []);

    // Login - delegate to auth store and refresh strategies
    const login = useCallback(async (email: string, password: string) => {
        await authLogin(email, password);
        await fetchStrategies();
    }, [authLogin, fetchStrategies]);

    // Logout - use auth store
    const logout = useCallback(() => {
        authLogout();
    }, [authLogout]);

    // Update user profile
    const updateProfile = useCallback((updates: Partial<UserProfile>) => {
        if (!user) return;
        const updatedUser = { ...user, ...updates };
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
        setUser(updatedUser);
    }, [user]);

    // Save a strategy
    const saveStrategy = useCallback(async (name: string, nodes: any[], edges: any[]) => {
        if (!isAuthenticated) {
            throw new Error("Not authenticated");
        }

        try {
            const response = await api.saveStrategy({
                name,
                nodes,
                edges,
                settings: {},
            });
            await fetchStrategies();
            return { id: response.strategy.id };
        } catch (e) {
            console.error("Failed to save strategy", e);
            throw e;
        }
    }, [isAuthenticated, fetchStrategies]);

    // Delete a strategy
    const deleteStrategy = useCallback(async (id: string) => {
        if (!isAuthenticated) return;
        
        try {
            await api.deleteStrategy(id);
            await fetchStrategies();
        } catch (e) {
            console.error("Failed to delete", e);
        }
    }, [isAuthenticated, fetchStrategies]);

    // Update settings
    const updateSettings = useCallback((updates: Partial<UserSettings>) => {
        const updatedSettings = { ...settings, ...updates };
        setSettings(updatedSettings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
    }, [settings]);

    return {
        user,
        isLoggedIn: isAuthenticated,
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
