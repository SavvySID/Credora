/**
 * Device-local UI state only (theme, session activity chips).
 * Never the source of truth for chain data, 0G records, loans, or scores.
 */
const NAMESPACE = 'credora';

function key(scope: string, wallet?: string | null): string {
  return wallet ? `${NAMESPACE}:${scope}:${wallet.toLowerCase()}` : `${NAMESPACE}:${scope}`;
}

export function readJson<T>(scope: string, wallet: string | null | undefined, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key(scope, wallet));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(scope: string, wallet: string | null | undefined, value: T): void {
  try {
    window.localStorage.setItem(key(scope, wallet), JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) — state stays in memory only */
  }
}
