import { ZERO_G_CONFIG, zeroGPipeline } from './0g-config';

export interface PipelineEvent {
  type: string;
  wallet: string;
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface CreditScoreUpdateEvent extends PipelineEvent {
  type: 'credit_score_update';
  data: {
    creditScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    confidence: number;
    factors: any[];
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

export class ZeroGPipelineService {
  private static instance: ZeroGPipelineService;
  private subscribers: Map<string, Set<(event: PipelineEventType) => void>> = new Map();
  private isConnected: boolean = false;
  
  private constructor() {}
  
  public static getInstance(): ZeroGPipelineService {
    if (!ZeroGPipelineService.instance) {
      ZeroGPipelineService.instance = new ZeroGPipelineService();
    }
    return ZeroGPipelineService.instance;
  }
  
  /**
   * Initialize the pipeline connection
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing 0G Pipeline connection...');
      
      // Subscribe to default channels
      await this.subscribeToChannel(ZERO_G_CONFIG.streaming.creditScoreUpdates);
      await this.subscribeToChannel(ZERO_G_CONFIG.streaming.transactionUpdates);
      await this.subscribeToChannel(ZERO_G_CONFIG.streaming.lendingUpdates);
      
      this.isConnected = true;
      console.log('0G Pipeline initialized successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to initialize 0G Pipeline:', error);
      this.isConnected = false;
      return false;
    }
  }
  
  /**
   * Subscribe to a specific channel
   */
  async subscribeToChannel(channel: string): Promise<void> {
    try {
      console.log(`Subscribing to 0G Pipeline channel: ${channel}`);
      
      zeroGPipeline.subscribe(channel, (event: PipelineEventType) => {
        this.handleEvent(event);
      });
      
    } catch (error) {
      console.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Subscribe to credit score updates for a specific wallet
   */
  subscribeToCreditScoreUpdates(
    walletAddress: string, 
    callback: (event: CreditScoreUpdateEvent) => void
  ): () => void {
    const key = `credit_score:${walletAddress}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(callback as any);
    
    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback as any);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }
  
  /**
   * Subscribe to transaction updates for a specific wallet
   */
  subscribeToTransactionUpdates(
    walletAddress: string, 
    callback: (event: TransactionUpdateEvent) => void
  ): () => void {
    const key = `transaction:${walletAddress}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(callback as any);
    
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback as any);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }
  
  /**
   * Subscribe to lending updates for a specific wallet
   */
  subscribeToLendingUpdates(
    walletAddress: string, 
    callback: (event: LendingUpdateEvent) => void
  ): () => void {
    const key = `lending:${walletAddress}`;
    
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    
    this.subscribers.get(key)!.add(callback as any);
    
    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback as any);
        if (subscribers.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }
  
  /**
   * Handle incoming pipeline events
   */
  private handleEvent(event: PipelineEventType): void {
    console.log('Received 0G Pipeline event:', event);
    
    // Route events to appropriate subscribers
    switch (event.type) {
      case 'credit_score_update':
        this.routeEventToSubscribers(`credit_score:${event.wallet}`, event);
        break;
      case 'transaction_update':
        this.routeEventToSubscribers(`transaction:${event.wallet}`, event);
        break;
      case 'lending_update':
        this.routeEventToSubscribers(`lending:${event.wallet}`, event);
        break;
      default:
        console.warn('Unknown event type:', event.type);
    }
  }
  
  /**
   * Route events to subscribers
   */
  private routeEventToSubscribers(key: string, event: PipelineEventType): void {
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in pipeline event callback:', error);
        }
      });
    }
  }
  
  /**
   * Publish an event to the pipeline
   */
  async publishEvent(channel: string, event: PipelineEventType): Promise<boolean> {
    try {
      console.log(`Publishing event to 0G Pipeline channel ${channel}:`, event);
      
      const result = await zeroGPipeline.publish(channel, event);
      return result.success;
      
    } catch (error) {
      console.error('Failed to publish event to pipeline:', error);
      return false;
    }
  }
  
  /**
   * Publish credit score update
   */
  async publishCreditScoreUpdate(
    walletAddress: string, 
    creditScore: number, 
    riskLevel: 'Low' | 'Medium' | 'High',
    confidence: number,
    factors: any[]
  ): Promise<boolean> {
    const event: CreditScoreUpdateEvent = {
      type: 'credit_score_update',
      wallet: walletAddress,
      timestamp: new Date().toISOString(),
      data: {
        creditScore,
        riskLevel,
        confidence,
        factors,
      },
    };
    
    return await this.publishEvent(ZERO_G_CONFIG.streaming.creditScoreUpdates, event);
  }
  
  /**
   * Publish transaction update
   */
  async publishTransactionUpdate(
    walletAddress: string,
    transactionData: {
      hash: string;
      from: string;
      to: string;
      value: string;
      blockNumber: number;
    }
  ): Promise<boolean> {
    const event: TransactionUpdateEvent = {
      type: 'transaction_update',
      wallet: walletAddress,
      timestamp: new Date().toISOString(),
      data: transactionData,
    };
    
    return await this.publishEvent(ZERO_G_CONFIG.streaming.transactionUpdates, event);
  }
  
  /**
   * Publish lending update
   */
  async publishLendingUpdate(
    walletAddress: string,
    lendingData: {
      loanId: string;
      status: 'active' | 'repaid' | 'defaulted';
      amount: number;
      action: 'created' | 'repaid' | 'defaulted';
    }
  ): Promise<boolean> {
    const event: LendingUpdateEvent = {
      type: 'lending_update',
      wallet: walletAddress,
      timestamp: new Date().toISOString(),
      data: lendingData,
    };
    
    return await this.publishEvent(ZERO_G_CONFIG.streaming.lendingUpdates, event);
  }
  
  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
  
  /**
   * Disconnect from pipeline
   */
  disconnect(): void {
    console.log('Disconnecting from 0G Pipeline...');
    this.isConnected = false;
    this.subscribers.clear();
  }
  
  /**
   * Get subscriber count for debugging
   */
  getSubscriberCount(): number {
    let total = 0;
    this.subscribers.forEach(subscribers => {
      total += subscribers.size;
    });
    return total;
  }
}

export const zeroGPipelineService = ZeroGPipelineService.getInstance();
