export const BADGE_IDS = [
  'verified_credit_record',
  'on_chain_active',
  'established_wallet',
  'consistent_repayer',
  'verified_profile',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface ReputationInput {
  lastActivity: string | null;
  firstSeen: string | null;
  transactionCount: number;
  repaid: number;
  repaymentRate: number | null;
  overdue: number;
  latestAssessmentVerified: boolean;
  anyVerifiedRecord: boolean;
}

export interface ReputationBadge {
  id: BadgeId;
  label: string;
  earned: boolean;
  evidence: string;
}

const ESTABLISHED_NONCE = 10;

function daysAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  return (now - new Date(iso).getTime()) / 86_400_000;
}

/**
 * Data-backed badges only. Callers must not render badges with earned: false.
 * There is no "AI Approved" badge.
 */
export function evaluateReputation(input: ReputationInput, now = Date.now()): ReputationBadge[] {
  const idleDays = daysAgo(input.lastActivity, now);
  const ageDays = daysAgo(input.firstSeen, now);

  const onChainActive = idleDays !== null && idleDays <= 7;
  const established = ageDays !== null && ageDays >= 30 && input.transactionCount >= ESTABLISHED_NONCE;
  const consistentRepayer =
    input.repaid >= 1 && input.repaymentRate === 1 && input.overdue === 0;

  return [
    {
      id: 'verified_credit_record',
      label: 'Verified Credit Record',
      earned: input.latestAssessmentVerified,
      evidence: input.latestAssessmentVerified
        ? 'Latest credit assessment was written, retrieved and content-hash verified on 0G Storage.'
        : 'No verified credit assessment yet.',
    },
    {
      id: 'on_chain_active',
      label: 'On-chain Active',
      earned: onChainActive,
      evidence: onChainActive
        ? `Last on-chain activity ${Math.floor(idleDays ?? 0)} day(s) ago.`
        : 'No transaction within the last 7 days.',
    },
    {
      id: 'established_wallet',
      label: 'Established Wallet',
      earned: established,
      evidence: established
        ? `Account age ${Math.floor(ageDays ?? 0)} days and nonce ${input.transactionCount}.`
        : 'Needs 30 days of history and at least 10 outbound transactions.',
    },
    {
      id: 'consistent_repayer',
      label: 'Consistent Repayer',
      earned: consistentRepayer,
      evidence: consistentRepayer
        ? `Repaid ${input.repaid} loan(s) with no overdue balance.`
        : 'Requires at least one repaid Credora loan, full repayment rate, and no overdue loan.',
    },
    {
      id: 'verified_profile',
      label: 'Verified Profile',
      earned: input.anyVerifiedRecord,
      evidence: input.anyVerifiedRecord
        ? 'At least one Credora record for this wallet passed 0G Storage verification.'
        : 'No 0G-verified records for this wallet.',
    },
  ];
}

export function earnedBadges(input: ReputationInput, now = Date.now()): ReputationBadge[] {
  return evaluateReputation(input, now).filter((badge) => badge.earned);
}
