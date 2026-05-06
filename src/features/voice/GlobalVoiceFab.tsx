/**
 * GlobalVoiceFab — companion to the OpenQnt AI quant FAB.
 *
 * Sits just above the existing FAB (which is at bottom-right). One tap opens
 * a slide-down VoicePanel that mints a /web-session and bridges browser mic ↔
 * Gemini Live via the FastAPI WebSocket bridge.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { VoicePanel } from './VoicePanel';

export function GlobalVoiceFab() {
    const [open, setOpen] = useState(false);
    const user = useAuthStore((s) => s.user);
    const userId = user?.id ?? null;

    return (
        <>
            <AnimatePresence>
                {!open && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                        onClick={() => setOpen(true)}
                        aria-label="Talk to AI"
                        className="group fixed bottom-[76px] right-5 z-[450] w-10 h-10 rounded-full bg-primary text-primary-foreground ring-1 ring-foreground/10 shadow-lg shadow-black/20 hover:shadow-black/30 hover:scale-105 transition-all flex items-center justify-center"
                    >
                        <Mic className="w-4 h-4" />
                        <span className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 px-2 py-1 rounded-md bg-popover text-popover-foreground text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md border border-border/60">
                            Talk to AI
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>
            <VoicePanel
                open={open}
                onClose={() => setOpen(false)}
                userId={userId}
                openingMessage="Hi — what would you like to look at?"
            />
        </>
    );
}
