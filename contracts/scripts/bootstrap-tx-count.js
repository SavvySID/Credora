const hre = require("hardhat");

/**
 * Loan.sol eligibility uses an owner-set borrowerTxCounts mapping, not the
 * wallet's real Galileo nonce. This script calls setBorrowerTxCount so a
 * test borrower can pass MIN_TX_COUNT without implying the contract reads
 * on-chain history.
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/bootstrap-tx-count.js --network galileo
 *
 * Env:
 *   BORROWER_ADDRESS  wallet to bootstrap (defaults to the deployer)
 *   TX_COUNT          value to set (defaults to 10)
 */
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const fs = require("fs");
  const path = require("path");

  const artifactPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`No deployment artifact at ${artifactPath}. Deploy first with npm run deploy:galileo`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const Loan = await hre.ethers.getContractFactory("Loan");
  const loan = Loan.attach(artifact.address).connect(signer);

  const borrower = (process.env.BORROWER_ADDRESS || signer.address).trim();
  const txCount = Number.parseInt(process.env.TX_COUNT || "10", 10);

  console.log(`Network           ${network}`);
  console.log(`Loan.sol          ${artifact.address}`);
  console.log(`Owner / signer    ${signer.address}`);
  console.log(`Borrower          ${borrower}`);
  console.log(`setBorrowerTxCount(${borrower}, ${txCount})`);
  console.log("This does NOT read the wallet nonce. It writes the contract's internal counter.");

  const tx = await loan.setBorrowerTxCount(borrower, txCount);
  console.log(`tx                ${tx.hash}`);
  await tx.wait();

  const stored = await loan.getBorrowerTxCount(borrower);
  console.log(`getBorrowerTxCount ${stored.toString()}`);
}

main()
  .then(async () => {
    try {
      if (hre.network.provider?.destroy) await hre.network.provider.destroy();
    } catch {
      /* ignore */
    }
    const delayMs = process.platform === "win32" ? 250 : 0;
    setTimeout(() => process.exit(0), delayMs);
  })
  .catch(async (error) => {
    console.error("Bootstrap failed:", error);
    process.exit(1);
  });
