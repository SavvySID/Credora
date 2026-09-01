/**
 * Minimal ABI for the deployed Galileo Loan.sol.
 * Writes are payable. The contract records accounting principal; it does not
 * transfer the requested amount to the borrower.
 */
export const loanAbi = [
  {
    type: 'function',
    name: 'requestLoan',
    stateMutability: 'payable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'repayLoan',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getLoanInfo',
    stateMutability: 'view',
    inputs: [{ name: 'borrower', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'interestRate', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'dueTime', type: 'uint256' },
          { name: 'state', type: 'uint8' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'hasActiveLoan',
    stateMutability: 'view',
    inputs: [{ name: 'borrower', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getBorrowerTxCount',
    stateMutability: 'view',
    inputs: [{ name: 'borrower', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'INTEREST_RATE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'LOAN_DURATION',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'MIN_BALANCE_THRESHOLD',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'MIN_TX_COUNT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'LoanApproved',
    inputs: [
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'LoanRepaid',
    inputs: [
      { name: 'borrower', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'interest', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;
