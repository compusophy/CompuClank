import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  console.log("=== CABAL 1 Details ===\n");
  
  try {
    const cabal = await viewFacet.getCabal(1);
    console.log(`Phase: ${cabal.phase} (0=Presale, 1=Active, 2=Failed)`);
    console.log(`TBA: ${cabal.tbaAddress}`);
    console.log(`Token: ${cabal.tokenAddress}`);
    console.log(`Total Staked: ${ethers.formatEther(cabal.totalStaked)} tokens`);
    console.log(`Parent ID: ${cabal.parentCabalId}`);
    console.log(`Presale Total Raised: ${ethers.formatEther(cabal.presaleTotalRaised)} ETH`);
    console.log(`Launch Votes For: ${ethers.formatEther(cabal.launchVotesFor)} tokens`);
    console.log(`Launch Votes Against: ${ethers.formatEther(cabal.launchVotesAgainst)} tokens`);
    console.log(`Created At: ${cabal.createdAt}`);
    
    // Check ETH balance of TBA
    const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
    console.log(`\nTBA ETH Balance: ${ethers.formatEther(tbaBalance)} ETH`);
    
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
  
  // Check hierarchical IDs
  const ids = await viewFacet.getHierarchicalCabalIds();
  console.log(`\nHierarchical IDs: [${ids.join(", ")}]`);
}

main().catch(console.error);
