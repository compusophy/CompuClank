import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  const CABAL_ID = 23;
  const FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

  console.log("=== Debug TBA -> Factory ===");

  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND);
  const cabal = await viewFacet.getCabal(CABAL_ID);
  
  console.log("\nCabal TBA:", cabal.tbaAddress);
  
  // Check factory interface
  const factory = await ethers.getContractAt(
    "contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory",
    FACTORY
  );
  
  // Get TOKEN_SUPPLY and BPS from factory
  const tokenSupply = await factory.TOKEN_SUPPLY();
  const bps = await factory.BPS();
  console.log("Factory TOKEN_SUPPLY:", ethers.formatEther(tokenSupply));
  console.log("Factory BPS:", bps.toString());
  
  // Check if there's any existing deployment for this TBA
  console.log("\nChecking if TBA already has a deployment...");
  try {
    const info = await factory.tokenDeploymentInfo(cabal.tbaAddress);
    console.log("Existing deployment:", info);
  } catch (e: any) {
    console.log("No existing deployment (or error):", e.message);
  }
  
  // Try to see if the token already exists with our salt
  console.log("\nThe error might be due to salt collision or existing deployment");
  console.log("Try resetting cabals and starting fresh?");
}

main().catch(console.error);
