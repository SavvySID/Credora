const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Credora Loan Contract", function () {
  let loan;
  let owner;
  let borrower;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, borrower, addr1, addr2] = await ethers.getSigners();
    
    const Loan = await ethers.getContractFactory("Loan");
    loan = await Loan.deploy();
    await loan.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await loan.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await loan.INTEREST_RATE()).to.equal(5);
      expect(await loan.LOAN_DURATION()).to.equal(30 * 24 * 60 * 60); // 30 days in seconds
      expect(await loan.MIN_BALANCE_THRESHOLD()).to.equal(ethers.utils.parseEther("0.5"));
      expect(await loan.MIN_TX_COUNT()).to.equal(10);
    });
  });

  describe("Loan Requests", function () {
    it("Should reject loan request with insufficient balance", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      await expect(
        loan.connect(borrower).requestLoan(amount, { value: ethers.utils.parseEther("0.1") })
      ).to.be.revertedWith("Insufficient balance for loan approval");
    });

    it("Should reject loan request with insufficient transaction count", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      // Set low transaction count
      await loan.setBorrowerTxCount(borrower.address, 5);
      
      await expect(
        loan.connect(borrower).requestLoan(amount, { value: ethers.utils.parseEther("0.6") })
      ).to.be.revertedWith("Loan request denied - eligibility criteria not met");
    });

    it("Should approve loan when all criteria are met", async function () {
      const amount = ethers.utils.parseEther("1.0");
      
      // Set sufficient transaction count
      await loan.setBorrowerTxCount(borrower.address, 15);
      
      await expect(
        loan.connect(borrower).requestLoan(amount, { value: ethers.utils.parseEther("0.6") })
      ).to.emit(loan, "LoanApproved");
      
      const loanInfo = await loan.getLoanInfo(borrower.address);
      expect(loanInfo.amount).to.equal(amount);
      expect(loanInfo.state).to.equal(1); // Active state
    });
  });

  describe("Loan Repayment", function () {
    beforeEach(async function () {
      // Set up an active loan
      await loan.setBorrowerTxCount(borrower.address, 15);
      await loan.connect(borrower).requestLoan(
        ethers.utils.parseEther("1.0"), 
        { value: ethers.utils.parseEther("0.6") }
      );
    });

    it("Should allow loan repayment with correct amount", async function () {
      const loanInfo = await loan.getLoanInfo(borrower.address);
      const totalAmount = loanInfo.amount.add(
        loanInfo.amount.mul(5).div(100) // 5% interest
      );
      
      await expect(
        loan.connect(borrower).repayLoan({ value: totalAmount })
      ).to.emit(loan, "LoanRepaid");
      
      const updatedLoanInfo = await loan.getLoanInfo(borrower.address);
      expect(updatedLoanInfo.exists).to.be.false;
    });

    it("Should reject repayment from non-borrower", async function () {
      const loanInfo = await loan.getLoanInfo(borrower.address);
      const totalAmount = loanInfo.amount.add(
        loanInfo.amount.mul(5).div(100)
      );
      
      await expect(
        loan.connect(addr1).repayLoan({ value: totalAmount })
      ).to.be.revertedWith("No active loan found");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to set transaction count", async function () {
      await loan.setBorrowerTxCount(borrower.address, 20);
      expect(await loan.getBorrowerTxCount(borrower.address)).to.equal(20);
    });

    it("Should not allow non-owner to set transaction count", async function () {
      await expect(
        loan.connect(borrower).setBorrowerTxCount(addr1.address, 20)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
