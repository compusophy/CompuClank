import { ethers } from "hardhat";

async function main() {
  const FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";
  
  console.log("=== Verify Factory ===");
  console.log("Factory address:", FACTORY);
  
  // Get bytecode
  const code = await ethers.provider.getCode(FACTORY);
  console.log("Has bytecode:", code.length > 2 ? "YES" : "NO");
  console.log("Bytecode length:", code.length);
  
  // Try calling TOKEN_SUPPLY
  const factory = await ethers.getContractAt(
    "contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory",
    FACTORY
  );
  
  try {
    const supply = await factory.TOKEN_SUPPLY();
    console.log("TOKEN_SUPPLY:", ethers.formatEther(supply));
  } catch (e: any) {
    console.log("TOKEN_SUPPLY call failed:", e.message);
  }
  
  try {
    const bps = await factory.BPS();
    console.log("BPS:", bps.toString());
  } catch (e: any) {
    console.log("BPS call failed:", e.message);
  }
  
  // Check if deployToken function exists by checking its selector
  const iface = factory.interface;
  const deployTokenSelector = iface.getFunction("deployToken")?.selector;
  console.log("\ndeployToken selector:", deployTokenSelector);
  console.log("Expected selector: 0xdf40224a");
  console.log("Match:", deployTokenSelector === "0xdf40224a");
  
  // Let's also try to understand the error by looking at the function fragment
  const deployTokenFragment = iface.getFunction("deployToken");
  console.log("\ndeployToken signature:", deployTokenFragment?.format("full"));
}

main().catch(console.error);
