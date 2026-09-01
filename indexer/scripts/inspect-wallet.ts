/**
 * Prints the real wallet snapshot the scoring layer would see.
 * Diagnostic tool - reads only, needs no credential.
 *
 *   npm run inspect:wallet -- 0xYourAddress
 */
import { isAddress } from 'ethers';
import { fetchWalletSnapshot } from '../src/chain/walletActivity';
import { config } from '../src/config';

const address = process.argv[2];

if (!address || !isAddress(address)) {
  console.error('Usage: npm run inspect:wallet -- <0x address>');
  process.exit(1);
}

const snapshot = await fetchWalletSnapshot(address);

console.log(`\nWallet ${snapshot.address} on chain ${snapshot.chainId}`);
console.log('='.repeat(60));
console.log(`balance          ${snapshot.balanceFormatted} 0G (${snapshot.balanceWei} wei)`);
console.log(`nonce            ${snapshot.transactionCount} outbound transactions`);
console.log(`history returned ${snapshot.transactions.length} transaction(s)`);
console.log(`first seen       ${snapshot.firstSeen ?? 'unknown'}`);
console.log(`last activity    ${snapshot.lastActivity ?? 'unknown'}`);

if (snapshot.degraded) {
  console.log(`\nDEGRADED: transaction history unavailable - ${snapshot.degradedReason}`);
  console.log('The empty list means unknown, not inactive. Nothing was substituted.');
} else {
  for (const tx of snapshot.transactions.slice(0, 5)) {
    console.log(
      `\n  ${tx.direction.padEnd(4)} ${tx.hash}\n       block ${tx.blockNumber}  ${tx.valueWei} wei  ${tx.timestamp}${
        tx.isError ? '  [reverted]' : ''
      }`,
    );
  }
  if (snapshot.transactions.length > 0) {
    console.log(`\n  explorer: ${config.explorer.browserUrl}/address/${snapshot.address}`);
  }
}

console.log('');
