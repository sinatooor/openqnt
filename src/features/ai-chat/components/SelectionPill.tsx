/**
 * SelectionPill — floating "✨ Ask AI" pill that appears near a text selection.
 *
 * Skips form fields and contenteditable inputs to avoid hijacking copy.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote } from 'lucide-react';
import { usePanelStore } from '../state/panelStore';

interface PillState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
}

const isInForm = (node: Node | null): boolean => {
  let cur: Node | null = node;
  while (cur && cur instanceof HTMLElement) {
    const tag = cur.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if ((cur as HTMLElement).isContentEditable) return true;
    cur = cur.parentNode;
  }
  return false;
};

export function SelectionPill() {
  const [state, setState] = useState<PillState>({
    visible: false,
    x: 0,
    y: 0,
    text: '',
  });
  const openWithMessage = usePanelStore((s) => s.openWithMessage);

  useEffect(() => {
    let raf: number | null = null;

    const handle = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setState((s) => (s.visible ? { ...s, visible: false } : s));
          return;
        }
        const text = sel.toString().trim();
        if (text.length < 6 || text.length > 4000) {
          setState((s) => (s.visible ? { ...s, visible: false } : s));
          return;
        }
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (isInForm(node)) {
          setState((s) => (s.visible ? { ...s, visible: false } : s));
          return;
        }
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setState((s) => (s.visible ? { ...s, visible: false } : s));
          return;
        }
        // Position above the selection, clamped to viewport
        const x = Math.max(8, Math.min(window.innerWidth - 130, rect.left + rect.width / 2 - 60));
        const y = Math.max(8, rect.top - 36);
        setState({ visible: true, x, y, text });
      });
    };

    document.addEventListener('selectionchange', handle);
    document.addEventListener('mouseup', handle);
    document.addEventListener('keyup', handle);
    return () => {
      document.removeEventListener('selectionchange', handle);
      document.removeEventListener('mouseup', handle);
      document.removeEventListener('keyup', handle);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const onClick = () => {
    const prompt = `Selected text:\n\n"${state.text}"\n\nWhat would you like to know about this?`;
    openWithMessage(prompt);
    setState((s) => ({ ...s, visible: false }));
  };

  return (
    <AnimatePresence>
      {state.visible && (
        <motion.button
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(e) => {
            // Prevent the click from collapsing the selection before we read it
            e.preventDefault();
          }}
          onClick={onClick}
          style={{ left: state.x, top: state.y }}
          className="fixed z-[460] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-popover hover:bg-accent text-foreground text-[12px] font-medium shadow-lg shadow-black/30 ring-1 ring-border/60 backdrop-blur"
        >
          <Quote className="w-3.5 h-3.5" />
          <span>Ask AI</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
