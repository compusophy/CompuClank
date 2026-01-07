import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Resetting stale proposals with account:", deployer.address);

  const diamond = await ethers.getContractAt(
    [
      "function adminResetChildCreationVoting(uint256)",
      "function adminResetLaunchVoting(uint256)",
    ],
    DIAMOND_ADDRESS
  );

  // Reset CABAL0's stuck child creation voting
  console.log("\nResetting CABAL0 child creation voting...");
  const tx1 = await diamond.adminResetChildCreationVoting(0);
  console.log("Transaction:", tx1.hash);
  await tx1.wait();
  console.log("CABAL0 child creation voting reset!");

  // Reset CABAL1's stuck launch voting
  console.log("\nResetting CABAL1 launch voting...");
  const tx2 = await diamond.adminResetLaunchVoting(1);
  console.log("Transaction:", tx2.hash);
  await tx2.wait();
  console.log("CABAL1 launch voting reset!");

  console.log("\n=== Done ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
