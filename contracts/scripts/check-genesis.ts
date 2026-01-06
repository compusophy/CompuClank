import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Check genesis state
  const isInitialized = await viewFacet.isGenesisInitialized();
  console.log("Genesis Initialized:", isInitialized);
  
  if (isInitialized) {
    const rootCabalId = await viewFacet.getRootCabalId();
    console.log("Root Cabal ID:", rootCabalId.toString());
    
    const cabal = await viewFacet.getCabal(rootCabalId);
    console.log("CABAL0 Phase:", cabal.phase.toString(), "(0=Presale, 1=Active)");
    console.log("CABAL0 Token:", cabal.tokenAddress);
  }
  
  // Check allCabalIds
  const allCabals = await viewFacet.getAllCabalIds();
  console.log("\nAll Cabal IDs in index:", allCabals.length);
  console.log("IDs:", allCabals.map(id => id.toString()).join(", ") || "(empty)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
