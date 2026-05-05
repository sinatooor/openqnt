/**
 * GlobalAiFab — bottom-right floating AI button.
 *
 * Renders the OpenQnt brand glyph as an interactive halftone: dots are
 * placed only where the SVG strokes are opaque, and as the cursor moves
 * near the button each dot expands toward the cursor with an eased
 * radial falloff. Hidden when the slide-in panel is open.
 *
 * Visual config follows the spec the design team handed over:
 *   · Grid density 40 — tighter dot grid (≈40 dots per side).
 *   · Base radius 1   — small at rest.
 *   · Range 99        — moderately wide hover field.
 *   · Expansion 1.5×  — subtle wave, not distortion.
 *
 * Day variant (electric blue on off-white) for the light theme;
 * night variant (electric orange on charcoal) for everything else.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePanelStore } from '../state/panelStore';
import { useTheme } from '@/contexts/ThemeContext';

const DAY_BG = '#f7f9fb';
const DAY_FG = '#003ec7';
const NIGHT_BG = '#191c1e';
const NIGHT_FG = '#FF630F';

/* Halftone — values per design spec, expressed in canvas pixel units */
const CANVAS_SIZE = 192;     // 4× of the 48px CSS button for retina + density
const GRID_DENSITY = 40;     // ~40 dots per side
const SPACING = CANVAS_SIZE / GRID_DENSITY; // 4.8px — tight grid
const BASE_RADIUS = 1.5;
const HOVER_RADIUS = BASE_RADIUS * 1.5;     // 1.5× expansion
const HOVER_DISTANCE = 99;
const ALPHA_THRESHOLD = 80;
/* SVG geometry from /assets/logo-day.svg + logo-night.svg */
const STROKE_W = 20;

interface Dot {
    x: number;
    y: number;
    currentR: number;
    targetR: number;
}

function buildDots(fg: string): Dot[] {
    const off = document.createElement('canvas');
    off.width = CANVAS_SIZE;
    off.height = CANVAS_SIZE;
    const ctx = off.getContext('2d');
    if (!ctx) return [];

    const scale = CANVAS_SIZE / 120; // SVG viewBox is 120

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.strokeStyle = fg;
    ctx.lineCap = 'square';
    ctx.lineWidth = STROKE_W * scale;

    // Circle: cx=50 cy=50 r=32
    ctx.beginPath();
    ctx.arc(50 * scale, 50 * scale, 32 * scale, 0, Math.PI * 2);
    ctx.stroke();

    // Diagonal tail: 62,62 → 90,90
    ctx.beginPath();
    ctx.moveTo(62 * scale, 62 * scale);
    ctx.lineTo(90 * scale, 90 * scale);
    ctx.stroke();

    const data = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    const dots: Dot[] = [];
    for (let y = SPACING / 2; y < CANVAS_SIZE; y += SPACING) {
        for (let x = SPACING / 2; x < CANVAS_SIZE; x += SPACING) {
            const ix = (Math.floor(y) * CANVAS_SIZE + Math.floor(x)) * 4;
            const alpha = data[ix + 3];
            if (alpha > ALPHA_THRESHOLD) {
                dots.push({
                    x,
                    y,
                    currentR: BASE_RADIUS,
                    targetR: BASE_RADIUS,
                });
            }
        }
    }
    return dots;
}

interface HalftoneCanvasProps {
    bg: string;
    fg: string;
}

const HalftoneCanvas = ({ bg, fg }: HalftoneCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dotsRef = useRef<Dot[]>([]);
    const mouseRef = useRef({ x: -9999, y: -9999, inside: false });
    const rafRef = useRef<number | null>(null);

    /* Build dot grid whenever the foreground changes (theme switch). */
    useEffect(() => {
        dotsRef.current = buildDots(fg);
    }, [fg]);

    /* Track cursor globally so the halftone reacts as the mouse approaches
       the button — not only after it crosses the bounding box. The window
       handler converts page coords into canvas (internal) coords. */
    useEffect(() => {
        const handleMove = (e: MouseEvent) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = CANVAS_SIZE / rect.width;
            const scaleY = CANVAS_SIZE / rect.height;
            mouseRef.current.x = (e.clientX - rect.left) * scaleX;
            mouseRef.current.y = (e.clientY - rect.top) * scaleY;
            mouseRef.current.inside =
                e.clientX >= rect.left - HOVER_DISTANCE / scaleX &&
                e.clientX <= rect.right + HOVER_DISTANCE / scaleX &&
                e.clientY >= rect.top - HOVER_DISTANCE / scaleY &&
                e.clientY <= rect.bottom + HOVER_DISTANCE / scaleY;
        };
        window.addEventListener('mousemove', handleMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMove);
    }, []);

    /* Animation loop — eased radial falloff toward the cursor. */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const tick = () => {
            ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            const m = mouseRef.current;
            const baseFill = fg;

            for (const dot of dotsRef.current) {
                const dx = m.x - dot.x;
                const dy = m.y - dot.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < HOVER_DISTANCE) {
                    const norm = 1 - dist / HOVER_DISTANCE;
                    const ease = Math.sin(norm * (Math.PI / 2));
                    dot.targetR = BASE_RADIUS + (HOVER_RADIUS - BASE_RADIUS) * ease;
                } else {
                    dot.targetR = BASE_RADIUS;
                }

                // Smooth lerp toward the target radius
                dot.currentR += (dot.targetR - dot.currentR) * 0.18;

                ctx.beginPath();
                ctx.arc(dot.x, dot.y, dot.currentR, 0, Math.PI * 2);
                ctx.fillStyle = baseFill;
                ctx.fill();
            }

            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [bg, fg]);

    return (
        <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="absolute inset-0 w-full h-full"
            aria-hidden
        />
    );
};

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
                    aria-label="AI quant"
                    className="group fixed bottom-5 right-5 z-[450] w-12 h-12 rounded-full ring-1 ring-foreground/10 shadow-lg shadow-black/20 hover:shadow-black/30 transition-shadow flex items-center justify-center"
                >
                    {/* Round-clip wrapper for the canvas — kept on the inner
                       element so the tooltip can escape the button bounds
                       without being cropped. */}
                    <span className="absolute inset-0 rounded-full overflow-hidden">
                        {/* Halftone canvas — masks the OpenQnt glyph as dots
                           that expand toward the cursor with an eased
                           falloff. */}
                        <HalftoneCanvas bg={bg} fg={fg} />
                    </span>

                    {/* Inset ring keeps the round mask reading as a button */}
                    <span
                        aria-hidden
                        className="absolute inset-0 rounded-full pointer-events-none ring-1 ring-inset ring-foreground/10 group-hover:ring-foreground/25 transition-shadow"
                    />

                    {/* Online dot */}
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background z-10" />

                    {/* Tooltip — sits outside the round-clipped area */}
                    <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 rounded-md bg-popover text-popover-foreground text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-border/60 z-10">
                        AI quant
                    </span>
                </motion.button>
            )}
        </AnimatePresence>
    );
}
