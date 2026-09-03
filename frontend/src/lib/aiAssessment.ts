import type { CreditProfileDto } from '@/services/api';
import { ANALYSIS_TYPES, type AnalysisType } from '@/lib/analysis';

export type AiView = CreditProfileDto['ai'];

/** Profile GET returns this when Compute has not been run (or nothing is cached yet). */
export function isPendingAi(
  ai: { available: boolean; blockedReason?: string | null } | null | undefined,
): boolean {
  if (!ai) return true;
  if (ai.available) return false;
  const reason = (ai.blockedReason ?? '').toLowerCase();
  if (!reason) return true;
  return (
    reason.includes('no cached') ||
    reason.includes('request a risk') ||
    reason.includes('post to run') ||
    reason.includes('for this wallet yet') ||
    reason.includes('run ai assessment') ||
    reason.includes('run 0g compute')
  );
}

/**
 * Dropdown changes must stay idle. A missing/failed slot is only an error after
 * this analysis type was actually POSTed (`hasAttempted`).
 */
export function isAwaitingComputeRun(
  ai: { available: boolean; blockedReason?: string | null } | null | undefined,
  hasAttempted?: boolean,
): boolean {
  if (hasAttempted === false) return !ai || !ai.available;
  return isPendingAi(ai);
}

export function mergePreservingSessionAi(
  incoming: CreditProfileDto,
  previous: CreditProfileDto | null,
): CreditProfileDto {
  if (!previous || previous.wallet.toLowerCase() !== incoming.wallet.toLowerCase()) {
    return incoming;
  }
  if (
    previous.sourceDataHash &&
    incoming.sourceDataHash &&
    previous.sourceDataHash !== incoming.sourceDataHash
  ) {
    return incoming;
  }

  let merged = incoming;
  for (const type of ANALYSIS_TYPES) {
    const prev =
      previous.aiByAnalysis?.[type] ?? (type === 'general' ? previous.ai : undefined);
    const next =
      merged.aiByAnalysis?.[type] ?? (type === 'general' ? merged.ai : undefined);
    if (prev?.available && isPendingAi(next)) {
      merged = mergeAssessmentIntoProfile(merged, type, prev);
    }
  }
  return merged;
}

export function mergeAssessmentIntoProfile(
  intel: CreditProfileDto,
  type: AnalysisType,
  ai: AiView,
): CreditProfileDto {
  return {
    ...intel,
    ai: type === 'general' ? ai : intel.ai,
    aiByAnalysis: { ...intel.aiByAnalysis, [type]: ai },
  };
}

const SESSION_SCOPE = 'ai-session';

export function readSessionAiAssessments(
  wallet: string,
): Partial<Record<AnalysisType, AiView>> {
  try {
    const raw = window.sessionStorage.getItem(`credora:${SESSION_SCOPE}:${wallet.toLowerCase()}`);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<AnalysisType, AiView>>;
  } catch {
    return {};
  }
}

export function writeSessionAiAssessment(
  wallet: string,
  type: AnalysisType,
  ai: AiView,
): void {
  if (!ai.available) return;
  try {
    const key = `credora:${SESSION_SCOPE}:${wallet.toLowerCase()}`;
    const store = readSessionAiAssessments(wallet);
    store[type] = ai;
    window.sessionStorage.setItem(key, JSON.stringify(store));
  } catch {
    /* sessionStorage unavailable */
  }
}

export function applySessionAiAssessments(
  intel: CreditProfileDto,
  wallet: string,
): CreditProfileDto {
  const saved = readSessionAiAssessments(wallet);
  let merged = intel;
  for (const type of ANALYSIS_TYPES) {
    const session = saved[type];
    if (!session?.available) continue;
    if (session.sourceDataHash && intel.sourceDataHash && session.sourceDataHash !== intel.sourceDataHash) {
      continue;
    }
    const current = merged.aiByAnalysis?.[type] ?? (type === 'general' ? merged.ai : undefined);
    if (isPendingAi(current)) {
      merged = mergeAssessmentIntoProfile(merged, type, session);
    }
  }
  return merged;
}
