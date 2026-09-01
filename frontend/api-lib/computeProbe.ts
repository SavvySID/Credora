function vercelCap(requested: number, cap: number): number {
  const value = Number.isFinite(requested) && requested > 0 ? requested : cap;
  return process.env.VERCEL ? Math.min(value, cap) : value;
}

function computeEnv() {
  const requested = Number.parseInt(process.env.ZG_COMPUTE_TIMEOUT_MS ?? '25000', 10);
  return {
    routerUrl: process.env.ZG_COMPUTE_ROUTER_URL ?? 'https://router-api.0g.ai/v1',
    apiKey: process.env.ZG_COMPUTE_API_KEY ?? '',
    model: process.env.ZG_COMPUTE_MODEL ?? '',
    // Hobby functions die at ~10s. A 25s router wait becomes FUNCTION_INVOCATION_FAILED.
    timeoutMs: vercelCap(requested, 8_000),
  };
}

export function computeModelId(): string {
  return computeEnv().model;
}

export function computeCapability(): { available: boolean; blockedReason: string | null } {
  const { apiKey, model } = computeEnv();
  if (!apiKey) {
    return {
      available: false,
      blockedReason:
        'ZG_COMPUTE_API_KEY is not set. Create an inference key at https://pc.0g.ai and fund the unified balance with 0G.',
    };
  }
  if (!model) {
    return {
      available: false,
      blockedReason:
        'ZG_COMPUTE_MODEL is not set. Pick a model id from GET https://router-api.0g.ai/v1/models.',
    };
  }
  return { available: true, blockedReason: null };
}

export interface ComputeProbe {
  reachable: boolean;
  configured: boolean;
  blockedReason: string | null;
  models: number | null;
  error: string | null;
}

/** GET /v1/models needs no auth, so reachability is testable without a key. */
export async function probeCompute(): Promise<ComputeProbe> {
  const capability = computeCapability();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), process.env.VERCEL ? 4_000 : 8_000);
    const response = await fetch(`${computeEnv().routerUrl}/models`, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        reachable: false,
        configured: capability.available,
        blockedReason: capability.blockedReason,
        models: null,
        error: `Router responded ${response.status}`,
      };
    }

    const payload = (await response.json()) as { data?: unknown[] };

    return {
      reachable: true,
      configured: capability.available,
      blockedReason: capability.blockedReason,
      models: Array.isArray(payload.data) ? payload.data.length : null,
      error: null,
    };
  } catch (error) {
    return {
      reachable: false,
      configured: capability.available,
      blockedReason: capability.blockedReason,
      models: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export { computeEnv };
