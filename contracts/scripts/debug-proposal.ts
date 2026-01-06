import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 0n;
const USER_ADDRESS = "0xDcAa03A2Ff649B233946E6d9960f98D67fAf802B"; // Your address

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=".repeat(60));
  console.log("DEBUG: Why is proposeCreateChildCabal failing?");
  console.log("=".repeat(60));
  
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const govFacet = await ethers.getContractAt("GovernanceFacet", DIAMOND_ADDRESS);
  const stakingFacet = await ethers.getContractAt("StakingFacet", DIAMOND_ADDRESS);
  
  // Get cabal info
  const cabal = await viewFacet.getCabal(CABAL_ID);
  console.log("\n📊 CABAL INFO:");
  console.log("  Phase:", cabal.phase, "(0=Presale, 1=Active, 2=Closed)");
  console.log("  LaunchedAt:", cabal.launchedAt.toString());
  console.log("  TBA:", cabal.tbaAddress);
  
  // Check if active
  const isActive = cabal.phase === 1n;
  console.log("\n✅ Check 1 - Is Active?", isActive ? "YES" : "NO ❌");
  
  // Check cooldown (10 minutes = 600 seconds after upgrade, 24 hours = 86400 before)
  const now = BigInt(Math.floor(Date.now() / 1000));
  const launchedAt = cabal.launchedAt;
  const timeSinceLaunch = now - launchedAt;
  const cooldown10min = 10n * 60n;
  const cooldown24h = 24n * 60n * 60n;
  
  console.log("\n✅ Check 2 - Cooldown:");
  console.log("  Time since launch:", timeSinceLaunch.toString(), "seconds");
  console.log("  10 min cooldown passed?", timeSinceLaunch >= cooldown10min ? "YES" : "NO (need " + (cooldown10min - timeSinceLaunch).toString() + " more seconds)");
  console.log("  24 hour cooldown passed?", timeSinceLaunch >= cooldown24h ? "YES" : "NO (need " + (cooldown24h - timeSinceLaunch).toString() + " more seconds)");
  console.log("  ⚠️  Did you deploy the updated GovernanceFacet with 10 min cooldown?");
  
  // Check for active proposals
  const nextProposalId = await govFacet.getNextProposalId(CABAL_ID);
  console.log("\n✅ Check 3 - Active Proposals:");
  console.log("  Next Proposal ID:", nextProposalId.toString());
  
  if (nextProposalId > 0n) {
    const prevProposalId = nextProposalId - 1n;
    const state = await govFacet.getProposalState(CABAL_ID, prevProposalId);
    const stateNames = ["Pending", "Active", "Cancelled", "Defeated", "Succeeded", "Executed"];
    console.log("  Previous proposal state:", stateNames[Number(state)] || state.toString());
    const isBlocking = state === 0n || state === 1n; // Pending or Active
    console.log("  Is blocking new proposals?", isBlocking ? "YES ❌" : "NO");
  } else {
    console.log("  No previous proposals");
  }
  
  // Check voting power
  console.log("\n✅ Check 4 - Voting Power for", USER_ADDRESS);
  try {
    const stakedBalance = await stakingFacet.getStakedBalance(CABAL_ID, USER_ADDRESS);
    console.log("  Staked Balance:", ethers.formatEther(stakedBalance));
    
    // Check contribution (auto-staked from presale)
    const contribution = await viewFacet.getContribution(CABAL_ID, USER_ADDRESS);
    console.log("  Contribution:", ethers.formatEther(contribution), "ETH");
    
    // Check if claimed (if not claimed, contribution gives voting power)
    // This is internal, we can estimate
    if (contribution > 0n) {
      const totalRaised = cabal.totalRaised;
      const totalTokensReceived = cabal.totalTokensReceived;
      if (totalRaised > 0n) {
        const autoStaked = (contribution * totalTokensReceived) / totalRaised;
        console.log("  Auto-staked from presale:", ethers.formatEther(autoStaked));
      }
    }
    
    const proposalThreshold = cabal.settings.proposalThreshold;
    console.log("  Proposal Threshold:", proposalThreshold.toString());
    console.log("  Has enough voting power?", (stakedBalance > 0n || contribution > 0n) ? "LIKELY YES" : "NO ❌");
  } catch (e: any) {
    console.log("  Error checking voting power:", e.message?.slice(0, 80));
  }
  
  // Try to simulate the call from deployer
  console.log("\n🔬 SIMULATION (from deployer):");
  try {
    const ethContribution = ethers.parseEther("0.00001");
    
    // Check deployer voting power first
    const deployerStaked = await stakingFacet.getStakedBalance(CABAL_ID, signer.address);
    const deployerContribution = await viewFacet.getContribution(CABAL_ID, signer.address);
    console.log("  Deployer staked:", ethers.formatEther(deployerStaked));
    console.log("  Deployer contribution:", ethers.formatEther(deployerContribution));
    
    // Try static call to get the revert reason
    const result = await govFacet.proposeCreateChildCabal.staticCall(
      CABAL_ID,
      ethContribution,
      "Create child CABAL"
    );
    console.log("  ✅ Simulation succeeded! Proposal ID would be:", result.toString());
    
    // Ask if we should actually submit
    console.log("\n  🚀 Attempting REAL transaction...");
    const tx = await govFacet.proposeCreateChildCabal(
      CABAL_ID,
      ethContribution,
      "Create child CABAL"
    );
    console.log("  TX:", tx.hash);
    const receipt = await tx.wait();
    console.log("  ✅ Proposal created successfully!");
    
  } catch (e: any) {
    console.log("  ❌ Simulation failed!");
    console.log("  Error:", e.message?.slice(0, 300));
    
    // Try to decode custom error
    if (e.data) {
      console.log("  Error data:", e.data);
    }
  }
  
  console.log("\n" + "=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
