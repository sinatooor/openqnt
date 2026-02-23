/**
 * Notification Store (Zustand)
 * Manages notification state and unread counts.
 */

import { create } from 'zustand';
import { api } from '../services/api';
import { getAuthHeaders } from './authStore';

interface Notification {
    id: string;
    channel: string;
    type: string;
    title: string;
    body: string;
    read: boolean;
    sentAt: string;
    readAt: string | null;
    metadata: any;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;

    // Actions
    fetchNotifications: (params?: { page?: number; unread?: boolean }) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,

    fetchNotifications: async (params = {}) => {
        set({ isLoading: true });
        try {
            const query = new URLSearchParams();
            if (params.page) query.set('page', String(params.page));
            if (params.unread) query.set('unread', 'true');

            const data = await api.get<any>(`/api/notifications?${query}`, {
                headers: getAuthHeaders(),
            });
            set({
                notifications: data.notifications,
                unreadCount: data.unreadCount,
                isLoading: false,
            });
        } catch {
            set({ isLoading: false });
        }
    },

    markAsRead: async (notificationId: string) => {
        try {
            await api.put(`/api/notifications/${notificationId}/read`, undefined, {
                headers: getAuthHeaders(),
            });
            const { notifications } = get();
            set({
                notifications: notifications.map((n) =>
                    n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
                ),
                unreadCount: Math.max(0, get().unreadCount - 1),
            });
        } catch { /* silent */ }
    },

    markAllAsRead: async () => {
        try {
            await api.put('/api/notifications/read-all', undefined, {
                headers: getAuthHeaders(),
            });
            set({
                notifications: get().notifications.map((n) => ({ ...n, read: true })),
                unreadCount: 0,
            });
        } catch { /* silent */ }
    },

    addNotification: (notification: Notification) => {
        set({
            notifications: [notification, ...get().notifications],
            unreadCount: get().unreadCount + 1,
        });
    },
}));
