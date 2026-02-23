/**
 * Auth Store (Zustand)
 * Manages JWT tokens, user state, and auth lifecycle.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../services/api';

interface User {
    id: string;
    email: string;
    name: string;
    subscriptionTier: string;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string, name: string) => Promise<void>;
    logout: () => void;
    refreshSession: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,

            login: async (email: string, password: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Login failed');

                    set({
                        user: data.user,
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            register: async (email: string, password: string, name: string) => {
                set({ isLoading: true, error: null });
                try {
                    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password, name }),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Registration failed');

                    set({
                        user: data.user,
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            logout: () => {
                const { accessToken } = get();
                // Fire-and-forget logout call
                if (accessToken) {
                    fetch(`${API_BASE_URL}/api/auth/logout`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }).catch(() => { });
                }
                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    error: null,
                });
            },

            refreshSession: async () => {
                const { refreshToken } = get();
                if (!refreshToken) return;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ refreshToken }),
                    });
                    const data = await response.json();
                    if (!response.ok) {
                        get().logout();
                        return;
                    }
                    set({ accessToken: data.accessToken });
                } catch {
                    get().logout();
                }
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: 'strategyflow-auth',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

/**
 * Get the current access token for API calls.
 * Injected into the API client via header.
 */
export function getAuthHeaders(): Record<string, string> {
    const token = useAuthStore.getState().accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
}
