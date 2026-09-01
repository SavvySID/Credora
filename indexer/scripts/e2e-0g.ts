/**
 * Proves the real 0G Storage round trip: write -> retrieve -> verify, plus a
 * deliberate failure case.
 *
 * This script is the ONLY thing that entitles anyone to say 0G Storage is
 * integrated. It performs a genuine on-chain-paid upload. If no funded signer
 * is configured it exits with code 2 and reports BLOCKED - it never simulates
 * a successful write, and never prints a hash it did not receive from 0G.
 */
import { ogWriteCapability, config } from '../src/config';
import { getUploadAccount, downloadRecord, uploadRecord, computeRootHash } from '../src/og/storage';
import { canonicalBytes } from '../src/records/canonical';
import { buildStoredRecord, checkRecordIntegrity } from '../src/records/schema';

const EXIT_BLOCKED = 2;

function heading(text: string) {
  console.log(`\n${text}\n${'-'.repeat(text.length)}`);
}

async function main() {
  console.log('\nCredora 0G Storage end-to-end proof');
  console.log('='.repeat(60));

  if (!ogWriteCapability.available) {
    console.log('\nBLOCKED: 0G Storage write path is not configured.');
    console.log(`Reason: ${ogWriteCapability.blockedReason}`);
    console.log('\nTo unblock:');
    console.log('  1. Create or pick a wallet on 0G Galileo (chainId 16602)');
    console.log('  2. Fund it at https://faucet.0g.ai');
    console.log('  3. Set OG_STORAGE_PRIVATE_KEY in indexer/.env');
    console.log('\nNo write was attempted. No root hash exists.\n');
    process.exit(EXIT_BLOCKED);
  }

  heading('0. Signer');
  const account = await getUploadAccount();
  if (!account) {
    console.log('BLOCKED: signer could not be resolved.');
    process.exit(EXIT_BLOCKED);
  }
  console.log(`address     ${account.address}`);
  console.log(`balance     ${account.balanceWei} wei`);
  if (!account.funded) {
    console.log('\nBLOCKED: signer has zero balance, uploads cannot pay storage fees.');
    console.log('Fund it at https://faucet.0g.ai and re-run.\n');
    process.exit(EXIT_BLOCKED);
  }

  // A unique marker so this run cannot collide with a previous one, which
  // would otherwise short-circuit as "already stored".
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const record = buildStoredRecord({
    schemaVersion: 1,
    wallet: account.address.toLowerCase(),
    eventType: 'wallet_transaction',
    loanId: null,
    txHash: null,
    blockNumber: null,
    logIndex: null,
    timestamp: new Date().toISOString(),
    chainId: config.chain.chainId,
    source: 'derived',
    values: {},
    meta: { purpose: 'credora-e2e-proof', nonce },
  });

  heading('1. Local content addressing');
  const expectedRoot = await computeRootHash(canonicalBytes(record));
  console.log(`recordId     ${record.recordId}`);
  console.log(`expected root ${expectedRoot}`);

  heading('2. Write to 0G Storage');
  const started = Date.now();
  const outcome = await uploadRecord(record);
  console.log(`rootHash      ${outcome.rootHash}`);
  console.log(`storageTxHash ${outcome.storageTxHash ?? '(content already stored, no new tx)'}`);
  console.log(`txSeq         ${outcome.txSeq ?? 'n/a'}`);
  console.log(`elapsed       ${Date.now() - started}ms`);

  if (outcome.rootHash !== expectedRoot) {
    console.log('\nFAIL: returned root hash does not match the locally computed root.');
    process.exit(1);
  }

  heading('3. Retrieve from 0G Storage');
  const retrieved = await downloadRecord(outcome.rootHash);
  console.log(JSON.stringify(retrieved, null, 2));

  heading('4. Verify');
  const integrity = checkRecordIntegrity(retrieved);
  if (!integrity.ok) {
    console.log(`FAIL: ${integrity.detail}`);
    process.exit(1);
  }
  if (integrity.record!.recordId !== record.recordId) {
    console.log(
      `FAIL: retrieved recordId ${integrity.record!.recordId} != written ${record.recordId}`,
    );
    process.exit(1);
  }
  console.log('PASS: retrieved bytes hash to the recordId that was written.');

  heading('5. Failure handling');
  const bogusRoot = `0x${'ab'.repeat(32)}`;
  try {
    await downloadRecord(bogusRoot);
    console.log('FAIL: a non-existent root hash unexpectedly resolved.');
    process.exit(1);
  } catch (error) {
    console.log(
      `PASS: unknown root hash rejected without fabricating data - ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  heading('Result');
  console.log('0G Storage write -> retrieve -> verify round trip SUCCEEDED.');
  console.log(`Root hash: ${outcome.rootHash}`);
  if (outcome.storageTxHash) {
    console.log(`Storage tx: ${outcome.storageTxHash}`);
    console.log(`Explorer:   ${config.explorer.browserUrl}/tx/${outcome.storageTxHash}`);
  }
  console.log('');
}

main().catch((error) => {
  console.error('\nE2E FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
