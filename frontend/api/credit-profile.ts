// @ts-nocheck — Vercel loads compiled CJS from api-lib/dist
export default async function handler(
  req: { method?: string; query?: Record<string, unknown>; body?: unknown },
  res: { headersSent?: boolean; status: (code: number) => { json: (body: unknown) => void } },
) {
  try {
    const mod = process.env.VERCEL
      ? await import('../api-lib/dist/handlers/creditProfile.js')
      : await import('../api-lib/handlers/creditProfile');
    await mod.handle(req as never, res as never);
  } catch (error) {
    if (res.headersSent) return;
    res.status(503).json({
      error: 'service_unavailable',
      service: 'Credora API',
      detail: error instanceof Error ? error.message : 'Credit profile handler failed',
      message: 'Credit profile could not be produced. No substitute data was generated.',
    });
  }
}
