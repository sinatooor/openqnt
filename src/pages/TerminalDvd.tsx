import { useParams } from 'react-router-dom';
import TerminalShell from './TerminalShell';
import DvdView from '@/features/terminal/dvd/DvdView';

export default function TerminalDvd() {
  const { ticker } = useParams<{ ticker?: string }>();
  const t = (ticker ?? 'AAPL').toUpperCase();
  return (
    <TerminalShell title={`Dividend — ${t}`} code="DVD">
      <DvdView ticker={t} />
    </TerminalShell>
  );
}
