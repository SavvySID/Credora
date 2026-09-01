const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

/**
 * Resolves address + deployment block across ethers v5 and v6 style toolboxes,
 * since the indexer cannot scan from genesis and needs an exact start block.
 */
async function resolveDeployment(contract) {
  if (typeof contract.waitForDeployment === "function") {
    await contract.waitForDeployment();
    const receipt = await contract.deploymentTransaction().wait();
    return { address: await contract.getAddress(), blockNumber: receipt.blockNumber };
  }

  await contract.deployed();
  const receipt = await contract.deployTransaction.wait();
  return { address: contract.address, blockNumber: receipt.blockNumber };
}

async function main() {
  const network = hre.network.name;
  const chainId = hre.network.config.chainId;

  console.log(`Deploying Credora Loan contract to ${network} (chainId ${chainId})...`);

  const Loan = await hre.ethers.getContractFactory("Loan");
  const loan = await Loan.deploy();

  const { address, blockNumber } = await resolveDeployment(loan);

  console.log(`Loan deployed to ${address} at block ${blockNumber}`);

  const artifact = await hre.artifacts.readArtifact("Loan");
  const record = {
    contract: "Loan",
    network,
    chainId,
    address,
    // The indexer starts its log scan here. Never scan from genesis.
    deployBlock: blockNumber,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(record, null, 2)}\n`);

  console.log(`Deployment written to ${path.relative(process.cwd(), outFile)}`);

  if (network !== "localhost" && network !== "hardhat") {
    console.log("Waiting for confirmations before verification...");
    const tx = loan.deploymentTransaction ? loan.deploymentTransaction() : loan.deployTransaction;
    await tx.wait(6);

    try {
      await hre.run("verify:verify", { address, constructorArguments: [] });
      console.log("Contract verified");
    } catch (error) {
      console.log(`Contract verification skipped or failed: ${error.message}`);
    }
  }

  console.log("\nNext steps:");
  console.log(`  1. Set LOAN_CONTRACT_ADDRESS=${address}`);
  console.log(`  2. Set LOAN_DEPLOY_BLOCK=${blockNumber}`);
  console.log(`  3. Set VITE_LOAN_CONTRACT_ADDRESS=${address} for the frontend`);
}

async function shutdown() {
  try {
    if (hre.network.provider?.destroy) {
      await hre.network.provider.destroy();
    }
  } catch {
    // Best-effort cleanup only.
  }
}

function exit(code) {
  // Windows libuv can assert if process.exit races open HTTP handles from verify.
  const delayMs = process.platform === "win32" ? 250 : 0;
  setTimeout(() => process.exit(code), delayMs);
}

main()
  .then(async () => {
    await shutdown();
    exit(0);
  })
  .catch(async (error) => {
    console.error("Deployment failed:", error);
    await shutdown();
    exit(1);
  });
