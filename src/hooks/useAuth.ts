/**
 * useAuth hook — convenience hook wrapping the auth store.
 * Provides auth state + auto-redirect for protected routes.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export function useAuth(options: { requireAuth?: boolean; redirectTo?: string } = {}) {
    const { requireAuth = false, redirectTo = '/login' } = options;
    const store = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (requireAuth && !store.isAuthenticated) {
            navigate(redirectTo);
        }
    }, [requireAuth, store.isAuthenticated, redirectTo, navigate]);

    // Auto-refresh token when it's about to expire
    useEffect(() => {
        if (!store.isAuthenticated || !store.accessToken) return;

        // Try to decode JWT to check expiry
        try {
            const payload = JSON.parse(atob(store.accessToken.split('.')[1]));
            const expiresAt = payload.exp * 1000;
            const refreshAt = expiresAt - 60_000; // Refresh 1 minute before expiry
            const now = Date.now();

            if (refreshAt > now) {
                const timer = setTimeout(() => {
                    store.refreshSession();
                }, refreshAt - now);
                return () => clearTimeout(timer);
            } else if (now < expiresAt) {
                // Less than 1 min left, refresh now
                store.refreshSession();
            }
        } catch {
            // Invalid token format, skip auto-refresh
        }
    }, [store.accessToken]);

    return {
        user: store.user,
        isAuthenticated: store.isAuthenticated,
        isLoading: store.isLoading,
        error: store.error,
        login: store.login,
        register: store.register,
        logout: store.logout,
        clearError: store.clearError,
    };
}
