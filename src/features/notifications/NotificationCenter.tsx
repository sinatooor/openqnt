/**
 * Notification Center — dropdown panel showing recent notifications.
 * Integrates with notificationStore and WebSocket for live updates.
 */

import { useEffect, useState } from 'react';
import { useNotificationStore } from '../../stores/notificationStore';

interface NotificationCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationCenter = ({ isOpen, onClose }: NotificationCenterProps) => {
    const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();

    useEffect(() => {
        if (isOpen) fetchNotifications();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>
                        🔔 Notifications
                        {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
                    </h3>
                    <div style={styles.headerActions}>
                        {unreadCount > 0 && (
                            <button style={styles.markAllBtn} onClick={markAllAsRead}>Mark all read</button>
                        )}
                        <button style={styles.closeBtn} onClick={onClose}>✕</button>
                    </div>
                </div>

                <div style={styles.list}>
                    {notifications.length === 0 ? (
                        <div style={styles.empty}>
                            <span style={{ fontSize: 32 }}>🔕</span>
                            <p>No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                style={{ ...styles.item, ...(notif.read ? {} : styles.itemUnread) }}
                                onClick={() => !notif.read && markAsRead(notif.id)}
                            >
                                <div style={styles.itemHeader}>
                                    <span style={{ ...styles.typeBadge, ...getTypeStyle(notif.type) }}>{notif.type}</span>
                                    <span style={styles.time}>{formatTime(notif.sentAt)}</span>
                                </div>
                                <div style={styles.itemTitle}>{notif.title}</div>
                                <div style={styles.itemBody}>{notif.body}</div>
                                {!notif.read && <div style={styles.unreadDot} />}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

function getTypeStyle(type: string): React.CSSProperties {
    switch (type) {
        case 'alert': return { background: 'rgba(234,179,8,0.15)', color: '#fbbf24' };
        case 'trade_executed': return { background: 'rgba(34,197,94,0.15)', color: '#22c55e' };
        case 'hitl_request': return { background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' };
        case 'system': return { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' };
        default: return { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
    }
}

function formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.3)',
    },
    panel: {
        position: 'absolute', top: 60, right: 20, width: 380, maxHeight: 'calc(100vh - 100px)',
        background: 'rgba(15,15,30,0.95)', backdropFilter: 'blur(24px)',
        border: '1px solid rgba(139,92,246,0.15)', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' as const,
        overflow: 'hidden',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid rgba(100,116,139,0.1)',
    },
    title: { fontSize: 15, fontWeight: 600, color: '#e2e8f0', margin: 0, display: 'flex', alignItems: 'center', gap: 8 },
    badge: {
        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
        background: '#ef4444', color: '#fff',
    },
    headerActions: { display: 'flex', gap: 8, alignItems: 'center' },
    markAllBtn: {
        background: 'none', border: 'none', color: '#a78bfa', fontSize: 11, cursor: 'pointer',
    },
    closeBtn: {
        background: 'none', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer',
    },
    list: { flex: 1, overflowY: 'auto' as const, padding: '8px 0' },
    empty: { textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 },
    item: {
        position: 'relative' as const, padding: '12px 20px',
        borderBottom: '1px solid rgba(100,116,139,0.05)', cursor: 'pointer',
        transition: 'background 0.15s',
    },
    itemUnread: { background: 'rgba(139,92,246,0.04)' },
    itemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    typeBadge: { padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 },
    time: { fontSize: 10, color: '#64748b' },
    itemTitle: { fontSize: 13, fontWeight: 500, color: '#e2e8f0', marginBottom: 2 },
    itemBody: { fontSize: 12, color: '#94a3b8', lineHeight: 1.4 },
    unreadDot: {
        position: 'absolute' as const, top: 16, left: 8, width: 6, height: 6,
        borderRadius: 3, background: '#8b5cf6',
    },
};

export default NotificationCenter;
