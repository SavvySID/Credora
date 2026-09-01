export const ANALYSIS_TYPES = [
  'general',
  'borrower-risk',
  'repayment-behavior',
  'liquidity',
  'wallet-activity',
  'risk-outlook',
] as const;

export type AnalysisType = (typeof ANALYSIS_TYPES)[number];

export const DEFAULT_ANALYSIS_TYPE: AnalysisType = 'general';

export const ANALYSIS_LABELS: Record<AnalysisType, string> = {
  general: 'General Risk Assessment',
  'borrower-risk': 'Borrower Risk',
  'repayment-behavior': 'Repayment Behavior',
  liquidity: 'Liquidity & Financial Health',
  'wallet-activity': 'Wallet Activity & Stability',
  'risk-outlook': 'Risk Outlook',
};

export const ANALYSIS_FOCUS: Record<AnalysisType, string> = {
  general: "Evaluate the borrower's overall on-chain financial risk.",
  'borrower-risk':
    'Focus on the factors that increase or decrease the likelihood that this borrower represents elevated financial risk.',
  'repayment-behavior':
    'Focus specifically on repayment history, repayment consistency, overdue behavior, and observed loan obligations.',
  liquidity:
    'Focus on available balance, financial buffer, obligations, and observable liquidity-related signals.',
  'wallet-activity':
    'Focus on transaction activity, account age, activity consistency, recency, and stability of observed wallet behavior.',
  'risk-outlook':
    'Assess whether the available evidence suggests the borrower\'s risk profile is improving, stable, or deteriorating, and explain which observed changes support that conclusion. Include riskOutlook as Improving, Stable, Deteriorating, or Insufficient Data.',
};

export const RISK_OUTLOOKS = ['Improving', 'Stable', 'Deteriorating', 'Insufficient Data'] as const;
export type RiskOutlook = (typeof RISK_OUTLOOKS)[number];

export function isAnalysisType(value: unknown): value is AnalysisType {
  return typeof value === 'string' && (ANALYSIS_TYPES as readonly string[]).includes(value);
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

export function analysisLabel(type: AnalysisType): string {
  return ANALYSIS_LABELS[type];
}

/**
 * Encoded into the indexer cache `model` slot so analysis types do not collide.
 * General keeps `id@router` so existing cached assessments still hit.
 */
export function analysisCacheModelKey(computeModel: string, analysisType: AnalysisType): string {
  if (!computeModel) return 'unconfigured';
  if (analysisType === 'general') return `${computeModel}@router`;
  return `${computeModel}@router:${analysisType}`;
}

export function parseRiskOutlook(value: unknown): RiskOutlook | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const match = RISK_OUTLOOKS.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
  return match ?? null;
}
