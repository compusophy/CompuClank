import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Fixing cabal index...");
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Check current state
  const isInitialized = await viewFacet.isGenesisInitialized();
  console.log("Genesis Initialized:", isInitialized);
  
  if (!isInitialized) {
    console.log("Genesis not initialized - nothing to fix");
    return;
  }
  
  const rootCabalId = await viewFacet.getRootCabalId();
  console.log("Root Cabal ID:", rootCabalId.toString());
  
  // Check if addCabalToIndex exists on SettingsFacet
  console.log("\nAttempting to re-add CABAL0 to index...");
  
  // We need to add a function to SettingsFacet to fix this
  // For now, let's check if there's an existing function
  try {
    // Try calling a fix function if it exists
    const tx = await settingsFacet.reindexCabal(rootCabalId);
    await tx.wait();
    console.log("✅ Reindexed CABAL0");
  } catch (e: any) {
    console.log("reindexCabal function doesn't exist, need to add it");
    console.log("Error:", e.message?.slice(0, 100));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
