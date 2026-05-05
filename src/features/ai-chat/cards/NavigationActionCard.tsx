/**
 * NavigationActionCard — clickable action button (e.g., "Go to Backtest").
 *
 * Renders inline in assistant messages when the AI emits an `action` event.
 */

import { motion } from 'framer-motion';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  payload: {
    action: string;
    data: { route?: string; page?: string; reason?: string };
  };
}

export function NavigationActionCard({ payload }: Props) {
  const navigate = useNavigate();
  if (payload.action !== 'navigate') return null;
  const { route, page, reason } = payload.data;
  if (!route) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(route)}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 hover:bg-blue-500/10 transition-colors mt-1 w-full text-left"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      <span>Go to {page ?? route}</span>
      {reason && <span className="text-white/30">— {reason}</span>}
      <ChevronRight className="w-3 h-3 ml-auto" />
    </motion.button>
  );
}
