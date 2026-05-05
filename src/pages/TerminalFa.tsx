import { useParams } from 'react-router-dom';
import TerminalShell from './TerminalShell';
import FaView from '@/features/terminal/fa/FaView';

export default function TerminalFa() {
  const { ticker } = useParams<{ ticker?: string }>();
  const t = (ticker ?? 'AAPL').toUpperCase();
  return (
    <TerminalShell title={`Financial Analysis — ${t}`} code="FA">
      <FaView ticker={t} />
    </TerminalShell>
  );
}
