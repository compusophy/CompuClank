const { ethers } = require("hardhat");

const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const CABAL_ID = 4;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Checking balance for: ${signer.address}\n`);
  
  const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", TOKEN);
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND_ADDRESS);
  
  // 1. Check Balance
  const balance = await token.balanceOf(signer.address);
  console.log(`Token Balance: ${ethers.formatUnits(balance, 18)} CTT`);
  
  if (balance === 0n) {
    console.log("❌ You have 0 tokens. Cannot test sell.");
    return;
  }
  
  // 2. Approve SwapFacet
  console.log("Approving SwapFacet...");
  const approveTx = await token.approve(DIAMOND_ADDRESS, balance);
  await approveTx.wait();
  
  // 3. Sell Tokens
  console.log("\nAttempting to SELL tokens...");
  const sellAmount = balance / 2n; // Sell half
  console.log(`Selling ${ethers.formatUnits(sellAmount, 18)} CTT...`);
  
  try {
    const tx = await swapFacet.sellTokens(CABAL_ID, sellAmount, 0, {
      gasLimit: 500000
    });
    console.log(`Sell Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log("✅ SELL SUCCEEDED!");
    console.log(`Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log("❌ Sell Failed");
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
