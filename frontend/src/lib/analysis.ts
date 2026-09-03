export const ANALYSIS_TYPES = ['general'] as const;

export type AnalysisType = (typeof ANALYSIS_TYPES)[number];

export const DEFAULT_ANALYSIS_TYPE: AnalysisType = 'general';

export function analysisLabel(_type: AnalysisType = DEFAULT_ANALYSIS_TYPE): string {
  return 'General Risk Assessment';
}

export function isAnalysisType(value: unknown): value is AnalysisType {
  return value === 'general';
}
