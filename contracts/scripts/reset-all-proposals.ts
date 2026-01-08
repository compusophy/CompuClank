import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Resetting ALL child creation proposals");
  console.log("Account:", deployer.address);

  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const childCreationFacet = await ethers.getContractAt("ChildCreationFacet", DIAMOND_ADDRESS);
  
  // Get all cabals
  const allCabalIds = await viewFacet.getAllCabals();
  console.log(`\nFound ${allCabalIds.length} cabals`);
  
  for (const cabalId of allCabalIds) {
    const id = Number(cabalId);
    
    // Check current status
    const status = await childCreationFacet.getChildCreationVoteStatus(id);
    const hasActiveVote = status.votesFor > 0n || status.votesAgainst > 0n || status.approvedAt > 0n;
    
    if (hasActiveVote) {
      console.log(`\n=== CABAL${id} - Has Active Proposal ===`);
      console.log("  Votes For:", ethers.formatEther(status.votesFor));
      console.log("  Votes Against:", ethers.formatEther(status.votesAgainst));
      console.log("  Approved At:", status.approvedAt.toString());
      
      // Reset the vote
      console.log("  Resetting...");
      const tx = await childCreationFacet.adminResetChildCreationVoting(id);
      await tx.wait();
      console.log("  ✓ Reset complete!");
    } else {
      console.log(`CABAL${id} - No active proposal, skipping`);
    }
  }
  
  console.log("\n=== All proposals reset! ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
