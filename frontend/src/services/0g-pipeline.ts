import { publicConfig } from './0g-config';

export interface PipelineEvent {
  type: string;
  wallet: string;
  timestamp: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface CreditScoreUpdateEvent extends PipelineEvent {
  type: 'credit_score_update';
  data: {
    creditScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    confidence: number;
    factors: unknown[];
  };
}

export interface TransactionUpdateEvent extends PipelineEvent {
  type: 'transaction_update';
  data: {
    hash: string;
    from: string;
    to: string;
    value: string;
    blockNumber: number;
  };
}

export interface LendingUpdateEvent extends PipelineEvent {
  type: 'lending_update';
  data: {
    loanId: string;
    status: 'active' | 'repaid' | 'defaulted';
    amount: number;
    action: 'created' | 'repaid' | 'defaulted';
  };
}

export type PipelineEventType = CreditScoreUpdateEvent | TransactionUpdateEvent | LendingUpdateEvent;

type AnyHandler = (event: PipelineEventType) => void;

/**
 * Credora's own event stream (SSE from the indexer worker).
 *
 * There is no 0G Pipeline product. This service keeps the previous subscribe
 * surface so existing contexts do not change, but the transport is our indexer.
 *
 * Browser publish methods return false: writes originate from chain events
 * processed by the worker, not from the client.
 */
export class ZeroGPipelineService {
  private static instance: ZeroGPipelineService;
  private subscribers: Map<string, Set<AnyHandler>> = new Map();
  private source: EventSource | null = null;
  private watchedWallet: string | null = null;
  private isConnected = false;

  private constructor() {}

  public static getInstance(): ZeroGPipelineService {
    if (!ZeroGPipelineService.instance) {
      ZeroGPipelineService.instance = new ZeroGPipelineService();
    }
    return ZeroGPipelineService.instance;
  }

  async initialize(): Promise<boolean> {
    return this.isConnected;
  }

  async subscribeToChannel(_channel: string): Promise<void> {
    // Channels are not a 0G construct. The SSE endpoint is filtered by wallet.
  }

  private ensureStream(walletAddress: string): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    if (!publicConfig.streamUrl) return;
    if (this.source && this.watchedWallet === walletAddress.toLowerCase()) return;

    this.disconnectStream();
    this.watchedWallet = walletAddress.toLowerCase();

    const url = `${publicConfig.streamUrl}?wallet=${encodeURIComponent(this.watchedWallet)}`;
    const source = new EventSource(url);
    this.source = source;

    source.onopen = () => {
      this.isConnected = true;
    };

    source.onerror = () => {
      this.isConnected = false;
    };

