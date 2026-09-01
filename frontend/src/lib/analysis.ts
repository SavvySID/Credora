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

export const ANALYSIS_OPTIONS: { value: AnalysisType; label: string }[] = [
  { value: 'general', label: 'General Risk Assessment' },
  { value: 'borrower-risk', label: 'Borrower Risk' },
  { value: 'repayment-behavior', label: 'Repayment Behavior' },
  { value: 'liquidity', label: 'Liquidity & Financial Health' },
  { value: 'wallet-activity', label: 'Wallet Activity & Stability' },
  { value: 'risk-outlook', label: 'Risk Outlook' },
];

export function analysisLabel(type: AnalysisType): string {
  return ANALYSIS_OPTIONS.find((option) => option.value === type)?.label ?? 'General Risk Assessment';
}

export function isAnalysisType(value: unknown): value is AnalysisType {
  return typeof value === 'string' && (ANALYSIS_TYPES as readonly string[]).includes(value);
}
