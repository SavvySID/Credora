import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../logger';

const log = createLogger('chain:abi');

/**
 * Mirrors the events and views on the deployed contracts/Loan.sol.
 * Loan.sol is deployed as-is in this phase; see LIMITATIONS.md for the gaps
 * (no loanId in events, LoanDefaulted is never emitted, no extension support).
 */
export const LOAN_ABI = [
  'event LoanRequested(address indexed borrower, uint256 amount, uint256 timestamp)',
  'event LoanApproved(address indexed borrower, uint256 amount, uint256 timestamp)',
  'event LoanRepaid(address indexed borrower, uint256 amount, uint256 interest, uint256 timestamp)',
  'event LoanDefaulted(address indexed borrower, uint256 amount, uint256 timestamp)',
  'function getLoanInfo(address borrower) view returns (tuple(uint256 amount, uint256 interestRate, uint256 startTime, uint256 dueTime, uint8 state, bool exists))',
  'function hasActiveLoan(address borrower) view returns (bool)',
  'function getBorrowerTxCount(address borrower) view returns (uint256)',
  'function INTEREST_RATE() view returns (uint256)',
  'function LOAN_DURATION() view returns (uint256)',
  'function MIN_BALANCE_THRESHOLD() view returns (uint256)',
  'function MIN_TX_COUNT() view returns (uint256)',
] as const;

/** LoanState enum ordering in Loan.sol. */
export const LOAN_STATE = ['Requested', 'Active', 'Repaid', 'Defaulted'] as const;
export type LoanState = (typeof LOAN_STATE)[number];

export interface DeploymentRecord {
  address: string;
  deployBlock: number;
  chainId: number;
}

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Falls back to the artifact written by contracts/scripts/deploy.js when the
 * env vars are not set, so a fresh deploy wires itself up automatically.
 */
export function readDeploymentArtifact(network = 'galileo'): DeploymentRecord | null {
  const candidate = resolve(join(here, '..', '..', '..', 'contracts', 'deployments', `${network}.json`));

  try {
    const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Partial<DeploymentRecord>;
    if (
      typeof parsed.address === 'string' &&
      typeof parsed.deployBlock === 'number' &&
      typeof parsed.chainId === 'number'
    ) {
      log.info(`Loaded deployment artifact for ${network}`, {
        address: parsed.address,
        deployBlock: parsed.deployBlock,
      });
      return parsed as DeploymentRecord;
    }
    log.warn(`Deployment artifact at ${candidate} is missing required fields`);
    return null;
  } catch {
    return null;
  }
}
