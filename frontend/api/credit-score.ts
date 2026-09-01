function indexerReady(): boolean {
  const secret = (process.env.INDEXER_SHARED_SECRET ?? '').trim();
  if (!secret) return false;
  const url = (process.env.INDEXER_URL ?? '').trim();
  if (process.env.VERCEL) {
    if (!url) return false;
    if (/localhost|127\.0\.0\.1|your-indexer-host/i.test(url)) return false;
    if (/\/api$/i.test(url)) return false;
  }
  return true;
}

function unavailable(res: { status: (code: number) => { json: (body: unknown) => void } }, detail: string) {
  res.status(503).json({
    error: 'service_unavailable',
    service: 'Credora indexer',
    detail,
    message: 'Credora indexer is unavailable. No substitute data was generated.',
  });
}

export default async function handler(
  req: { method?: string; query?: Record<string, unknown>; body?: unknown },
  res: {
    headersSent?: boolean;
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  if (!indexerReady()) {
    unavailable(
      res,
      process.env.VERCEL
        ? 'Indexer is not reachable from this deployment. Host the indexer and set INDEXER_URL to a public https URL.'
        : 'INDEXER_SHARED_SECRET or INDEXER_URL is not set.',
    );
    return;
  }

  try {
    const { handle } = await import('../api-lib/handlers/creditScore');
    await handle(req as never, res as never);
  } catch (error) {
    if (res.headersSent) return;
    unavailable(res, error instanceof Error ? error.message : 'Credit score handler failed to load');
  }
}
