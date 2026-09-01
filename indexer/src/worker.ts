import { config, loanIndexingCapability, ogWriteCapability } from './config';
import { getChainHead, getLoanContract } from './chain/provider';
import { planScanWindows, scanLoanEvents } from './chain/loanEvents';
import { flushPendingWrites, ingestLoanEvents } from './services/recordService';
import { getCursor, setCursor } from './store/db';
import { streamBus } from './events/bus';
import { createLogger } from './logger';

const log = createLogger('worker');

export interface TickResult {
  scannedTo: number | null;
  eventsSeen: number;
  recordsInserted: number;
  storageBlocked: boolean;
  error: string | null;
}

/**
 * One indexing pass: catch the log cursor up to the confirmed head, then push
 * anything not yet on 0G Storage.
 *
 * The cursor only advances after a window is fully ingested, so a crash
 * mid-catch-up replays that window rather than skipping it. Record inserts are
 * deduplicated on (tx_hash, log_index), which makes the replay harmless.
 */
export async function runTick(): Promise<TickResult> {
  const result: TickResult = {
    scannedTo: null,
    eventsSeen: 0,
    recordsInserted: 0,
    storageBlocked: false,
    error: null,
  };

  const resolved = getLoanContract();

  if (resolved) {
    try {
      const head = await getChainHead();
      const cursor = getCursor();
      const from = cursor === null ? resolved.deployBlock : cursor + 1;
      const windows = planScanWindows(from, head);

      for (const [start, end] of windows) {
        const scan = await scanLoanEvents(start, end);
        const summary = ingestLoanEvents(scan.events);

        result.eventsSeen += summary.seen;
        result.recordsInserted += summary.inserted;

        setCursor(end);
        result.scannedTo = end;
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      log.error('Chain scan failed; cursor not advanced', result.error);
    }
  }

  const flush = await flushPendingWrites();
  result.storageBlocked = flush.blocked;

  if (flush.stored > 0 || flush.failed > 0) {
    log.info('0G Storage flush', flush);
  }

  return result;
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startWorker(): void {
  if (!config.worker.enabled) {
    log.warn('Worker disabled via WORKER_ENABLED=false');
    return;
  }

  if (!loanIndexingCapability.available) {
    log.warn(`Loan event indexing BLOCKED: ${loanIndexingCapability.blockedReason}`);
  }

  if (!ogWriteCapability.available) {
    log.warn(`0G Storage writes BLOCKED: ${ogWriteCapability.blockedReason}`);
  }

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      const result = await runTick();
      if (result.recordsInserted > 0) {
        streamBus.publishStatus({ indexedTo: result.scannedTo, inserted: result.recordsInserted });
      }
    } catch (error) {
      log.error('Unhandled worker error', error);
    } finally {
      running = false;
    }
  };

  void tick();
  timer = setInterval(() => void tick(), config.worker.pollIntervalMs);
  log.info(`Worker started, polling every ${config.worker.pollIntervalMs}ms`);
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
