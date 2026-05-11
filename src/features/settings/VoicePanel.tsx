/**
 * Settings → Voice panel — thin wrapper that re-exports the existing
 * VoiceTab component so it can live inside Settings.
 *
 * VoiceTab reads/writes the FastAPI voice router at /api/voice/* and handles
 * phone-number setup, voice-trading toggle, iOS pairing, and call history.
 */
import { VoiceTab } from '@/features/strategy-flow/components/modals/VoiceTab';
import { useAuthStore } from '@/stores/authStore';

export function VoicePanel() {
  const { user } = useAuthStore();
  return <VoiceTab userId={user?.id ?? null} />;
}
