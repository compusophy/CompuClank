import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9"; // The address user is interacting with

async function main() {
  console.log("Checking Genesis State for Diamond:", DIAMOND_ADDRESS);
  const genesisFacet = await ethers.getContractAt("GenesisFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);

  // 1. Check if initialized
  try {
    const isInitialized = await genesisFacet.isGenesisInitialized();
    console.log("\nIs Genesis Initialized?", isInitialized);
    
    if (isInitialized) {
        console.log("Root Cabal ID:", await genesisFacet.getRootCabalId());
    }
  } catch (e) {
    console.log("Error checking initialized:", e.message);
  }

  // 2. Check total cabals
  try {
    const total = await viewFacet.getTotalCabals();
    console.log("Total Cabals:", total.toString());
  } catch (e) {
    console.log("Error checking total cabals:", e.message);
  }

  // 3. Simulate initializeGenesis
  if (true) {
      console.log("\nSimulating initializeGenesis with 0.00001 ETH...");
      try {
          const [deployer] = await ethers.getSigners();
          
          // Impersonate a random account for simulation if needed, but deployer is fine
          // We need to use callStatic to see if it reverts
          await genesisFacet.initializeGenesis.staticCall({
              value: ethers.parseEther("0.00001")
          });
          console.log("✅ Simulation SUCCESS: initializeGenesis would succeed");
      } catch (e: any) {
          console.log("❌ Simulation FAILED:");
          if (e.data) {
              // Try to decode error
              try {
                  const decoded = genesisFacet.interface.parseError(e.data);
                  console.log("   Revert Reason:", decoded?.name, decoded?.args);
              } catch {
                  console.log("   Could not decode error data:", e.data);
              }
          } else {
              console.log("   Error:", e.message);
          }
      }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
