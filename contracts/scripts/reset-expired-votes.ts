import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Checking votes/proposals with:", signer.address);

  const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
  
  const abi = [
    "function resetExpiredChildCreationVote(uint256 cabalId) external",
    "function adminResetChildCreationVoting(uint256 cabalId) external",
    "function getChildCreationVoteStatus(uint256 cabalId) external view returns (uint256 votesFor, uint256 votesAgainst, uint256 totalStaked, uint256 majorityRequired, bool majorityMet, uint256 approvedAt, uint256 finalizableAt)",
    "function getNextProposalId(uint256 cabalId) external view returns (uint256)",
    "function getProposalState(uint256 cabalId, uint256 proposalId) external view returns (uint8)",
    "function getProposal(uint256 cabalId, uint256 proposalId) external view returns (uint256 id, address proposer, uint256 forVotes, uint256 againstVotes, uint256 startBlock, uint256 endBlock, bool executed, bool cancelled, string description)"
  ];

  const diamond = new ethers.Contract(DIAMOND_ADDRESS, abi, signer);

  // Check governance proposals for cabal0
  console.log("\n=== Checking cabal0 governance proposals ===");
  try {
    const nextProposalId = await diamond.getNextProposalId(0);
    console.log("Next proposal ID:", nextProposalId.toString());
    
    for (let i = 0; i < Number(nextProposalId); i++) {
      console.log(`\n--- Proposal ${i} ---`);
      const state = await diamond.getProposalState(0, i);
      const stateNames = ["Pending", "Active", "Succeeded", "Defeated", "Executed", "Cancelled", "Expired"];
      console.log("State:", stateNames[state] || state);
      
      const proposal = await diamond.getProposal(0, i);
      console.log("Description:", proposal.description);
      console.log("For votes:", proposal.forVotes.toString());
      console.log("Against votes:", proposal.againstVotes.toString());
      console.log("Executed:", proposal.executed);
      console.log("Cancelled:", proposal.cancelled);
    }
  } catch (e: any) {
    console.log("Error:", e.message);
  }

  // Check child creation vote status
  console.log("\n=== Checking cabal0 child creation vote ===");
  try {
    const status = await diamond.getChildCreationVoteStatus(0);
    console.log("votesFor:", status.votesFor.toString());
    console.log("votesAgainst:", status.votesAgainst.toString());
    console.log("approvedAt:", status.approvedAt.toString());
    console.log("finalizableAt:", status.finalizableAt.toString());
    
    if (status.votesFor > 0n || status.votesAgainst > 0n) {
      console.log("⚠️ Active child creation vote detected");
    } else {
      console.log("No active child creation vote");
    }
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

main().catch(console.error);
