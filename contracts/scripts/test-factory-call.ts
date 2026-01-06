import { ethers } from "hardhat";

const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  console.log("Testing Clanker Factory at:", CLANKER_FACTORY);
  
  // Check if factory has code
  const code = await ethers.provider.getCode(CLANKER_FACTORY);
  console.log("Factory bytecode length:", code.length);
  
  if (code === "0x") {
    console.log("ERROR: No code at factory address!");
    return;
  }
  
  // Try to call a view function on the factory
  const factory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", CLANKER_FACTORY);
  
  try {
    const tokenSupply = await factory.TOKEN_SUPPLY();
    console.log("TOKEN_SUPPLY:", tokenSupply.toString());
  } catch (e: any) {
    console.log("Error calling TOKEN_SUPPLY:", e.message?.slice(0, 100));
  }
  
  try {
    const bps = await factory.BPS();
    console.log("BPS:", bps.toString());
  } catch (e: any) {
    console.log("Error calling BPS:", e.message?.slice(0, 100));
  }
  
  // Check if this error is from the factory
  // 0x23bba199 might be a custom error
  console.log("\nLooking up error 0x23bba199 on the factory...");
  
  // Try to get factory ABI from etherscan or similar
  // For now, let's just see if the factory is a proxy
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implValue = await ethers.provider.getStorage(CLANKER_FACTORY, implSlot);
  console.log("EIP-1967 implementation slot:", implValue);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
