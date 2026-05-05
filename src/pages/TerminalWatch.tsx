import TerminalShell from './TerminalShell';
import WatchView from '@/features/terminal/watch/WatchView';

export default function TerminalWatch() {
  return (
    <TerminalShell title="Watchlist" code="WATCH">
      <WatchView />
    </TerminalShell>
  );
}
