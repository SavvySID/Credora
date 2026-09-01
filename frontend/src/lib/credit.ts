export type RiskLevel = 'Low' | 'Medium' | 'High';
export type Tone = 'positive' | 'caution' | 'critical' | 'neutral' | 'brand';

export const SCORE_MIN = 0;
export const SCORE_MAX = 1000;

/**
 * Credit-band labels for the deterministic 0–1000 score.
 * Independent of AI riskLevel, where High means more risk.
 */
export const SCORE_BANDS = [
  { label: 'Building', from: 0, to: 399, level: 'Low' as RiskLevel, tone: 'critical' as Tone },
  { label: 'Established', from: 400, to: 699, level: 'Medium' as RiskLevel, tone: 'caution' as Tone },
  { label: 'Excellent', from: 700, to: 1000, level: 'High' as RiskLevel, tone: 'positive' as Tone },
];

export function bandForScore(score: number) {
  return SCORE_BANDS.find((b) => score >= b.from && score <= b.to) ?? SCORE_BANDS[0];
}

export function toneForLevel(level: RiskLevel | undefined): Tone {
  switch (level) {
    case 'High':
      return 'positive';
    case 'Medium':
      return 'caution';
    case 'Low':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function ratingLabel(level: RiskLevel | undefined): string {
  switch (level) {
    case 'High':
      return 'Excellent';
    case 'Medium':
      return 'Established';
    case 'Low':
      return 'Building';
    default:
      return 'Unrated';
  }
}

export function ratingSummary(level: RiskLevel | undefined): string {
  switch (level) {
    case 'High':
      return 'Strong on-chain standing. You qualify for the full borrowing range.';
    case 'Medium':
      return 'Solid standing. Consistent activity will move you into the top band.';
    case 'Low':
      return 'Early standing. Grow your balance and transaction history to improve.';
    default:
      return 'Connect a wallet to generate your first assessment.';
  }
}

export type CreditBand = 'Building' | 'Established' | 'Excellent';
export type AiRiskLevel = 'Low' | 'Medium' | 'High';

export function creditBandFor(score: number): CreditBand {
  if (score >= 700) return 'Excellent';
  if (score >= 400) return 'Established';
  return 'Building';
}

/** AI risk: High means more risk, unlike deterministic riskLevel. */
export function aiRiskTone(level: AiRiskLevel | null | undefined): Tone {
  switch (level) {
    case 'High':
      return 'critical';
    case 'Medium':
      return 'caution';
    case 'Low':
      return 'positive';
    default:
      return 'neutral';
  }
}

/** Human labels for the factor keys emitted by the 0G compute service. */
export function factorLabel(factor: string): string {
  const labels: Record<string, string> = {
    balance: 'Wallet balance',
    transaction_count: 'Transaction volume',
    activity_recency: 'Activity recency',
    repayment_rate: 'Repayment history',
    account_age: 'Account age',
  };
  return labels[factor] ?? factor.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function impactTone(impact: string): Tone {
  if (impact === 'positive') return 'positive';
  if (impact === 'negative') return 'critical';
  return 'neutral';
}
