import TerminalShell from './TerminalShell';
import TopView from '@/features/terminal/top/TopView';

export default function TerminalTop() {
  return (
    <TerminalShell title="Top Stories" code="TOP">
      <TopView />
    </TerminalShell>
  );
}
