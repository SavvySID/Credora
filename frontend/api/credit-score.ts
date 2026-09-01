export default async function handler(
  req: { method?: string; query?: Record<string, unknown>; body?: unknown },
  res: { headersSent?: boolean; status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const mod = process.env.VERCEL
      ? await import('../api-lib/dist/handlers/creditScore.js')
      : await import('../api-lib/handlers/creditScore');
    await mod.handle(req as never, res as never);
  } catch (error) {
    if (res.headersSent) return;
    res.status(503).json({
      error: 'service_unavailable',
      service: 'Credora API',
      detail: error instanceof Error ? error.message : 'Credit score handler failed',
      message: 'Credit score could not be produced. No substitute data was generated.',
    });
  }
}
