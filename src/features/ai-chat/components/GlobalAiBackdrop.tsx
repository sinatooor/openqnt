/**
 * GlobalAiBackdrop — subtle dim+blur behind the panel.
 *
 * Non-modal: pointer-events: none so the page behind stays interactive.
 * (Trading-app workflow needs that — drag a node onto the canvas while panel
 * is open.)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { usePanelStore } from '../state/panelStore';

export function GlobalAiBackdrop() {
  const open = usePanelStore((s) => s.open);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[400] pointer-events-none bg-black/30 backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
}
