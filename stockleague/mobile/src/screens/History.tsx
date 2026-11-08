import { ScreenHeader } from '../components/ui';
import { useStore } from '../state/store';
import { TransactionList } from './PortfolioTab';

export function HistoryScreen() {
  const { transactions } = useStore();
  return (
    <div className="pb-10">
      <ScreenHeader title="Historique des ordres" />
      <div className="px-4 pt-4"><TransactionList items={transactions} /></div>
    </div>
  );
}
