import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

/**
 * Hotfix script to update cabal metadata (name/symbol) for deployed cabals.
 * 
 * NOTE: This updates our CabalData storage in the diamond contract.
 * The actual on-chain ERC-20 token name() and symbol() CANNOT be changed.
 * 
 * Current issues:
 * - CABAL0 has name "Cabal Genesis" -> should be "CABAL0"
 * - CABAL1 has name "Cabal 1" -> should be "CABAL1"
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Fixing cabal names with account:", deployer.address);

  const SettingsFacet = await ethers.getContractFactory("SettingsFacet");
  const ViewFacet = await ethers.getContractFactory("ViewFacet");
  
  const settingsFacet = SettingsFacet.attach(DIAMOND_ADDRESS);
  const viewFacet = ViewFacet.attach(DIAMOND_ADDRESS);

  // Check current state
  console.log("\n=== Current State ===");
  const cabal0 = await viewFacet.getCabal(0);
  const cabal1 = await viewFacet.getCabal(1);
  
  console.log("CABAL0 name:", cabal0.name, "| symbol:", cabal0.symbol);
  console.log("CABAL1 name:", cabal1.name, "| symbol:", cabal1.symbol);

  // Fix CABAL0: "Cabal Genesis" -> "CABAL0"
  if (cabal0.name !== "CABAL0" || cabal0.symbol !== "CABAL0") {
    console.log("\n=== Fixing CABAL0 ===");
    console.log(`Updating name: "${cabal0.name}" -> "CABAL0"`);
    console.log(`Updating symbol: "${cabal0.symbol}" -> "CABAL0"`);
    
    const tx0 = await settingsFacet.updateCabalMetadata(0, "CABAL0", "CABAL0", cabal0.image);
    await tx0.wait();
    console.log("✅ CABAL0 updated! tx:", tx0.hash);
  } else {
    console.log("\n✅ CABAL0 already has correct name/symbol");
  }

  // Fix CABAL1: "Cabal 1" -> "CABAL1"
  if (cabal1.tbaAddress !== ethers.ZeroAddress) {
    if (cabal1.name !== "CABAL1" || cabal1.symbol !== "CABAL1") {
      console.log("\n=== Fixing CABAL1 ===");
      console.log(`Updating name: "${cabal1.name}" -> "CABAL1"`);
      console.log(`Updating symbol: "${cabal1.symbol}" -> "CABAL1"`);
      
      const tx1 = await settingsFacet.updateCabalMetadata(1, "CABAL1", "CABAL1", cabal1.image);
      await tx1.wait();
      console.log("✅ CABAL1 updated! tx:", tx1.hash);
    } else {
      console.log("\n✅ CABAL1 already has correct name/symbol");
    }
  } else {
    console.log("\n⚠️ CABAL1 does not exist yet");
  }

  // Verify changes
  console.log("\n=== Final State ===");
  const updatedCabal0 = await viewFacet.getCabal(0);
  const updatedCabal1 = await viewFacet.getCabal(1);
  
  console.log("CABAL0 name:", updatedCabal0.name, "| symbol:", updatedCabal0.symbol);
  if (updatedCabal1.tbaAddress !== ethers.ZeroAddress) {
    console.log("CABAL1 name:", updatedCabal1.name, "| symbol:", updatedCabal1.symbol);
  }
  
  console.log("\n🎉 Done! Note: The on-chain ERC-20 token name()/symbol() are immutable.");
  console.log("   This only updates the CabalData in our diamond contract.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
