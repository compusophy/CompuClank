import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 1; // CABAL1

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Resetting child creation vote for CABAL", CABAL_ID);
  console.log("Account:", deployer.address);

  const childCreationFacet = await ethers.getContractAt("ChildCreationFacet", DIAMOND_ADDRESS);
  
  // Check current status
  console.log("\n=== Before Reset ===");
  const statusBefore = await childCreationFacet.getChildCreationVoteStatus(CABAL_ID);
  console.log("Votes For:", ethers.formatEther(statusBefore.votesFor));
  console.log("Votes Against:", ethers.formatEther(statusBefore.votesAgainst));
  console.log("Majority Met:", statusBefore.majorityMet);
  console.log("Approved At:", statusBefore.approvedAt.toString());
  
  // Reset the vote
  console.log("\n=== Resetting Vote ===");
  const tx = await childCreationFacet.adminResetChildCreationVoting(CABAL_ID);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("Reset complete!");
  
  // Check status after
  console.log("\n=== After Reset ===");
  const statusAfter = await childCreationFacet.getChildCreationVoteStatus(CABAL_ID);
  console.log("Votes For:", ethers.formatEther(statusAfter.votesFor));
  console.log("Votes Against:", ethers.formatEther(statusAfter.votesAgainst));
  console.log("Majority Met:", statusAfter.majorityMet);
  console.log("Approved At:", statusAfter.approvedAt.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
