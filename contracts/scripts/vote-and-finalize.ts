import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Voting and finalizing CABAL0...");
  console.log("Account:", signer.address);
  
  const creationFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Get current vote status
  let voteStatus = await creationFacet.getLaunchVoteStatus(0);
  console.log("\n--- Current Vote Status ---");
  console.log("Votes For:", ethers.formatEther(voteStatus[0]), "ETH");
  console.log("Votes Against:", ethers.formatEther(voteStatus[1]), "ETH");
  console.log("Total Raised:", ethers.formatEther(voteStatus[2]), "ETH");
  console.log("Majority Required:", ethers.formatEther(voteStatus[3]), "ETH");
  console.log("Majority Met:", voteStatus[4]);
  
  // Get user's contribution
  const contribution = await viewFacet.getContribution(0, signer.address);
  console.log("\nYour contribution:", ethers.formatEther(contribution), "ETH");
  
  if (!voteStatus[4]) {
    console.log("\nVoting YES to reach majority...");
    const voteTx = await creationFacet.voteLaunch(0, true);
    console.log("Vote TX:", voteTx.hash);
    await voteTx.wait();
    console.log("✅ Vote cast!");
    
    // Check new status
    voteStatus = await creationFacet.getLaunchVoteStatus(0);
    console.log("\n--- New Vote Status ---");
    console.log("Votes For:", ethers.formatEther(voteStatus[0]), "ETH");
    console.log("Majority Met:", voteStatus[4]);
    console.log("Launchable At:", new Date(Number(voteStatus[6]) * 1000).toISOString());
  }
  
  // Check if we can finalize
  const now = Math.floor(Date.now() / 1000);
  const launchableAt = Number(voteStatus[6]);
  
  if (launchableAt > 0 && now >= launchableAt) {
    console.log("\n--- Attempting Finalization ---");
    
    // Simulate first
    try {
      await creationFacet.finalizeCabal.staticCall(0);
      console.log("✅ Simulation passed! Executing...");
      
      const finalizeTx = await creationFacet.finalizeCabal(0);
      console.log("Finalize TX:", finalizeTx.hash);
      await finalizeTx.wait();
      console.log("✅ CABAL0 finalized!");
      
      const cabal = await viewFacet.getCabal(0);
      console.log("Token Address:", cabal.tokenAddress);
    } catch (e: any) {
      console.log("❌ Simulation failed:", e.message?.slice(0, 200));
      if (e.data) {
        console.log("Error data:", e.data);
      }
    }
  } else if (launchableAt > 0) {
    console.log("\n⏰ Timer not elapsed yet. Launchable at:", new Date(launchableAt * 1000).toISOString());
    console.log("   Current time:", new Date(now * 1000).toISOString());
    console.log("   Wait", Math.ceil((launchableAt - now) / 60), "more minutes");
  } else {
    console.log("\n❌ Vote threshold not met - cannot finalize");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
