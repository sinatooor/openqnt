import { useParams } from 'react-router-dom';
import TerminalShell from './TerminalShell';
import RvView from '@/features/terminal/rv/RvView';

export default function TerminalRv() {
  const { ticker } = useParams<{ ticker?: string }>();
  const t = (ticker ?? 'AAPL').toUpperCase();
  return (
    <TerminalShell title={`Relative Value — ${t}`} code="RV">
      <RvView ticker={t} />
    </TerminalShell>
  );
}
