import TerminalShell from './TerminalShell';
import EqsView from '@/features/terminal/eqs/EqsView';

export default function TerminalEqs() {
  return (
    <TerminalShell title="Equity Screener" code="EQS">
      <EqsView />
    </TerminalShell>
  );
}
