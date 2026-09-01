export default async function handler(
  req: { method?: string; query?: Record<string, unknown>; body?: unknown },
  res: { headersSent?: boolean; status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const id = process.env.VERCEL
      ? '../api-lib/dist/handlers/creditScore.js'
      : '../api-lib/handlers/creditScore';
    const mod = (await import(id)) as { handle: (r: typeof req, s: typeof res) => Promise<void> };
    await mod.handle(req, res);
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
