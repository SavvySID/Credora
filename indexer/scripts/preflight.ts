/**
 * Checks every dependency that does NOT require a credential, and reports the
 * ones that do as BLOCKED. Safe to run before any key is provisioned.
 *
 * Exit code is 0 when all credential-free checks pass, even if credentialed
 * capabilities are blocked - blocked is a known state, not a failure.
 */
import { capabilitySummary, config } from '../src/config';
import { probeChain } from '../src/chain/provider';
import { probeExplorer } from '../src/chain/walletActivity';
import { computeRootHash, getUploadAccount, probeStorage } from '../src/og/storage';
import { canonicalBytes } from '../src/records/canonical';
import { buildStoredRecord, checkRecordIntegrity } from '../src/records/schema';
import { getDb } from '../src/store/db';

const results: Array<{ name: string; ok: boolean | 'blocked'; detail: string }> = [];

function report(name: string, ok: boolean | 'blocked', detail: string) {
  results.push({ name, ok, detail });
  const icon = ok === true ? 'PASS   ' : ok === 'blocked' ? 'BLOCKED' : 'FAIL   ';
  console.log(`${icon} ${name}\n         ${detail}\n`);
}

async function main() {
  console.log('\nCredora indexer preflight\n' + '='.repeat(60) + '\n');

  // 1. Local index
  try {
    getDb();
    report('SQLite index', true, `Opened ${config.store.path} (derived index/cache only)`);
  } catch (error) {
    report('SQLite index', false, error instanceof Error ? error.message : String(error));
  }

  // 2. Canonical serialisation + integrity check, entirely offline
  try {
    const record = buildStoredRecord({
      schemaVersion: 1,
      wallet: '0x0000000000000000000000000000000000000001',
      eventType: 'wallet_transaction',
      loanId: null,
      txHash: null,
      blockNumber: null,
      logIndex: null,
      timestamp: '2026-01-01T00:00:00.000Z',
      chainId: config.chain.chainId,
      source: 'derived',
      values: {},
      meta: { purpose: 'preflight' },
    });

    const integrity = checkRecordIntegrity(record);
    const tampered = checkRecordIntegrity({ ...record, wallet: '0x0000000000000000000000000000000000000002' });

    if (integrity.ok && !tampered.ok) {
      report(
        'Record integrity',
        true,
        `recordId ${record.recordId.slice(0, 18)}... verifies, and a tampered copy is correctly rejected`,
      );
    } else {
      report('Record integrity', false, 'Integrity check did not behave as expected');
    }
  } catch (error) {
    report('Record integrity', false, error instanceof Error ? error.message : String(error));
  }

  // 3. Merkle root computation - local, no key, no network
  try {
    const bytes = canonicalBytes({ hello: '0g' });
    const root = await computeRootHash(bytes);
    const again = await computeRootHash(bytes);
    report(
      '0G merkle root (local)',
      root === again,
      `Deterministic root ${root} for ${bytes.length} bytes`,
    );
  } catch (error) {
    report('0G merkle root (local)', false, error instanceof Error ? error.message : String(error));
  }

  // 4. Chain RPC
  const chain = await probeChain();
  report(
    '0G Chain RPC',
    chain.reachable && chain.chainId === config.chain.chainId,
    chain.reachable
      ? `chainId ${chain.chainId} (expected ${config.chain.chainId}), head block ${chain.blockNumber}`
      : `Unreachable: ${chain.error}`,
  );

  // 5. 0G Storage indexer (read path needs no credential)
  const storage = await probeStorage();
  report(
    '0G Storage indexer (read)',
    storage.reachable,
    storage.reachable
      ? `${storage.endpoint} reachable, ${storage.trustedNodes} trusted node(s)`
      : `Unreachable: ${storage.error}`,
  );

  // 6. Explorer
  const explorer = await probeExplorer();
  report(
    '0G Chain Scan (tx history)',
    explorer.reachable,
    explorer.reachable ? `${config.explorer.apiUrl} reachable` : `Unreachable: ${explorer.error}`,
  );

  // 7. Credentialed capabilities
  const caps = capabilitySummary();

  if (caps.ogWrite.available) {
    const account = await getUploadAccount();
    report(
      '0G Storage writes',
      account?.funded === true,
      account
        ? `Signer ${account.address} balance ${account.balanceWei} wei${
            account.funded ? '' : ' - NOT FUNDED, uploads will fail. Use https://faucet.0g.ai'
          }`
        : 'Signer could not be resolved',
    );
  } else {
    report('0G Storage writes', 'blocked', caps.ogWrite.blockedReason!);
  }

  report(
    'Loan.sol event indexing',
    caps.loanIndexing.available ? true : 'blocked',
    caps.loanIndexing.blockedReason ?? `Contract configured at ${config.loan.address}`,
  );

  console.log('='.repeat(60));
  const failed = results.filter((entry) => entry.ok === false);
  const blockedCount = results.filter((entry) => entry.ok === 'blocked').length;

  console.log(
    `${results.length - failed.length - blockedCount} passed, ${failed.length} failed, ${blockedCount} blocked\n`,
  );

  if (blockedCount > 0) {
    console.log('BLOCKED items need credentials or a deployment. They are not failures.\n');
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Preflight crashed:', error);
  process.exit(1);
});
