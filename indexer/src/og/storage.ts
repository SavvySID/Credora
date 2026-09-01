import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { JsonRpcProvider, Wallet } from 'ethers';
import { config, ogWriteCapability } from '../config';
import { canonicalBytes } from '../records/canonical';
import type { StoredCredoraRecord } from '../records/schema';
import { createLogger } from '../logger';

const log = createLogger('og:storage');

/**
 * Raised when an operation needs a credential or funded asset that is absent.
 * The caller must surface this as BLOCKED, never swap in placeholder data.
 */
export class OgBlockedError extends Error {
  readonly blocked = true;

  constructor(reason: string) {
    super(reason);
    this.name = 'OgBlockedError';
  }
}

let indexerClient: Indexer | null = null;

function getIndexer(): Indexer {
  if (!indexerClient) indexerClient = new Indexer(config.og.storageIndexer);
  return indexerClient;
}

/**
 * The upload signer pays 0G Storage fees on 0G Galileo.
 * Absent key means every write is blocked - see ogWriteCapability.
 */
function getUploadSigner(): Wallet {
  if (!config.og.privateKey) {
    throw new OgBlockedError(ogWriteCapability.blockedReason!);
  }

  const provider = new JsonRpcProvider(config.chain.rpcUrl);
  return new Wallet(config.og.privateKey, provider);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * The 0G merkle root of a payload, computed locally with no network call and
 * no credential. Content-addressed, so identical content always yields the
 * same root - this is what makes dedup and pre-upload existence checks safe.
 */
export async function computeRootHash(bytes: Uint8Array): Promise<string> {
  const data = new MemData(bytes);
  const [tree, error] = await data.merkleTree();

  if (error !== null || !tree) {
    throw new Error(`Failed to compute merkle tree: ${error?.message ?? 'unknown error'}`);
  }

  const root = tree.rootHash();
  if (!root) throw new Error('Merkle tree produced no root hash');

  return root;
}

/** True when the storage network already holds this root hash. */
export async function isStored(rootHash: string): Promise<boolean> {
  try {
    const locations = await getIndexer().getFileLocations(rootHash);
    return Array.isArray(locations) && locations.length > 0;
  } catch {
    return false;
  }
}

export interface UploadOutcome {
  rootHash: string;
  /** Null when the content was already on the network and no tx was needed. */
  storageTxHash: string | null;
  txSeq: number | null;
  alreadyStored: boolean;
}

/**
 * Writes a Credora record to 0G Storage. Content-addressed, so re-uploading an
 * identical record is a no-op that returns the existing root hash.
 *
 * Throws OgBlockedError when no funded signer is configured. Throws a normal
 * Error when the network rejects the upload. Never returns a synthetic hash.
 */
export async function uploadRecord(record: StoredCredoraRecord): Promise<UploadOutcome> {
  const bytes = canonicalBytes(record);
  const rootHash = await computeRootHash(bytes);

  if (await isStored(rootHash)) {
    log.debug(`Record already on 0G Storage, skipping upload`, { rootHash });
    return { rootHash, storageTxHash: null, txSeq: null, alreadyStored: true };
  }

  const signer = getUploadSigner();
  const data = new MemData(bytes);

  const [result, error] = await withTimeout(
    getIndexer().upload(data, config.chain.rpcUrl, signer, {
      finalityRequired: true,
      // Content is deterministic, so a concurrent writer landing first is fine.
      skipIfFinalized: true,
    }),
    config.og.uploadTimeoutMs,
    '0G Storage upload',
  );

  if (error !== null) {
    throw new Error(`0G Storage upload failed: ${error.message}`);
  }

  // Small records never fragment, but the SDK types allow the multi-root form.
  const [returnedRoot, returnedTx, returnedSeq] =
    'rootHash' in result
      ? ([result.rootHash, result.txHash, result.txSeq] as const)
      : ([result.rootHashes[0], result.txHashes[0], result.txSeqs[0]] as const);

  if (returnedRoot !== rootHash) {
    throw new Error(
      `0G Storage returned root ${returnedRoot} but the payload hashes to ${rootHash}`,
    );
  }

  log.info('Record written to 0G Storage', { rootHash, storageTxHash: returnedTx });

  return {
    rootHash,
    storageTxHash: returnedTx ?? null,
    txSeq: returnedSeq ?? null,
    alreadyStored: false,
  };
}

/**
 * Reads a record back from 0G Storage by root hash.
 * Needs no credential - retrieval goes through the public indexer gateway.
 */
export async function downloadRecord(rootHash: string): Promise<unknown> {
  const [blob, error] = await withTimeout(
    getIndexer().downloadToBlob(rootHash, { proof: true }),
    config.og.downloadTimeoutMs,
    '0G Storage download',
  );

  if (error !== null) {
    throw new Error(`0G Storage download failed: ${error.message}`);
  }

  const text = await blob.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Object at ${rootHash} is not valid JSON`);
  }
}

export interface StorageProbe {
  reachable: boolean;
  endpoint: string;
  trustedNodes: number | null;
  writeCapability: { available: boolean; blockedReason: string | null };
  error: string | null;
}

/**
 * Health check. The indexer root path returns 404 by design, so this asks for
 * the sharded node set instead, which is a real API route.
 */
export async function probeStorage(): Promise<StorageProbe> {
  const base = {
    endpoint: config.og.storageIndexer,
    writeCapability: {
      available: ogWriteCapability.available,
      blockedReason: ogWriteCapability.blockedReason,
    },
  };

  try {
    const nodes = await withTimeout(getIndexer().getShardedNodes(), 10_000, '0G Storage probe');
    return {
      ...base,
      reachable: true,
      trustedNodes: nodes.trusted?.length ?? 0,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      reachable: false,
      trustedNodes: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Address of the upload signer, for funding checks. Null when blocked. */
export async function getUploadAccount(): Promise<{
  address: string;
  balanceWei: string;
  funded: boolean;
} | null> {
  if (!config.og.privateKey) return null;

  const signer = getUploadSigner();
  const address = await signer.getAddress();
  const balance = await signer.provider!.getBalance(address);

  return {
    address,
    balanceWei: balance.toString(),
    funded: balance > 0n,
  };
}
