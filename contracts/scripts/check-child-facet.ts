import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  
  console.log("=== Checking ChildCreationFacet ===\n");
  
  // Get all facets
  const facets = await loupe.facets();
  console.log(`Total facets: ${facets.length}\n`);
  
  // Check if voteCreateChild selector exists
  const voteCreateChildSelector = "0x" + ethers.keccak256(ethers.toUtf8Bytes("voteCreateChild(uint256,bool)")).slice(2, 10);
  const finalizeChildSelector = "0x" + ethers.keccak256(ethers.toUtf8Bytes("finalizeChildCreation(uint256)")).slice(2, 10);
  const getVoteStatusSelector = "0x" + ethers.keccak256(ethers.toUtf8Bytes("getChildCreationVoteStatus(uint256)")).slice(2, 10);
  
  console.log("Expected selectors:");
  console.log(`  voteCreateChild: ${voteCreateChildSelector}`);
  console.log(`  finalizeChildCreation: ${finalizeChildSelector}`);
  console.log(`  getChildCreationVoteStatus: ${getVoteStatusSelector}`);
  console.log("");
  
  // Check which facet has these selectors
  for (const facet of facets) {
    const selectors = facet.functionSelectors;
    if (selectors.includes(voteCreateChildSelector) || 
        selectors.includes(finalizeChildSelector) ||
        selectors.includes(getVoteStatusSelector)) {
      console.log(`Found ChildCreationFacet at: ${facet.facetAddress}`);
      console.log(`  Selectors: ${selectors.length}`);
      console.log(`  Has voteCreateChild: ${selectors.includes(voteCreateChildSelector)}`);
      console.log(`  Has finalizeChildCreation: ${selectors.includes(finalizeChildSelector)}`);
      console.log(`  Has getChildCreationVoteStatus: ${selectors.includes(getVoteStatusSelector)}`);
    }
  }
  
  // Also check what facet handles voteCreateChild
  try {
    const facetForVote = await loupe.facetAddress(voteCreateChildSelector);
    console.log(`\nFacet for voteCreateChild: ${facetForVote}`);
  } catch (e: any) {
    console.log(`\nError getting facet for voteCreateChild: ${e.message}`);
  }
}

main().catch(console.error);
