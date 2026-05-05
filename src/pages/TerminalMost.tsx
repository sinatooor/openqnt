import TerminalShell from './TerminalShell';
import MostView from '@/features/terminal/most/MostView';

export default function TerminalMost() {
  return (
    <TerminalShell title="Movers" code="MOST">
      <MostView />
    </TerminalShell>
  );
}
