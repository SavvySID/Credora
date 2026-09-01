import { EventEmitter } from 'node:events';
import type { CredoraRecord } from '../records/schema';

/**
 * In-process fan-out for the SSE endpoint.
 *
 * This is Credora's own event stream over real indexed chain events. It is not
 * a 0G product - 0G has no pub/sub service - so it is named accordingly.
 */
export interface StreamEvent {
  type: 'record' | 'heartbeat' | 'status';
  wallet: string | null;
  payload: unknown;
  emittedAt: string;
}

class StreamBus extends EventEmitter {
  publishRecord(record: CredoraRecord): void {
    const event: StreamEvent = {
      type: 'record',
      wallet: record.wallet,
      payload: record,
      emittedAt: new Date().toISOString(),
    };
    this.emit('event', event);
  }

  publishStatus(payload: unknown): void {
    this.emit('event', {
      type: 'status',
      wallet: null,
      payload,
      emittedAt: new Date().toISOString(),
    } satisfies StreamEvent);
  }

  subscribe(listener: (event: StreamEvent) => void): () => void {
    this.on('event', listener);
    return () => this.off('event', listener);
  }
}

export const streamBus = new StreamBus();
streamBus.setMaxListeners(0);
