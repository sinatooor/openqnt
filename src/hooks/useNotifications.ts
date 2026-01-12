/**
 * useNotifications - Custom hook for notification history management
 * Captures toast notifications and provides persistent history
 */

import { useState, useEffect, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'trade';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    description?: string;
    timestamp: Date;
    read: boolean;
}

const STORAGE_KEY = 'ppm_notifications';
const MAX_NOTIFICATIONS = 50;

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored).map((n: any) => ({
                    ...n,
                    timestamp: new Date(n.timestamp)
                }));
                setNotifications(parsed);
            }
        } catch (e) {
            console.warn('Failed to load notifications', e);
        }
    }, []);

    // Persist to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
        } catch (e) {
            console.warn('Failed to save notifications', e);
        }
    }, [notifications]);

    const addNotification = useCallback((
        type: NotificationType,
        title: string,
        description?: string
    ) => {
        const newNotification: Notification = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type,
            title,
            description,
            timestamp: new Date(),
            read: false
        };

        setNotifications(prev => {
            const updated = [newNotification, ...prev];
            // Limit to MAX_NOTIFICATIONS
            return updated.slice(0, MAX_NOTIFICATIONS);
        });

        return newNotification.id;
    }, []);

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev =>
            prev.map(n => ({ ...n, read: true }))
        );
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const clearRead = useCallback(() => {
        setNotifications(prev => prev.filter(n => !n.read));
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const getByType = useCallback((type: NotificationType) => {
        return notifications.filter(n => n.type === type);
    }, [notifications]);

    return {
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        clearRead,
        getByType
    };
};

export default useNotifications;