    const onMessage = (event: MessageEvent) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data) as unknown;
      } catch {
        return;
      }

      const typed = normalizeStreamEvent(parsed);
      if (typed) this.handleEvent(typed);
    };

    source.addEventListener('record', onMessage);
    source.onmessage = onMessage;
  }

  subscribeToCreditScoreUpdates(
    walletAddress: string,
    callback: (event: CreditScoreUpdateEvent) => void,
  ): () => void {
    this.ensureStream(walletAddress);
    return this.addSubscriber(`credit_score:${walletAddress.toLowerCase()}`, callback as AnyHandler);
  }

  subscribeToTransactionUpdates(
    walletAddress: string,
    callback: (event: TransactionUpdateEvent) => void,
  ): () => void {
    this.ensureStream(walletAddress);
    return this.addSubscriber(`transaction:${walletAddress.toLowerCase()}`, callback as AnyHandler);
  }

  subscribeToLendingUpdates(
    walletAddress: string,
    callback: (event: LendingUpdateEvent) => void,
  ): () => void {
    this.ensureStream(walletAddress);
    return this.addSubscriber(`lending:${walletAddress.toLowerCase()}`, callback as AnyHandler);
  }

  private addSubscriber(key: string, callback: AnyHandler): () => void {
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key)!.add(callback);

    return () => {
      const bucket = this.subscribers.get(key);
      if (!bucket) return;
      bucket.delete(callback);
      if (bucket.size === 0) this.subscribers.delete(key);
      if (this.subscribers.size === 0) this.disconnectStream();
    };
  }

  private handleEvent(event: PipelineEventType): void {
    const wallet = event.wallet.toLowerCase();
    switch (event.type) {
      case 'credit_score_update':
        this.route(`credit_score:${wallet}`, event);
        break;
      case 'transaction_update':
        this.route(`transaction:${wallet}`, event);
        break;
      case 'lending_update':
        this.route(`lending:${wallet}`, event);
        break;
      default:
        break;
    }
  }

  private route(key: string, event: PipelineEventType): void {
    this.subscribers.get(key)?.forEach((callback) => {
      try {
        callback(event);
      } catch {
        /* subscriber errors must not tear down the stream */
      }
    });
  }

  async publishEvent(_channel: string, _event: PipelineEventType): Promise<boolean> {
    return false;
  }

  async publishCreditScoreUpdate(
    _walletAddress: string,
    _creditScore: number,
    _riskLevel: 'Low' | 'Medium' | 'High',
    _confidence: number,
    _factors: unknown[],
  ): Promise<boolean> {
    return false;
  }

  async publishTransactionUpdate(
    _walletAddress: string,
    _transactionData: TransactionUpdateEvent['data'],
  ): Promise<boolean> {
    return false;
  }

  async publishLendingUpdate(
    _walletAddress: string,
    _lendingData: LendingUpdateEvent['data'],
  ): Promise<boolean> {
    return false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    this.disconnectStream();
    this.subscribers.clear();
  }

  getSubscriberCount(): number {
    let total = 0;
    this.subscribers.forEach((bucket) => {
      total += bucket.size;
    });
    return total;
  }

  private disconnectStream(): void {
    this.source?.close();
    this.source = null;
    this.watchedWallet = null;
    this.isConnected = false;
  }
}

function normalizeStreamEvent(raw: unknown): PipelineEventType | null {
  if (!raw || typeof raw !== 'object') return null;
  const envelope = raw as Record<string, unknown>;

  // Indexer SSE wraps Credora records as { type: 'record', wallet, payload }.
  const record =
    envelope.type === 'record' && envelope.payload && typeof envelope.payload === 'object'
      ? (envelope.payload as Record<string, unknown>)
      : envelope;

  const wallet =
    (typeof record.wallet === 'string' && record.wallet) ||
    (typeof envelope.wallet === 'string' && envelope.wallet) ||
    '';
  if (!wallet) return null;

  const eventType = typeof record.eventType === 'string' ? record.eventType : '';
  const timestamp =
    typeof record.timestamp === 'string' ? record.timestamp : new Date().toISOString();
  const values = (record.values ?? {}) as Record<string, unknown>;

  if (eventType === 'credit_assessment') {
    return {
      type: 'credit_score_update',
      wallet,
      timestamp,
      data: {
        creditScore: Number(values.creditScore ?? 0),
        riskLevel: (values.riskLevel as CreditScoreUpdateEvent['data']['riskLevel']) ?? 'Low',
        confidence: Number(values.confidence ?? 0),
        factors: [],
      },
    };
  }

  if (
    eventType === 'loan_approved' ||
    eventType === 'loan_repaid' ||
    eventType === 'loan_defaulted' ||
    eventType === 'loan_requested'
  ) {
    return {
      type: 'lending_update',
      wallet,
      timestamp,
      data: {
        loanId: typeof record.loanId === 'string' ? record.loanId : '',
        status:
          eventType === 'loan_repaid'
            ? 'repaid'
            : eventType === 'loan_defaulted'
              ? 'defaulted'
              : 'active',
        amount: Number(values.amountWei ?? 0),
        action:
          eventType === 'loan_repaid'
            ? 'repaid'
            : eventType === 'loan_defaulted'
              ? 'defaulted'
              : 'created',
      },
    };
  }

  if (eventType === 'wallet_transaction') {
    return {
      type: 'transaction_update',
      wallet,
      timestamp,
      data: {
        hash: typeof record.txHash === 'string' ? record.txHash : '',
        from: wallet,
        to: String(values.counterparty ?? ''),
        value: String(values.amountWei ?? '0'),
        blockNumber: typeof record.blockNumber === 'number' ? record.blockNumber : 0,
      },
    };
  }

  return null;
}

export const zeroGPipelineService = ZeroGPipelineService.getInstance();
