import { fetchWalletSnapshot, type WalletSnapshot } from '../chain/walletActivity';
import { readWalletCache, writeWalletCache } from '../store/repositories';

export interface WalletResult {
  snapshot: WalletSnapshot;
  cached: boolean;
}

/**
 * Wallet state, served from the cache when fresh.
 *
 * The cache is a latency optimisation only - the chain is authoritative, and
 * an expired entry always triggers a real RPC read rather than being served
 * stale. A degraded snapshot is never cached, so a transient explorer outage
 * does not pin an empty transaction list for the whole TTL.
 */
export async function getWallet(address: string, force = false): Promise<WalletResult> {
  if (!force) {
    const cached = readWalletCache(address);
    if (cached) return { snapshot: cached, cached: true };
  }

  const snapshot = await fetchWalletSnapshot(address);
  if (!snapshot.degraded) writeWalletCache(snapshot);

  return { snapshot, cached: false };
}
