// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Credora Loan Contract
 * @dev AI-powered decentralized lending smart contract
 * @notice Wave 1 MVP - Basic loan functionality with rule-based approval
 */
contract Loan is ReentrancyGuard, Ownable {
    
    // Loan states
    enum LoanState { Requested, Active, Repaid, Defaulted }
    
    // Loan structure
    struct LoanInfo {
        uint256 amount;
        uint256 interestRate;
        uint256 startTime;
        uint256 dueTime;
        LoanState state;
        bool exists;
    }
    
    // Constants
    uint256 public constant INTEREST_RATE = 5; // 5% fixed interest
    uint256 public constant LOAN_DURATION = 30 days;
    uint256 public constant MIN_BALANCE_THRESHOLD = 0.5 ether;
    uint256 public constant MIN_TX_COUNT = 10;
    
    // State variables
    mapping(address => LoanInfo) public loans;
    mapping(address => uint256) public borrowerTxCounts;
    
    // Events
    event LoanRequested(address indexed borrower, uint256 amount, uint256 timestamp);
    event LoanApproved(address indexed borrower, uint256 amount, uint256 timestamp);
    event LoanRepaid(address indexed borrower, uint256 amount, uint256 interest, uint256 timestamp);
    event LoanDefaulted(address indexed borrower, uint256 amount, uint256 timestamp);
    
    // Modifiers
    modifier onlyBorrower() {
        require(loans[msg.sender].exists, "No active loan found");
        _;
    }
    
    modifier loanNotExists() {
        require(!loans[msg.sender].exists, "Active loan already exists");
        _;
    }
    
    /**
     * @dev Request a loan - basic rule-based approval
     * @param amount Amount to borrow in wei
     */
    function requestLoan(uint256 amount) external payable loanNotExists {
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value >= MIN_BALANCE_THRESHOLD, "Insufficient balance for loan approval");
        
        // Update transaction count (simplified - in real scenario this would come from backend)
        borrowerTxCounts[msg.sender]++;
        
        // Check basic eligibility rules
        bool isEligible = _checkEligibility(msg.sender, amount);
        
        if (isEligible) {
            // Approve and create loan
            _createLoan(msg.sender, amount);
            emit LoanApproved(msg.sender, amount, block.timestamp);
        } else {
            // Reject loan request
            emit LoanRequested(msg.sender, amount, block.timestamp);
            revert("Loan request denied - eligibility criteria not met");
        }
    }
    
    /**
     * @dev Repay loan with interest
     */
    function repayLoan() external payable onlyBorrower nonReentrant {
        LoanInfo storage loan = loans[msg.sender];
        require(loan.state == LoanState.Active, "Loan is not active");
        require(block.timestamp <= loan.dueTime, "Loan has expired");
        
        uint256 totalAmount = loan.amount + _calculateInterest(loan.amount);
        require(msg.value >= totalAmount, "Insufficient repayment amount");
        
        // Mark loan as repaid
        loan.state = LoanState.Repaid;
        
        // Clear loan data
        delete loans[msg.sender];
        
        emit LoanRepaid(msg.sender, loan.amount, _calculateInterest(loan.amount), block.timestamp);
        
        // Return excess payment
        if (msg.value > totalAmount) {
            payable(msg.sender).transfer(msg.value - totalAmount);
        }
    }
    
    /**
     * @dev Get loan information for a borrower
     * @param borrower Address of the borrower
     * @return Loan information
     */
    function getLoanInfo(address borrower) external view returns (LoanInfo memory) {
        return loans[borrower];
    }
    
    /**
     * @dev Get borrower's transaction count
     * @param borrower Address of the borrower
     * @return Transaction count
     */
    function getBorrowerTxCount(address borrower) external view returns (uint256) {
        return borrowerTxCounts[borrower];
    }
    
    /**
     * @dev Check if address has active loan
     * @param borrower Address to check
     * @return True if has active loan
     */
    function hasActiveLoan(address borrower) external view returns (bool) {
        return loans[borrower].exists && loans[borrower].state == LoanState.Active;
    }
    
    /**
     * @dev Internal function to check eligibility
     * @param borrower Address of the borrower
     * @param amount Amount requested
     * @return True if eligible
     */
    function _checkEligibility(address borrower, uint256 amount) internal view returns (bool) {
        // Basic rule: balance > 0.5 ETH and tx count > 10
        bool hasMinBalance = address(borrower).balance >= MIN_BALANCE_THRESHOLD;
        bool hasMinTxCount = borrowerTxCounts[borrower] >= MIN_TX_COUNT;
        
        return hasMinBalance && hasMinTxCount;
    }
    
    /**
     * @dev Internal function to create loan
     * @param borrower Address of the borrower
     * @param amount Amount to borrow
     */
    function _createLoan(address borrower, uint256 amount) internal {
        loans[borrower] = LoanInfo({
            amount: amount,
            interestRate: INTEREST_RATE,
            startTime: block.timestamp,
            dueTime: block.timestamp + LOAN_DURATION,
            state: LoanState.Active,
            exists: true
        });
    }
    
    /**
     * @dev Calculate interest for a loan amount
     * @param amount Principal amount
     * @return Interest amount
     */
    function _calculateInterest(uint256 amount) internal pure returns (uint256) {
        return (amount * INTEREST_RATE) / 100;
    }
    
    /**
     * @dev Owner function to set transaction count for testing
     * @param borrower Address of the borrower
     * @param txCount Transaction count to set
     */
    function setBorrowerTxCount(address borrower, uint256 txCount) external onlyOwner {
        borrowerTxCounts[borrower] = txCount;
    }
    
    /**
     * @dev Emergency function to withdraw contract balance (owner only)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}
