import { getDb } from './store/db';
import { startWorker, stopWorker } from './worker';
import { createLogger } from './logger';

const log = createLogger('worker-main');

getDb();
startWorker();

const shutdown = (signal: string) => {
  log.info(`Received ${signal}, stopping worker`);
  stopWorker();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
