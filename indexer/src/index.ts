import { assertServerConfig, capabilitySummary, config } from './config';
import { createServer } from './server';
import { startWorker, stopWorker } from './worker';
import { closeDb, getDb } from './store/db';
import { createLogger } from './logger';

const log = createLogger('main');

function main(): void {
  assertServerConfig();
  getDb();

  const capabilities = capabilitySummary();
  for (const [name, capability] of Object.entries(capabilities)) {
    if (!capability.available) log.warn(`Capability ${name} is BLOCKED: ${capability.blockedReason}`);
  }

  const server = createServer().listen(config.server.port, () => {
    log.info(`Indexer API listening on http://localhost:${config.server.port}`);
    log.info(`Chain ${config.chain.chainId} via ${config.chain.rpcUrl}`);
    log.info(`0G Storage indexer ${config.og.storageIndexer}`);
  });

  startWorker();

  const shutdown = (signal: string) => {
    log.info(`Received ${signal}, shutting down`);
    stopWorker();
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
