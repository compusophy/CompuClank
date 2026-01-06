import { ethers } from "hardhat";

const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing minimal Clanker deploy...");
  console.log("Signer:", signer.address);
  
  const factory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", CLANKER_FACTORY);
  
  // Try deployTokenZeroSupply first - simpler
  console.log("\n--- Testing deployTokenZeroSupply ---");
  const tokenConfig = {
    tokenAdmin: signer.address,
    name: "Test Zero Supply",
    symbol: "TESTZS",
    salt: ethers.ZeroHash,
    image: "",
    metadata: "",
    context: '{"interface":"TEST"}',
    originatingChainId: 8453n
  };
  
  try {
    const result = await factory.deployTokenZeroSupply.staticCall(tokenConfig);
    console.log("✅ deployTokenZeroSupply would succeed! Token:", result);
  } catch (e: any) {
    console.log("❌ deployTokenZeroSupply failed:", e.message?.slice(0, 150));
    if (e.data) console.log("   Error data:", e.data);
  }
  
  // Check if factory needs any special approval or setup
  console.log("\n--- Checking factory state ---");
  const tokenSupply = await factory.TOKEN_SUPPLY();
  console.log("TOKEN_SUPPLY:", ethers.formatEther(tokenSupply));
  
  const bps = await factory.BPS();
  console.log("BPS:", bps.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
