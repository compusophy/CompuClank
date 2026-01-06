import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  // Get all facet ABIs combined
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  console.log("=== Checking All Cabals ===\n");
  
  // Get hierarchical IDs first
  console.log("Fetching hierarchical cabal IDs...");
  const ids = await viewFacet.getHierarchicalCabalIds();
  console.log(`Found ${ids.length} cabals: [${ids.join(", ")}]\n`);
  
  // Check each cabal
  for (const id of ids) {
    try {
      const cabal = await viewFacet.getCabal(id);
      console.log(`--- CABAL ${id} ---`);
      console.log(`  Phase: ${cabal.phase} (0=Presale, 1=Active, 2=Failed)`);
      console.log(`  TBA: ${cabal.tbaAddress}`);
      console.log(`  Token: ${cabal.tokenAddress}`);
      console.log(`  Total Staked: ${ethers.formatEther(cabal.totalStaked)} tokens`);
      console.log(`  Parent ID: ${cabal.parentCabalId}`);
      console.log(`  Presale Total Raised: ${ethers.formatEther(cabal.presaleTotalRaised)} ETH`);
      
      // Check child cabals
      const children = await viewFacet.getChildCabals(id);
      if (children.length > 0) {
        console.log(`  Children: [${children.join(", ")}]`);
      }
      console.log("");
    } catch (e: any) {
      console.log(`CABAL ${id}: Error - ${e.message}\n`);
    }
  }
}

main().catch(console.error);
