import { downloadRecord } from '../og/storage';
import { checkRecordIntegrity, type StoredCredoraRecord, type VerificationStatus } from '../records/schema';
import { getRecordById, markRecordVerification } from '../store/repositories';
import { createLogger } from '../logger';

const log = createLogger('service:verify');

export interface VerificationResult {
  status: VerificationStatus;
  detail: string | null;
  rootHash: string | null;
  record: StoredCredoraRecord | null;
  verifiedAt: string | null;
}

/**
 * Retrieves a record from 0G Storage by root hash and checks that its contents
 * hash to the record id it declares.
 *
 * This is the only thing that earns a record the "0G Verified" marker. It
 * requires a real retrieval - there is no offline path to a verified state.
 */
export async function verifyByRootHash(
  rootHash: string,
  expectedRecordId?: string,
): Promise<VerificationResult> {
  let document: unknown;

  try {
    document = await downloadRecord(rootHash);
  } catch (error) {
    return {
      status: 'failed',
      detail: `Retrieval from 0G Storage failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      rootHash,
      record: null,
      verifiedAt: null,
    };
  }

  const integrity = checkRecordIntegrity(document);

  if (!integrity.ok) {
    return {
      status: 'failed',
      detail: integrity.detail,
      rootHash,
      record: integrity.record,
      verifiedAt: null,
    };
  }

  if (expectedRecordId && integrity.record!.recordId !== expectedRecordId) {
    return {
      status: 'failed',
      detail: `Root hash ${rootHash} holds record ${integrity.record!.recordId}, expected ${expectedRecordId}`,
      rootHash,
      record: integrity.record,
      verifiedAt: null,
    };
  }

  return {
    status: 'verified',
    detail: null,
    rootHash,
    record: integrity.record,
    verifiedAt: new Date().toISOString(),
  };
}

/** Verifies an indexed record and persists the outcome. */
export async function verifyStoredRecord(recordId: string): Promise<VerificationResult> {
  const indexed = getRecordById(recordId);

  if (!indexed) {
    return {
      status: 'failed',
      detail: `Record ${recordId} is not in the index`,
      rootHash: null,
      record: null,
      verifiedAt: null,
    };
  }

  if (!indexed.verification.rootHash) {
    const detail = 'Record has not been written to 0G Storage yet';
    markRecordVerification(recordId, 'unverified', detail);
    return { status: 'unverified', detail, rootHash: null, record: null, verifiedAt: null };
  }

  const result = await verifyByRootHash(indexed.verification.rootHash, recordId);
  markRecordVerification(recordId, result.status, result.detail);

  if (result.status !== 'verified') {
    log.warn(`Verification did not pass for ${recordId}`, result.detail);
  }

  return result;
}
