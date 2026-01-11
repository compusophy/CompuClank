import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// New governance settings - 10 minutes voting on Base (2s blocks)
const NEW_VOTING_PERIOD = 300;  // 300 blocks = 10 minutes
const NEW_QUORUM_BPS = 1000;    // 10% quorum
const NEW_MAJORITY_BPS = 5100;  // 51% majority
const NEW_PROPOSAL_THRESHOLD = 0; // No minimum to propose

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Fixing governance settings for ALL cabals");
  console.log("Account:", deployer.address);
  console.log("\nNew Settings:");
  console.log(`  Voting Period: ${NEW_VOTING_PERIOD} blocks (~${Math.round(NEW_VOTING_PERIOD * 2 / 60)} minutes)`);
  console.log(`  Quorum: ${NEW_QUORUM_BPS / 100}%`);
  console.log(`  Majority: ${NEW_MAJORITY_BPS / 100}%`);
  console.log(`  Proposal Threshold: ${NEW_PROPOSAL_THRESHOLD}`);

  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const govFacet = await ethers.getContractAt("GovernanceFacet", DIAMOND_ADDRESS);
  const childCreationFacet = await ethers.getContractAt("ChildCreationFacet", DIAMOND_ADDRESS);

  const allCabalIds = await viewFacet.getAllCabals();
  console.log(`\nFound ${allCabalIds.length} cabals\n`);

  for (const cabalId of allCabalIds) {
    const id = Number(cabalId);
    const cabal = await viewFacet.getCabal(id);
    
    console.log(`\n=== CABAL${id}: ${cabal.name} ===`);
    console.log(`  Phase: ${cabal.phase === 0n ? "Presale" : cabal.phase === 1n ? "Active" : "Other"}`);
    console.log(`  TBA: ${cabal.tbaAddress}`);

    // Skip presale cabals (no governance to update)
    if (cabal.phase !== 1n) {
      console.log("  ⏭️  Skipping (not active)");
      continue;
    }

    // Get current settings
    const currentSettings = await settingsFacet.getGovernanceSettings(id);
    console.log(`  Current Voting Period: ${currentSettings.votingPeriod} blocks`);

    // Check if settings need updating
    if (currentSettings.votingPeriod === BigInt(NEW_VOTING_PERIOD)) {
      console.log("  ✓ Settings already correct");
    } else {
      // Update governance settings using admin function
      console.log("  📝 Updating governance settings...");
      
      try {
        const tx = await settingsFacet.adminUpdateGovernanceSettings(id, {
          votingPeriod: NEW_VOTING_PERIOD,
          quorumBps: NEW_QUORUM_BPS,
          majorityBps: NEW_MAJORITY_BPS,
          proposalThreshold: NEW_PROPOSAL_THRESHOLD,
        });
        await tx.wait();
        console.log("  ✓ Settings updated!");
      } catch (e: any) {
        console.log(`  ❌ Failed to update: ${e.message.split('\n')[0]}`);
      }
    }

    // Check for stuck governance proposals
    const nextProposalId = await govFacet.getNextProposalId(id);
    if (nextProposalId > 0n) {
      for (let pId = 0n; pId < nextProposalId; pId++) {
        const state = await govFacet.getProposalState(id, pId);
        // State: 0=Pending, 1=Active, 2=Succeeded
        if (state === 0n || state === 1n || state === 2n) {
          const proposal = await govFacet.getProposal(id, pId);
          const currentBlock = await ethers.provider.getBlockNumber();
          const blocksRemaining = Number(proposal.endBlock) - currentBlock;
          
          console.log(`\n  ⚠️  Active/Pending Proposal #${pId}: "${proposal.description}"`);
          console.log(`     State: ${state === 0n ? "Pending" : state === 1n ? "Active" : "Succeeded"}`);
          console.log(`     Blocks remaining: ${blocksRemaining > 0 ? blocksRemaining : "ENDED"}`);
          
          // Cancel the proposal
          console.log(`     🗑️  Cancelling proposal...`);
          try {
            const tx = await govFacet.adminCancelProposal(id, pId);
            await tx.wait();
            console.log(`     ✓ Proposal cancelled!`);
          } catch (e: any) {
            console.log(`     ❌ Failed to cancel: ${e.message.split('\n')[0]}`);
          }
        }
      }
    }

    // Reset child creation votes
    try {
      const childVote = await childCreationFacet.getChildCreationVoteStatus(id);
      if (childVote.votesFor > 0n || childVote.votesAgainst > 0n || childVote.approvedAt > 0n) {
        console.log(`\n  🗳️  Resetting child creation vote...`);
        const tx = await childCreationFacet.adminResetChildCreationVoting(id);
        await tx.wait();
        console.log("  ✓ Child creation vote reset!");
      }
    } catch (e: any) {
      // Might not have active child vote
    }
  }

  console.log("\n=== Complete! ===");
  console.log("\nNote: Existing active proposals still have old voting periods.");
  console.log("They can be cancelled by the proposer and recreated with new settings.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
