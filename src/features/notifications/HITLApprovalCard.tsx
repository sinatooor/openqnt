/**
 * HITL Approval Card — inline card for human-in-the-loop trade approvals.
 * Shows trade details and approve/reject buttons.
 */

import { useState } from 'react';
import { api } from '../../services/api';

interface HITLApprovalProps {
    executionId: string;
    strategyName: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
    reasoning?: string;
    timestamp: string;
    onDecision?: (action: 'approve' | 'reject') => void;
}

export const HITLApprovalCard = ({
    executionId,
    strategyName,
    symbol,
    side,
    quantity,
    price,
    reasoning,
    timestamp,
    onDecision,
}: HITLApprovalProps) => {
    const [decided, setDecided] = useState<'approve' | 'reject' | null>(null);
    const [loading, setLoading] = useState(false);

    const handleDecision = async (action: 'approve' | 'reject') => {
        setLoading(true);
        try {
            await api.post(`/api/webhooks/hitl/${executionId}`, {
                action,
                userId: null, // Will be inferred from JWT
            });
            setDecided(action);
            onDecision?.(action);
        } catch {
            // silent
        }
        setLoading(false);
    };

    return (
        <div style={{ ...styles.card, borderColor: decided === 'approve' ? '#22c55e' : decided === 'reject' ? '#ef4444' : 'rgba(139,92,246,0.3)' }}>
            {/* Header */}
            <div style={styles.header}>
                <span style={styles.hitlBadge}>⏳ HITL Approval Required</span>
                <span style={styles.time}>{new Date(timestamp).toLocaleTimeString()}</span>
            </div>

            {/* Trade Details */}
            <div style={styles.details}>
                <div style={styles.strategy}>{strategyName}</div>
                <div style={styles.trade}>
                    <span style={{ ...styles.sideBadge, background: side === 'buy' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: side === 'buy' ? '#22c55e' : '#ef4444' }}>
                        {side.toUpperCase()}
                    </span>
                    <span style={styles.symbol}>{symbol}</span>
                    <span style={styles.qty}>× {quantity}</span>
                    {price && <span style={styles.price}>@ ${price.toFixed(2)}</span>}
                </div>
                {reasoning && (
                    <div style={styles.reasoning}>
                        <span style={styles.reasonLabel}>📝 AI Reasoning:</span>
                        <p style={styles.reasonText}>{reasoning}</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            {decided ? (
                <div style={{ ...styles.decided, color: decided === 'approve' ? '#22c55e' : '#f87171' }}>
                    {decided === 'approve' ? '✓ Approved' : '✗ Rejected'}
                </div>
            ) : (
                <div style={styles.actions}>
                    <button
                        style={styles.rejectBtn}
                        onClick={() => handleDecision('reject')}
                        disabled={loading}
                    >
                        ✗ Reject
                    </button>
                    <button
                        style={styles.approveBtn}
                        onClick={() => handleDecision('approve')}
                        disabled={loading}
                    >
                        ✓ Approve Trade
                    </button>
                </div>
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    card: {
        padding: 20, background: 'rgba(15,15,30,0.8)', backdropFilter: 'blur(12px)',
        border: '2px solid', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transition: 'border-color 0.3s',
    },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    hitlBadge: {
        padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
        background: 'rgba(139,92,246,0.15)', color: '#c4b5fd',
    },
    time: { fontSize: 11, color: '#64748b' },
    details: { marginBottom: 16 },
    strategy: { fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 },
    trade: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
    sideBadge: { padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 },
    symbol: { fontSize: 16, fontWeight: 700, color: '#e2e8f0' },
    qty: { fontSize: 13, color: '#94a3b8' },
    price: { fontSize: 13, color: '#a78bfa' },
    reasoning: {
        padding: 10, background: 'rgba(30,30,60,0.4)', borderRadius: 8,
        border: '1px solid rgba(100,116,139,0.1)',
    },
    reasonLabel: { fontSize: 11, fontWeight: 600, color: '#94a3b8' },
    reasonText: { fontSize: 12, color: '#e2e8f0', margin: '4px 0 0', lineHeight: 1.5 },
    actions: { display: 'flex', gap: 8 },
    rejectBtn: {
        flex: 1, padding: '10px 0', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8,
        background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.2s',
    },
    approveBtn: {
        flex: 2, padding: '10px 0', border: 'none', borderRadius: 8,
        background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
        fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
        boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
    },
    decided: { textAlign: 'center', fontSize: 14, fontWeight: 600, padding: '8px 0' },
};

export default HITLApprovalCard;
