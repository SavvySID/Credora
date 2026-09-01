import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { readJson, writeJson } from '@/lib/storage';
import type { Tone } from '@/lib/credit';
import { api, type RecordDto } from '@/services/api';

export type ActivityType =
  | 'wallet_connected'
  | 'credit_score_updated'
  | 'loan_requested'
  | 'loan_approved'
  | 'loan_declined'
  | 'loan_repaid'
  | 'real_time_update'
  | 'transaction';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  amount?: number | null;
  tone?: Tone;
  verified?: boolean;
}

interface ActivityContextValue {
  activities: ActivityItem[];
  record: (item: Omit<ActivityItem, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  clear: () => void;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

const MAX_ITEMS = 60;
const CLIENT_SCOPE = 'activity-client';

function fromRecord(record: RecordDto): ActivityItem | null {
  const verified = record.verification.status === 'verified';
  const base = {
    id: record.recordId,
    timestamp: record.timestamp,
    verified,
  };

  switch (record.eventType) {
    case 'credit_assessment':
      return {
        ...base,
        type: 'credit_score_updated',
        title: 'Credit assessment recorded',
        description: `Score ${record.values.creditScore ?? '—'}/1000`,
        tone: 'brand',
      };
    case 'loan_requested':
      return {
        ...base,
        type: 'loan_requested',
        title: 'Loan requested',
        description: record.txHash ? `Tx ${record.txHash.slice(0, 10)}…` : 'On-chain request',
        tone: 'neutral',
      };
    case 'loan_approved':
      return {
        ...base,
        type: 'loan_approved',
        title: 'Loan recorded on-chain',
        description: record.txHash
          ? `Accounting principal on Loan.sol. Tx ${record.txHash.slice(0, 10)}…`
          : 'Accounting principal recorded on Loan.sol',
        tone: 'positive',
      };
    case 'loan_repaid':
      return {
        ...base,
        type: 'loan_repaid',
        title: 'Loan repaid',
        description: record.txHash ? `Tx ${record.txHash.slice(0, 10)}…` : 'On-chain repayment',
        tone: 'positive',
      };
    case 'wallet_transaction':
      return {
        ...base,
        type: 'transaction',
        title: 'Wallet transaction',
        description: record.txHash ? `Tx ${record.txHash.slice(0, 10)}…` : 'On-chain transfer',
        tone: 'neutral',
      };
    default:
      return null;
  }
}

export function ActivityProvider({
  wallet,
  children,
}: {
  wallet: string | null;
  children: ReactNode;
}) {
  const [indexed, setIndexed] = useState<ActivityItem[]>([]);
  const [clientEvents, setClientEvents] = useState<ActivityItem[]>([]);
  const walletRef = useRef<string | null>(wallet);

  useEffect(() => {
    walletRef.current = wallet;
    setClientEvents(wallet ? readJson<ActivityItem[]>(CLIENT_SCOPE, wallet, []) : []);
    setIndexed([]);

    if (!wallet) return;

    let cancelled = false;
    void api
      .walletRecords(wallet, undefined, 60)
      .then(({ records }) => {
        if (cancelled) return;
        setIndexed(records.map(fromRecord).filter((item): item is ActivityItem => item !== null));
      })
      .catch(() => {
        if (!cancelled) setIndexed([]);
      });

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const record = useCallback<ActivityContextValue['record']>((item) => {
    setClientEvents((prev) => {
      const isDuplicate = prev.some(
        (existing) =>
          existing.type === item.type &&
          existing.title === item.title &&
          existing.description === item.description,
      );
      if (isDuplicate) return prev;

      const next: ActivityItem[] = [
        {
          ...item,
          id: `client-${Date.now()}`,
          timestamp: item.timestamp ?? new Date().toISOString(),
          verified: item.verified === true,
        },
        ...prev,
      ].slice(0, MAX_ITEMS);

      writeJson(CLIENT_SCOPE, walletRef.current, next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setClientEvents([]);
    writeJson(CLIENT_SCOPE, walletRef.current, []);
  }, []);

  const activities = useMemo(() => {
    const byId = new Map<string, ActivityItem>();
    [...indexed, ...clientEvents].forEach((item) => {
      const existing = byId.get(item.id);
      if (!existing || (item.verified && !existing.verified)) byId.set(item.id, item);
    });

    return [...byId.values()]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_ITEMS);
  }, [indexed, clientEvents]);

  const value = useMemo(() => ({ activities, record, clear }), [activities, record, clear]);

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) throw new Error('useActivity must be used within an ActivityProvider');
  return context;
}
