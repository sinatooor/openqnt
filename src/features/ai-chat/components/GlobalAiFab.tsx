/**
 * GlobalAiFab — bottom-right floating AI button.
 *
 * Always mounted; hides when panel is open. Click → opens the slide-in panel.
 */

import { Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePanelStore } from '../state/panelStore';

export function GlobalAiFab() {
  const open = usePanelStore((s) => s.open);
  const toggle = usePanelStore((s) => s.toggle);

  return (
    <AnimatePresence>
      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          onClick={() => toggle()}
          aria-label="Open AI assistant"
          className="fixed bottom-5 right-5 z-[450] w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 shadow-lg shadow-purple-900/50 flex items-center justify-center group hover-lift"
        >
          <Sparkles className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
          <span className="pointer-events-none absolute right-full mr-3 px-2 py-1 rounded-md bg-black/80 text-[11px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
            AI Assistant
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
