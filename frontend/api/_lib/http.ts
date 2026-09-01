import type { VercelRequest, VercelResponse } from '@vercel/node';

export function methodGuard(
  req: VercelRequest,
  res: VercelResponse,
  allowed: string[],
): boolean {
  if (!allowed.includes(req.method ?? 'GET')) {
    res.setHeader('Allow', allowed.join(', '));
    res.status(405).json({ error: 'method_not_allowed' });
    return false;
  }
  return true;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export function readAddress(req: VercelRequest, res: VercelResponse): string | null {
  const fromAddress = Array.isArray(req.query.address) ? req.query.address[0] : req.query.address;
  const fromWallet = Array.isArray(req.query.wallet) ? req.query.wallet[0] : req.query.wallet;
  const raw = fromAddress || fromWallet;

  if (!raw || !ADDRESS.test(raw)) {
    res.status(400).json({ error: 'invalid_address', message: 'Expected a 0x EVM address' });
    return null;
  }

  return raw.toLowerCase();
}

/** Short shared cache with revalidation. Wallet data changes on every block. */
export function cacheFor(res: VercelResponse, seconds: number): void {
  res.setHeader(
    'Cache-Control',
    `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
  );
}

export function noStore(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store');
}

/**
 * Maps an upstream failure to a response that says what is unavailable.
 * Never substitutes placeholder data for a failed dependency.
 */
export function unavailable(
  res: VercelResponse,
  service: string,
  detail: string,
  status = 503,
): void {
  noStore(res);
  res.status(status).json({
    error: 'service_unavailable',
    service,
    detail,
    message: `${service} is unavailable. No substitute data was generated.`,
  });
}
