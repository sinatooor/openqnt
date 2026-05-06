/**
 * VoicePanel — slide-down "AI is on the line" surface.
 *
 * Triggered from the OpenQnt FAB. Hosts the live call: levels meter, mute,
 * hang-up. The actual audio plumbing lives in `useGeminiVoice`.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Loader2, AlertCircle, AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeminiVoice, type VoiceCallStatus } from './useGeminiVoice';

interface VoicePanelProps {
    open: boolean;
    onClose: () => void;
    userId: string | null;
    openingMessage?: string;
}

const STATUS_LABEL: Record<VoiceCallStatus, string> = {
    idle: 'Ready',
    requesting_mic: 'Requesting mic…',
    connecting: 'Connecting to AI…',
    live: 'On the line',
    closing: 'Hanging up…',
    closed: 'Call ended',
    error: 'Error',
};

export function VoicePanel({ open, onClose, userId, openingMessage }: VoicePanelProps) {
    const { status, error, speakingLevel, isSpeaking, start, stop, mute, muted } = useGeminiVoice({
        userId,
        openingMessage,
    });

    useEffect(() => {
        if (open && status === 'idle') {
            void start();
        }
        if (!open && (status === 'live' || status === 'connecting')) {
            void stop();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleHangup = async () => {
        await stop();
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="fixed top-4 right-4 z-[460] w-[320px] rounded-xl border border-border/60 bg-popover/95 backdrop-blur shadow-xl shadow-black/30 p-4"
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                isSpeaking
                                    ? 'bg-primary/20 ring-2 ring-primary/60'
                                    : 'bg-muted/50 ring-1 ring-border/60'
                            }`}
                        >
                            {status === 'connecting' || status === 'requesting_mic' ? (
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            ) : status === 'error' ? (
                                <AlertCircle className="w-4 h-4 text-destructive" />
                            ) : (
                                <AudioLines className={`w-4 h-4 ${isSpeaking ? 'text-primary' : 'text-muted-foreground'}`} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">OpenQnt AI</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                                {error ? error : STATUS_LABEL[status]}
                            </div>
                        </div>
                    </div>

                    {/* Level meter */}
                    <div className="mt-3 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            animate={{ width: `${Math.min(100, speakingLevel * 800)}%` }}
                            transition={{ duration: 0.08 }}
                        />
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <Button
                            size="sm"
                            variant={muted ? 'default' : 'outline'}
                            onClick={() => mute(!muted)}
                            className="flex-1 gap-1.5"
                            disabled={status !== 'live'}
                        >
                            {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                            {muted ? 'Unmute' : 'Mute'}
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleHangup}
                            className="flex-1 gap-1.5"
                        >
                            <PhoneOff className="w-3.5 h-3.5" />
                            Hang up
                        </Button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
