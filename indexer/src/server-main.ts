import { assertServerConfig, config } from './config';
import { createServer } from './server';
import { getDb } from './store/db';
import { createLogger } from './logger';

const log = createLogger('server-main');

assertServerConfig();
getDb();

createServer().listen(config.server.port, () => {
  log.info(`Indexer API listening on http://localhost:${config.server.port} (worker not started)`);
});
