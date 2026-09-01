export default async function handler(
  req: { method?: string; query?: Record<string, unknown>; body?: unknown },
  res: { headersSent?: boolean; status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const id = process.env.VERCEL
      ? '../../api-lib/dist/handlers/lenderBorrowers.js'
      : '../../api-lib/handlers/lenderBorrowers';
    const mod = (await import(id)) as { handle: (r: typeof req, s: typeof res) => Promise<void> };
    await mod.handle(req, res);
  } catch (error) {
    if (res.headersSent) return;
    res.status(503).json({
      error: 'service_unavailable',
      service: 'Credora indexer',
      detail: error instanceof Error ? error.message : 'Borrower list handler failed',
      message: 'Credora indexer is unavailable. No substitute data was generated.',
    });
  }
}
