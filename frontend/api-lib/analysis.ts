export const ANALYSIS_TYPES = ['general'] as const;

export type AnalysisType = (typeof ANALYSIS_TYPES)[number];

export const DEFAULT_ANALYSIS_TYPE: AnalysisType = 'general';

export const RISK_OUTLOOKS = ['Improving', 'Stable', 'Deteriorating', 'Insufficient Data'] as const;
export type RiskOutlook = (typeof RISK_OUTLOOKS)[number];

export function isAnalysisType(value: unknown): value is AnalysisType {
  return value === 'general';
}

/** Missing/blank defaults to general. Unknown strings are rejected. */
export function parseAnalysisType(
  value: unknown,
): { ok: true; value: AnalysisType } | { ok: false; reason: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: DEFAULT_ANALYSIS_TYPE };
  }
  if (!isAnalysisType(value)) {
    return {
      ok: false,
      reason: `Invalid analysisType. Allowed: ${ANALYSIS_TYPES.join(', ')}`,
    };
  }
  return { ok: true, value };
}

export function analysisLabel(_type: AnalysisType = DEFAULT_ANALYSIS_TYPE): string {
  return 'General Risk Assessment';
}

/**
 * Encoded into the indexer cache `model` slot.
 * General keeps `id@router` so existing cached assessments still hit.
 */
export function analysisCacheModelKey(computeModel: string, _analysisType: AnalysisType = DEFAULT_ANALYSIS_TYPE): string {
  if (!computeModel) return 'unconfigured';
  return `${computeModel}@router`;
}

export function parseRiskOutlook(value: unknown): RiskOutlook | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = RISK_OUTLOOKS.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}
