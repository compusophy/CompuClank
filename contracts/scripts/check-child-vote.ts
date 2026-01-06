import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const childFacet = await ethers.getContractAt("ChildCreationFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  console.log("=== Child Creation Vote Status for CABAL 0 ===\n");
  
  try {
    const status = await childFacet.getChildCreationVoteStatus(0);
    console.log(`Votes For: ${ethers.formatEther(status.votesFor)} tokens`);
    console.log(`Votes Against: ${ethers.formatEther(status.votesAgainst)} tokens`);
    console.log(`Approved At: ${status.approvedAt} (${status.approvedAt > 0 ? new Date(Number(status.approvedAt) * 1000).toISOString() : "Not approved yet"})`);
    console.log(`Is Approved: ${status.isApproved}`);
    console.log(`Can Finalize: ${status.canFinalize}`);
    
    if (status.approvedAt > 0) {
      const now = Math.floor(Date.now() / 1000);
      const cooldownEnd = Number(status.approvedAt) + 600; // 10 min cooldown
      const remaining = cooldownEnd - now;
      console.log(`\nCooldown ends at: ${new Date(cooldownEnd * 1000).toISOString()}`);
      console.log(`Remaining: ${remaining > 0 ? remaining + " seconds" : "READY TO FINALIZE"}`);
    }
  } catch (e: any) {
    console.log("Error getting vote status:", e.message);
  }
  
  // Check total staked
  const cabal = await viewFacet.getCabal(0);
  console.log(`\nTotal Staked in CABAL0: ${ethers.formatEther(cabal.totalStaked)} tokens`);
}

main().catch(console.error);
