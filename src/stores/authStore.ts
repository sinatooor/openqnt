/**
 * Auth Store (Zustand)
 * Manages JWT tokens, user state, and auth lifecycle.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../services/api';
import { isDesktop } from '../lib/runtimeConfig';

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

// Seed an offline "local" user so the app's auth gates unblock immediately
// in two cases:
//   - desktop build: only one user, no real login server reachable
//   - Vite dev mode: orchestrator skips auth and the frontend doesn't have
//     a working login UI to walk through
// In the production web build (DEV=false, isDesktop=false) the user MUST
// sign in through the orchestrator.
const SHOULD_AUTOLOGIN =
    isDesktop() ||
    Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

const DESKTOP_LOCAL_USER: User = {
    id: 'local-user',
    email: 'you@openqnt.local',
    name: 'You',
    subscriptionTier: 'pro',
};

const initialAuth = SHOULD_AUTOLOGIN
    ? {
        user: DESKTOP_LOCAL_USER,
        accessToken: 'desktop-local',
        refreshToken: null,
        isAuthenticated: true,
    }
    : {
        user: null as User | null,
        accessToken: null as string | null,
        refreshToken: null as string | null,
        isAuthenticated: false,
    };

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            ...initialAuth,
            isLoading: false,
            error: null,

            login: async (email: string, password: string) => {
                // Mock login — only available in Vite dev mode, never in production builds
                if (import.meta.env.DEV && email === 'test@example.com' && password === 'test@example.com') {
                    console.warn('[Auth] Using mock login — dev mode only');
                    const mockUser = {
                        id: 'test-user-1',
                        email: 'test@example.com',
                        name: 'Test User',
                        subscriptionTier: 'pro',
                    };
                    const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJpYXQiOjE3MzY3ODAwMDAsImV4cCI6MTczNjc4MzYwMH0.mock';
                    set({
                        user: mockUser,
                        accessToken: mockToken,
                        refreshToken: 'mock-refresh-token',
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    return;
                }

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
            // After rehydration: in desktop / dev mode, force the local-user
            // state even if a stale `isAuthenticated: false` was persisted
            // from a previous failed login attempt.
            onRehydrateStorage: () => (state) => {
                if (state && SHOULD_AUTOLOGIN && !state.isAuthenticated) {
                    state.user = DESKTOP_LOCAL_USER;
                    state.accessToken = 'desktop-local';
                    state.isAuthenticated = true;
                }
            },
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
