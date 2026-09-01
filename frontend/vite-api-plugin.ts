import { config as loadEnv } from 'dotenv';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Serves the Vercel API handlers from the Vite dev server so `npm run dev`
 * hits the same functions as production. Loads server-only env from
 * `.env.local` / `.env` (never prefixed with VITE_).
 */
export function credoraApiPlugin(): Plugin {
  loadEnv({ path: resolve(process.cwd(), '.env.local') });
  loadEnv({ path: resolve(process.cwd(), '.env') });

  return {
    name: 'credora-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api')) return next();

        try {
          const handled = await dispatch(req, res);
          if (!handled) next();
        } catch (error) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'internal_error',
                message: error instanceof Error ? error.message : String(error),
              }),
            );
          }
        }
      });
    },
  };
}

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => void | Promise<void>;

async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const parsed = new URL(req.url ?? '/', 'http://localhost');
  const path = parsed.pathname.replace(/\/$/, '') || '/';

  const query: Record<string, string> = {};
  parsed.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let handler: Handler | null = null;

  if (path === '/api/health') {
    handler = (await import('./api/health')).default;
  } else if (path === '/api/credit-score') {
    handler = (await import('./api/credit-score')).default;
  } else if (path === '/api/credit-profile') {
    handler = (await import('./api/credit-profile')).default;
  } else if (path === '/api/risk-assessment') {
    handler = (await import('./api/risk-assessment')).default;
  } else if (path === '/api/analytics') {
    handler = (await import('./api/analytics')).default;
  } else if (path === '/api/lender/borrowers') {
    handler = (await import('./api/lender/borrowers')).default;
  } else {
    const lender = path.match(/^\/api\/lender\/borrowers\/(0x[0-9a-fA-F]{40})$/);
    if (lender) {
      query.address = lender[1];
      handler = (await import('./api/lender/borrowers/[address]')).default;
    }

    const wallet = path.match(/^\/api\/wallet\/(0x[0-9a-fA-F]{40})\/(activity|loans|records)$/);
    if (wallet) {
      query.address = wallet[1];
      if (wallet[2] === 'activity') handler = (await import('./api/wallet/[address]/activity')).default;
      if (wallet[2] === 'loans') handler = (await import('./api/wallet/[address]/loans')).default;
      if (wallet[2] === 'records') handler = (await import('./api/wallet/[address]/records')).default;
    }

    const record = path.match(/^\/api\/records\/(0x[0-9a-fA-F]{64})$/);
    if (record) {
      query.rootHash = record[1];
      handler = (await import('./api/records/[rootHash]')).default;
    }
  }

  if (!handler) return false;

  const body = req.method === 'POST' || req.method === 'PUT' ? await readJsonBody(req) : undefined;
  const vercelReq = Object.assign(req, { query, body, cookies: {} }) as VercelRequest;
  const vercelRes = adaptResponse(res);

  await handler(vercelReq, vercelRes);
  return true;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function adaptResponse(res: ServerResponse): VercelResponse {
  const wrapper = res as ServerResponse & VercelResponse;

  wrapper.status = ((code: number) => {
    res.statusCode = code;
    return wrapper;
  }) as VercelResponse['status'];

  wrapper.json = ((data: unknown) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return wrapper;
  }) as VercelResponse['json'];

  wrapper.send = wrapper.json;
  wrapper.redirect = ((statusOrUrl: number | string, url?: string) => {
    const status = typeof statusOrUrl === 'number' ? statusOrUrl : 302;
    const location = typeof statusOrUrl === 'string' ? statusOrUrl : url ?? '/';
    res.statusCode = status;
    res.setHeader('Location', location);
    res.end();
    return wrapper;
  }) as VercelResponse['redirect'];

  return wrapper;
}
