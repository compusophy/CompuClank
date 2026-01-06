import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Inspecting Diamond:", DIAMOND_ADDRESS);
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  
  try {
    const facets = await loupe.facets();
    console.log(`\nFound ${facets.length} facets:`);
    
    for (const facet of facets) {
      console.log(`\nFacet: ${facet.facetAddress}`);
      console.log(`Selectors: ${facet.functionSelectors.length}`);
      
      // Try to identify the facet
      // We can't easily know the name, but we can check if it matches known addresses
      if (facet.facetAddress.toLowerCase() === "0x281c0cf3bbf3f14e66b1010db00c70381062fd0d") {
          console.log("  -> THIS IS THE NEW GENESIS FACET");
      }
      
      console.log("  " + facet.functionSelectors.join(", "));
    }
    
    // Check specifically for initializeGenesis selector
    const genesisFacet = await ethers.getContractFactory("GenesisFacet");
    const initSelector = genesisFacet.interface.getFunction("initializeGenesis").selector;
    console.log("\nLooking for initializeGenesis selector:", initSelector);
    
    const facetAddress = await loupe.facetAddress(initSelector);
    console.log("Facet for initializeGenesis:", facetAddress);
    
  } catch (e) {
    console.log("Error inspecting diamond:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
