/**
 * GlobalAiFab — bottom-right floating AI button.
 *
 * Always mounted; hides when the panel is open. Click → opens the slide-in
 * panel. Wears the OpenQnt brand glyph (circle + tail) over a halftone dot
 * overlay; the dots brighten on hover. Day variant (blue on off-white) is
 * used for the light theme; night variant (electric orange on charcoal)
 * for everything else.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { usePanelStore } from '../state/panelStore';
import { useTheme } from '@/contexts/ThemeContext';

const DAY_BG = '#f7f9fb';
const DAY_FG = '#003ec7';
const NIGHT_BG = '#191c1e';
const NIGHT_FG = '#FF630F';

function LogoGlyph({ bg, fg }: { bg: string; fg: string }) {
  return (
    <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full">
      <rect width="120" height="120" fill={bg} />
      <circle cx="50" cy="50" r="32" fill="none" stroke={fg} strokeWidth="20" />
      <line
        x1="62"
        y1="62"
        x2="90"
        y2="90"
        stroke={fg}
        strokeWidth="20"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function GlobalAiFab() {
  const open = usePanelStore((s) => s.open);
  const toggle = usePanelStore((s) => s.toggle);
  const { resolvedTheme } = useTheme();

  const isLight = resolvedTheme === 'light';
  const bg = isLight ? DAY_BG : NIGHT_BG;
  const fg = isLight ? DAY_FG : NIGHT_FG;

  return (
    <AnimatePresence>
      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          onClick={() => toggle()}
          aria-label="Open OpenQnt AI"
          className="group fixed bottom-5 right-5 z-[450] w-12 h-12 rounded-full overflow-hidden ring-1 ring-foreground/10 shadow-lg shadow-black/20 hover:shadow-black/30 transition-shadow flex items-center justify-center"
        >
          {/* Brand glyph as the FAB face */}
          <LogoGlyph bg={bg} fg={fg} />

          {/* Halftone dot overlay — feathered at rest, sharper on hover */}
          <span
            aria-hidden
            className="absolute inset-0 pointer-events-none transition-opacity duration-200 opacity-40 group-hover:opacity-90"
            style={{
              backgroundImage: `radial-gradient(circle, ${fg} 0.9px, transparent 1.4px)`,
              backgroundSize: '4px 4px',
              mixBlendMode: 'multiply',
            }}
          />

          {/* Soft inward shading so the round mask reads as a button */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none ring-1 ring-inset ring-foreground/10 transition-[ring] group-hover:ring-foreground/20"
          />

          {/* Online dot */}
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />

          {/* Tooltip */}
          <span className="pointer-events-none absolute right-full mr-3 px-2 py-1 rounded-md bg-popover text-popover-foreground text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-border/60">
            OpenQnt AI
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
