import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * Deterministic JSON: object keys sorted, undefined dropped, no whitespace.
 *
 * Verification compares the hash of a record retrieved from 0G Storage against
 * the hash recorded at write time, so both sides must serialise identically.
 * Any change to this function invalidates previously written record ids.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return 'null';

  const type = typeof value;

  if (type === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new TypeError('Cannot canonicalize a non-finite number');
    }
    return JSON.stringify(value);
  }

  if (type === 'string' || type === 'boolean') return JSON.stringify(value);

  if (type === 'bigint') return JSON.stringify((value as bigint).toString());

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalize(entry === undefined ? null : entry)).join(',')}]`;
  }

  if (type === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalize(entryValue)}`)
      .join(',')}}`;
  }

  throw new TypeError(`Cannot canonicalize value of type ${type}`);
}

/** keccak256 over the canonical UTF-8 encoding. Returns a 0x-prefixed hash. */
export function contentHash(value: unknown): string {
  return keccak256(toUtf8Bytes(canonicalize(value)));
}

/** Bytes that are actually uploaded to 0G Storage. */
export function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}
