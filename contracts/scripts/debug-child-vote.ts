import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const USER_ADDRESS = "0xDcAa03A2Ff649B233946E6d9960f98D67fAf802B"; // Kyle's address

async function main() {
  const childFacet = await ethers.getContractAt("ChildCreationFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const stakingFacet = await ethers.getContractAt("StakingFacet", DIAMOND_ADDRESS);
  
  console.log("=== Full Child Vote Debug for CABAL 0 ===\n");
  
  // Get cabal info
  const cabal = await viewFacet.getCabal(0);
  console.log(`CABAL0 Phase: ${cabal.phase} (0=Presale, 1=Active, 2=Failed)`);
  console.log(`Total Staked: ${ethers.formatEther(cabal.totalStaked)} tokens`);
  
  // Get user's stake
  const userStake = await stakingFacet.getStakedBalance(0, USER_ADDRESS);
  console.log(`\nUser Staked: ${ethers.formatEther(userStake)} tokens`);
  
  // Check if user has voted
  try {
    const hasVoted = await childFacet.hasVotedCreateChild(0, USER_ADDRESS);
    console.log(`User has voted: ${hasVoted}`);
  } catch (e: any) {
    console.log(`Error checking hasVoted: ${e.message}`);
  }
  
  // Get vote status
  try {
    const status = await childFacet.getChildCreationVoteStatus(0);
    console.log(`\nVotes For: ${ethers.formatEther(status.votesFor)} tokens`);
    console.log(`Votes Against: ${ethers.formatEther(status.votesAgainst)} tokens`);
    console.log(`Approved At: ${status.approvedAt}`);
  } catch (e: any) {
    console.log(`Error getting vote status: ${e.message}`);
  }
  
  // Check if there are any children
  const children = await viewFacet.getChildCabals(0);
  console.log(`\nChild cabals: [${children.join(", ")}]`);
}

main().catch(console.error);
