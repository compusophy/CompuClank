import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// Proposal states
const PROPOSAL_STATES = ["Pending", "Active", "Succeeded", "Defeated", "Expired", "Executed", "Cancelled"];

async function main() {
  console.log("Checking all proposals...\n");

  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const govFacet = await ethers.getContractAt("GovernanceFacet", DIAMOND_ADDRESS);
  const childCreationFacet = await ethers.getContractAt("ChildCreationFacet", DIAMOND_ADDRESS);

  const currentBlock = await ethers.provider.getBlockNumber();
  console.log("Current block:", currentBlock);

  const allCabalIds = await viewFacet.getAllCabals();
  console.log(`Found ${allCabalIds.length} cabals\n`);

  for (const cabalId of allCabalIds) {
    const id = Number(cabalId);
    const cabal = await viewFacet.getCabal(id);

    // Skip presale cabals (no governance)
    if (cabal.phase !== 1n) continue;

    console.log(`=== CABAL${id}: ${cabal.name} ===`);

    // Check governance proposals
    const nextProposalId = await govFacet.getNextProposalId(id);
    console.log(`  Governance Proposals: ${nextProposalId}`);

    for (let pId = 0n; pId < nextProposalId; pId++) {
      const proposal = await govFacet.getProposal(id, pId);
      const state = await govFacet.getProposalState(id, pId);

      console.log(`\n  Proposal #${pId}:`);
      console.log(`    Description: ${proposal.description || "(none)"}`);
      console.log(`    State: ${PROPOSAL_STATES[Number(state)]} (${state})`);
      console.log(`    For: ${ethers.formatEther(proposal.forVotes)} | Against: ${ethers.formatEther(proposal.againstVotes)}`);
      console.log(`    Start Block: ${proposal.startBlock} | End Block: ${proposal.endBlock}`);
      console.log(`    Blocks remaining: ${Number(proposal.endBlock) > currentBlock ? Number(proposal.endBlock) - currentBlock : "ENDED"}`);
      console.log(`    Executed: ${proposal.executed} | Cancelled: ${proposal.cancelled}`);
    }

    // Check child creation voting (separate system)
    try {
      const childVote = await childCreationFacet.getChildCreationVoteStatus(id);
      if (childVote.votesFor > 0n || childVote.votesAgainst > 0n || childVote.approvedAt > 0n) {
        console.log(`\n  Child Creation Vote:`);
        console.log(`    Votes For: ${ethers.formatEther(childVote.votesFor)}`);
        console.log(`    Votes Against: ${ethers.formatEther(childVote.votesAgainst)}`);
        console.log(`    Majority Required: ${ethers.formatEther(childVote.majorityRequired)}`);
        console.log(`    Majority Met: ${childVote.majorityMet}`);
        console.log(`    Approved At: ${childVote.approvedAt > 0n ? new Date(Number(childVote.approvedAt) * 1000).toISOString() : "Not approved"}`);
        console.log(`    Finalizable At: ${childVote.finalizableAt > 0n ? new Date(Number(childVote.finalizableAt) * 1000).toISOString() : "N/A"}`);
      }
    } catch {
      // Child creation facet might not exist
    }

    console.log("");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
