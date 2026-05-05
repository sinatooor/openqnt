import BacktestPanel from '@/features/backtest/BacktestPanel';
import { usePageContext } from '@/features/ai-chat';

export default function BacktestPage() {
  usePageContext({ page: 'backtest' });
  return <BacktestPanel />;
}
