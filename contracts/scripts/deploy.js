const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying Credora Loan Contract...");

  // Get the contract factory
  const Loan = await hre.ethers.getContractFactory("Loan");
  
  // Deploy the contract
  const loan = await Loan.deploy();
  
  await loan.deployed();
  
  console.log("✅ Credora Loan Contract deployed to:", loan.address);
  console.log("📋 Contract details:");
  console.log("   - Interest Rate: 5%");
  console.log("   - Loan Duration: 30 days");
  console.log("   - Min Balance Threshold: 0.5 ETH");
  console.log("   - Min Transaction Count: 10");
  
  // Verify the contract on Etherscan (if not on localhost)
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("⏳ Waiting for block confirmations...");
    await loan.deployTransaction.wait(6);
    
    try {
      await hre.run("verify:verify", {
        address: loan.address,
        constructorArguments: [],
      });
      console.log("✅ Contract verified on Etherscan");
    } catch (error) {
      console.log("❌ Contract verification failed:", error.message);
    }
  }
  
  console.log("\n🎉 Deployment completed successfully!");
  console.log("📝 Next steps:");
  console.log("   1. Update frontend with contract address:", loan.address);
  console.log("   2. Test the contract functions");
  console.log("   3. Set up backend API");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
