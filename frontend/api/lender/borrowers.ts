export default async function handler(
  req: { method?: string; query?: Record<string, unknown>; body?: unknown },
  res: { headersSent?: boolean; status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const mod = process.env.VERCEL
      ? await import('../../api-lib/dist/handlers/lenderBorrowers.js')
      : await import('../../api-lib/handlers/lenderBorrowers');
    await mod.handle(req as never, res as never);
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
