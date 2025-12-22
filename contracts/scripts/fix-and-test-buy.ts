const { ethers } = require("hardhat");

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const CABAL_ID = 4;
const WORKING_TOKEN = "0x70e8528640C85cD38c6B7B33f549B98348762CE3";

async function main() {
  console.log(`Fixing Cabal ${CABAL_ID} to use token ${WORKING_TOKEN}...\n`);
  
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND_ADDRESS);
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  // 1. Set Token Address
  console.log("Setting token address...");
  try {
    const tx = await swapFacet.setCabalToken(CABAL_ID, WORKING_TOKEN);
    console.log(`Transaction sent: ${tx.hash}`);
    await tx.wait();
    console.log("✅ Token address updated!");
  } catch (e: any) {
    console.log(`❌ Failed to set token: ${e.message}`);
    // If it fails, maybe I can't call it? It's public external though.
  }
  
  // 2. Verify Pool Key
  console.log("\nVerifying Pool Key...");
  const poolKey = await swapFacet.getPoolKey(CABAL_ID);
  console.log(`  Currency0: ${poolKey[0]}`);
  console.log(`  Currency1: ${poolKey[1]}`);
  console.log(`  Fee: ${poolKey[2]}`);
  console.log(`  TickSpacing: ${poolKey[3]}`);
  console.log(`  Hook: ${poolKey[4]}`);
  
  // 3. Test Buy
  console.log("\nTesting buyTokens...");
  try {
    const tx2 = await swapFacet.buyTokens(CABAL_ID, 0, {
      value: ethers.parseEther("0.0001"),
      gasLimit: 500000
    });
    console.log(`Buy Transaction: ${tx2.hash}`);
    const receipt = await tx2.wait();
    console.log("✅ BUY SUCCEEDED!");
    console.log(`Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log("❌ Buy Failed");
    if (e.data) console.log(`Error data: ${e.data}`);
    console.log(`Error: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
