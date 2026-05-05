import { useParams } from 'react-router-dom';
import TerminalShell from './TerminalShell';
import NView from '@/features/terminal/n/NView';

export default function TerminalN() {
  const { ticker } = useParams<{ ticker?: string }>();
  const t = (ticker ?? 'AAPL').toUpperCase();
  return (
    <TerminalShell title={`News — ${t}`} code="N">
      <NView ticker={t} />
    </TerminalShell>
  );
}
