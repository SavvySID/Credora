const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Credora Loan Contract", function () {
  let loan;
  let owner;
  let borrower;
  let addr1;

  beforeEach(async function () {
    [owner, borrower, addr1] = await ethers.getSigners();

    const Loan = await ethers.getContractFactory("Loan");
    loan = await Loan.deploy();
    await loan.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await loan.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await loan.INTEREST_RATE()).to.equal(5n);
      expect(await loan.LOAN_DURATION()).to.equal(30n * 24n * 60n * 60n);
      expect(await loan.MIN_BALANCE_THRESHOLD()).to.equal(ethers.parseEther("0.5"));
      expect(await loan.MIN_TX_COUNT()).to.equal(10n);
    });
  });

  describe("Loan Requests", function () {
    it("Should reject loan request with insufficient deposit", async function () {
      const amount = ethers.parseEther("1.0");

      await expect(
        loan.connect(borrower).requestLoan(amount, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Insufficient balance for loan approval");
    });

    it("Should reject loan request with insufficient transaction count", async function () {
      const amount = ethers.parseEther("1.0");

      await loan.setBorrowerTxCount(borrower.address, 5);

      await expect(
        loan.connect(borrower).requestLoan(amount, { value: ethers.parseEther("0.6") })
      ).to.be.revertedWith("Loan request denied - eligibility criteria not met");
    });

    it("Should approve loan when all criteria are met", async function () {
      const amount = ethers.parseEther("1.0");

      await loan.setBorrowerTxCount(borrower.address, 15);

      await expect(
        loan.connect(borrower).requestLoan(amount, { value: ethers.parseEther("0.6") })
      ).to.emit(loan, "LoanApproved");

      const loanInfo = await loan.getLoanInfo(borrower.address);
      expect(loanInfo.amount).to.equal(amount);
      expect(loanInfo.state).to.equal(1n); // Active
    });
  });

  describe("Loan Repayment", function () {
    beforeEach(async function () {
      await loan.setBorrowerTxCount(borrower.address, 15);
      await loan.connect(borrower).requestLoan(
        ethers.parseEther("1.0"),
        { value: ethers.parseEther("0.6") }
      );
    });

    it("Should allow loan repayment with correct amount", async function () {
      const loanInfo = await loan.getLoanInfo(borrower.address);
      const totalAmount = loanInfo.amount + (loanInfo.amount * 5n) / 100n;

      await expect(
        loan.connect(borrower).repayLoan({ value: totalAmount })
      ).to.emit(loan, "LoanRepaid");

      const updatedLoanInfo = await loan.getLoanInfo(borrower.address);
      expect(updatedLoanInfo.exists).to.equal(false);
    });

    it("Should reject repayment from non-borrower", async function () {
      const loanInfo = await loan.getLoanInfo(borrower.address);
      const totalAmount = loanInfo.amount + (loanInfo.amount * 5n) / 100n;

      await expect(
        loan.connect(addr1).repayLoan({ value: totalAmount })
      ).to.be.revertedWith("No active loan found");
    });
  });

  describe("Owner Functions", function () {
    it("Should allow owner to set transaction count", async function () {
      await loan.setBorrowerTxCount(borrower.address, 20);
      expect(await loan.getBorrowerTxCount(borrower.address)).to.equal(20n);
    });

    it("Should not allow non-owner to set transaction count", async function () {
      await expect(
        loan.connect(borrower).setBorrowerTxCount(addr1.address, 20)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
