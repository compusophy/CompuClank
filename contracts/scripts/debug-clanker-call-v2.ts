import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  console.log("Debugging Clanker Factory call v2...");
  
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const factory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", CLANKER_FACTORY);
  
  // Get cabal data
  const cabal = await viewFacet.getCabal(0);
  console.log("TBA:", cabal.tbaAddress);
  console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
  
  // Get settings
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  const [cabalNFT, tbaImpl, registry, factoryAddr, feeLocker, weth] = await settingsFacet.getContractAddresses();
  
  // Calculate devBuy
  const totalRaised = cabal.totalRaised;
  const protocolFee = totalRaised * 100n / 10000n;
  const remaining = totalRaised - protocolFee;
  const treasuryEth = remaining * 3300n / 9900n;
  const devBuyAmount = remaining - treasuryEth;
  
  console.log("DevBuy Amount:", ethers.formatEther(devBuyAmount), "ETH");
  
  // Check if factory.deployToken has a minimum ETH requirement
  // Let's try to deploy with different ETH amounts
  console.log("\n--- Checking Factory Requirements ---");
  
  // Try to read any state from the factory that might indicate minimums
  const iface = factory.interface;
  console.log("Factory functions available:");
  for (const frag of iface.fragments) {
    if (frag.type === "function") {
      console.log(" -", frag.name);
    }
    if (frag.type === "error") {
      console.log("  [error]", frag.name, "selector:", iface.getError(frag.name)?.selector);
    }
  }
  
  // Look for the specific error
  const targetSelector = "0x23bba199";
  for (const frag of iface.fragments) {
    if (frag.type === "error") {
      const selector = iface.getError(frag.name)?.selector;
      if (selector === targetSelector) {
        console.log("\n✅ FOUND ERROR:", frag.name);
      }
    }
  }
  
  // Check deployer balance (TBA needs ETH)
  const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
  console.log("\nTBA Balance:", ethers.formatEther(tbaBalance), "ETH");
  console.log("Needs for devBuy:", ethers.formatEther(devBuyAmount), "ETH");
  console.log("Sufficient:", tbaBalance >= devBuyAmount);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
