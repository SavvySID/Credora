import { z } from 'zod';
import { contentHash } from './canonical';

export const SCHEMA_VERSION = 1 as const;

export const CREDORA_EVENT_TYPES = [
  'loan_requested',
  'loan_approved',
  'loan_repaid',
  'loan_defaulted',
  'credit_assessment',
  'ai_risk_assessment',
  'wallet_transaction',
] as const;

export type CredoraEventType = (typeof CREDORA_EVENT_TYPES)[number];

/**
 * Where the record came from.
 * - chain    : decoded from a Loan.sol event log
 * - explorer : a wallet transaction reported by 0G Chain Scan
 * - compute  : the output of a 0G Compute inference call
 * - derived  : computed by Credora from other records (never an on-chain fact)
 */
export const RECORD_SOURCES = ['chain', 'explorer', 'compute', 'derived'] as const;
export type RecordSource = (typeof RECORD_SOURCES)[number];

export const VERIFICATION_STATUSES = ['verified', 'pending', 'unverified', 'failed'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

const hex = /^0x[0-9a-fA-F]+$/;

export const recordValuesSchema = z
  .object({
    /** Wei, kept as a decimal string so no precision is lost. */
    amountWei: z.string().regex(/^\d+$/).optional(),
    interestWei: z.string().regex(/^\d+$/).optional(),
    totalRepaymentWei: z.string().regex(/^\d+$/).optional(),
    interestRateBps: z.number().int().nonnegative().optional(),
    durationSeconds: z.number().int().nonnegative().optional(),
    dueTimestamp: z.string().datetime().optional(),
    creditScore: z.number().int().min(0).max(1000).optional(),
    riskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
    confidence: z.number().min(0).max(1).optional(),
    deterministicScore: z.number().int().min(0).max(1000).optional(),
    aiRiskScore: z.number().int().min(0).max(1000).optional(),
    aiRiskLevel: z.enum(['Low', 'Medium', 'High']).optional(),
    sourceDataHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
    riskFactors: z.array(z.string().max(240)).max(12).optional(),
    positiveFactors: z.array(z.string().max(240)).max(12).optional(),
    assessmentSummary: z.string().max(800).optional(),
    modelVersion: z.string().max(128).optional(),
    analysisType: z
      .enum([
        'general',
        'borrower-risk',
        'repayment-behavior',
        'liquidity',
        'wallet-activity',
        'risk-outlook',
      ])
      .optional(),
    analysisLabel: z.string().max(64).optional(),
    riskOutlook: z.enum(['Improving', 'Stable', 'Deteriorating', 'Insufficient Data']).optional(),
    gasUsed: z.string().regex(/^\d+$/).optional(),
    counterparty: z.string().regex(hex).optional(),
    direction: z.enum(['in', 'out', 'self']).optional(),
  })
  .strict();

export type CredoraRecordValues = z.infer<typeof recordValuesSchema>;

/**
 * The body is everything that is hashed. `recordId` is the hash of the body,
 * so it cannot itself be part of the body.
 */
export const recordBodySchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    eventType: z.enum(CREDORA_EVENT_TYPES),
    loanId: z.string().nullable(),
    txHash: z.string().regex(hex).nullable(),
    blockNumber: z.number().int().nonnegative().nullable(),
    logIndex: z.number().int().nonnegative().nullable(),
    timestamp: z.string().datetime(),
    chainId: z.number().int().positive(),
    source: z.enum(RECORD_SOURCES),
    values: recordValuesSchema,
    /** Free-form provenance, e.g. the compute model that produced a score. */
    meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  })
  .strict();

export type CredoraRecordBody = z.infer<typeof recordBodySchema>;

/** Exactly the document that is uploaded to 0G Storage. */
export const storedRecordSchema = recordBodySchema.extend({
  recordId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export type StoredCredoraRecord = z.infer<typeof storedRecordSchema>;

export const verificationSchema = z.object({
  status: z.enum(VERIFICATION_STATUSES),
  rootHash: z.string().nullable(),
  storageTxHash: z.string().nullable(),
  verifiedAt: z.string().datetime().nullable(),
  /** Populated when status is 'failed' so the UI can explain why. */
  detail: z.string().nullable().default(null),
});

export type RecordVerification = z.infer<typeof verificationSchema>;

/** What the API returns: the stored document plus its verification state. */
export interface CredoraRecord extends StoredCredoraRecord {
  verification: RecordVerification;
}

export function computeRecordId(body: CredoraRecordBody): string {
  return contentHash(body);
}

/** Builds the exact document that gets uploaded, with its self-describing id. */
export function buildStoredRecord(body: CredoraRecordBody): StoredCredoraRecord {
  const parsed = recordBodySchema.parse(body);
  return { ...parsed, recordId: computeRecordId(parsed) };
}

/**
 * Recomputes the id of a retrieved document and reports whether it matches.
 * This is the actual integrity check behind the "0G Verified" marker.
 */
export function checkRecordIntegrity(document: unknown): {
  ok: boolean;
  detail: string | null;
  record: StoredCredoraRecord | null;
} {
  const parsed = storedRecordSchema.safeParse(document);
  if (!parsed.success) {
    return {
      ok: false,
      detail: `Retrieved document does not match the Credora record schema: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')} ${issue.message}`)
        .join('; ')}`,
      record: null,
    };
  }

  const { recordId, ...body } = parsed.data;
  const recomputed = computeRecordId(body as CredoraRecordBody);

  if (recomputed !== recordId) {
    return {
      ok: false,
      detail: `Content hash mismatch: document declares ${recordId} but its contents hash to ${recomputed}`,
      record: parsed.data,
    };
  }

  return { ok: true, detail: null, record: parsed.data };
}

export const UNVERIFIED: RecordVerification = {
  status: 'unverified',
  rootHash: null,
  storageTxHash: null,
  verifiedAt: null,
  detail: null,
};
