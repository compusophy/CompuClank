const { ethers } = require("hardhat");

const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

async function main() {
  console.log("Checking Diamond state for cabal 4...\n");
  
  // Get SwapFacet
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND);
  
  // Check pool key
  const poolKey = await swapFacet.getPoolKey(4);
  console.log("Pool Key:");
  console.log(`  currency0: ${poolKey[0]}`);
  console.log(`  currency1: ${poolKey[1]}`);
  console.log(`  fee: ${poolKey[2]}`);
  console.log(`  tickSpacing: ${poolKey[3]}`);
  console.log(`  hooks: ${poolKey[4]}`);
  
  // Check has active pool
  const hasPool = await swapFacet.hasActivePool(4);
  console.log(`\nhasActivePool: ${hasPool}`);
  
  // Try static call to buyTokens
  console.log("\nTrying static call to buyTokens...");
  try {
    const result = await swapFacet.buyTokens.staticCall(4, 0, {
      value: ethers.parseEther("0.0001")
    });
    console.log(`Static call succeeded! Would return: ${result}`);
  } catch (e: any) {
    console.log(`Static call failed: ${e.message}`);
    
    // Try to get more error details
    if (e.data) {
      console.log(`Error data: ${e.data}`);
    }
    if (e.reason) {
      console.log(`Error reason: ${e.reason}`);
    }
    
    // Check specific error selectors
    const errorSelectors: Record<string, string> = {
      "0x00000000": "Unknown",
      "0xc17b5e0f": "CabalNotActive()",
      "0x6a5d4d9b": "ZeroAmount()",
      "0xf4d678b8": "InsufficientBalance()",
      "0x8d4e1e75": "SlippageExceeded()",
      "0x57a8fc7f": "InvalidToken()",
    };
    
    if (e.data && errorSelectors[e.data.slice(0, 10)]) {
      console.log(`Decoded error: ${errorSelectors[e.data.slice(0, 10)]}`);
    }
  }
  
  // Check ClankerV4Settings
  console.log("\nChecking SettingsFacet for ClankerV4Settings...");
  const settingsABI = [
    "function getClankerAddresses() view returns (address hook, address locker, address mevModule, address devBuyExtension)"
  ];
  const settings = new ethers.Contract(DIAMOND, settingsABI, ethers.provider);
  
  try {
    const addrs = await settings.getClankerAddresses();
    console.log(`  hook: ${addrs[0]}`);
    console.log(`  locker: ${addrs[1]}`);
    console.log(`  mevModule: ${addrs[2]}`);
    console.log(`  devBuyExtension: ${addrs[3]}`);
  } catch (e: any) {
    console.log(`Failed to get Clanker addresses: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
