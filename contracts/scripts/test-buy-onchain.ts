import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const CABAL_ID = 4;
const TOKEN_ADDRESS = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a"; // Cabal 4's token (from pool key)
const BUY_AMOUNT = ethers.parseEther("0.0001"); // Small test amount

// SwapFacet ABI (just what we need)
const SWAP_FACET_ABI = [
  "function buyTokens(uint256 cabalId, uint256 minAmountOut) external payable returns (uint256)",
  "function getPoolKey(uint256 cabalId) external view returns (address, address, uint24, int24, address)",
  "function hasActivePool(uint256 cabalId) external view returns (bool)",
  "event TokensBought(uint256 indexed cabalId, address indexed buyer, uint256 ethAmount, uint256 tokensReceived)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing buyTokens with signer:", signer.address);
  console.log("ETH Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)));

  // Get contracts
  const swapFacet = new ethers.Contract(DIAMOND_ADDRESS, SWAP_FACET_ABI, signer);

  // Check Cabal info
  console.log("\n--- Cabal Info ---");
  console.log("Cabal ID:", CABAL_ID);
  console.log("Token:", TOKEN_ADDRESS);

  // Check pool key
  console.log("\n--- Pool Key ---");
  const poolKey = await swapFacet.getPoolKey(CABAL_ID);
  console.log("Currency0:", poolKey[0]);
  console.log("Currency1:", poolKey[1]);
  console.log("Fee:", poolKey[2]);
  console.log("Tick Spacing:", poolKey[3]);
  console.log("Hooks:", poolKey[4]);

  // Check if pool is active
  const hasPool = await swapFacet.hasActivePool(CABAL_ID);
  console.log("\nPool active:", hasPool);

  if (!hasPool) {
    console.log("Pool not active, aborting test");
    return;
  }

  // Get token balance before
  const token = new ethers.Contract(TOKEN_ADDRESS, [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
  ], signer);
  
  const tokenBalanceBefore = await token.balanceOf(signer.address);
  console.log("\nToken balance before:", ethers.formatEther(tokenBalanceBefore), await token.symbol());

  // Try to estimate gas first
  console.log("\n--- Attempting Gas Estimation ---");
  try {
    const gasEstimate = await swapFacet.buyTokens.estimateGas(CABAL_ID, 0n, { value: BUY_AMOUNT });
    console.log("Gas estimate:", gasEstimate.toString());
  } catch (e: any) {
    console.log("Gas estimation failed:", e.message);
    
    // Try to decode error
    if (e.data) {
      console.log("Error data:", e.data);
    }
    
    // Still try to execute with high gas limit
    console.log("\nWill attempt execution with manual gas limit...");
  }

  // Execute buyTokens
  console.log("\n--- Executing buyTokens ---");
  console.log("Buying with:", ethers.formatEther(BUY_AMOUNT), "ETH");
  
  try {
    const tx = await swapFacet.buyTokens(CABAL_ID, 0n, { 
      value: BUY_AMOUNT,
      gasLimit: 500000n, // Manual gas limit
    });
    console.log("TX Hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("TX confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check for events
    if (receipt.logs.length > 0) {
      console.log("\nEvents:");
      for (const log of receipt.logs) {
        console.log("  Log:", log);
      }
    }

    // Get token balance after
    const tokenBalanceAfter = await token.balanceOf(signer.address);
    console.log("\nToken balance after:", ethers.formatEther(tokenBalanceAfter));
    console.log("Tokens received:", ethers.formatEther(tokenBalanceAfter - tokenBalanceBefore));
    
    console.log("\n✅ SUCCESS!");
  } catch (e: any) {
    console.error("\n❌ Transaction failed:");
    console.error(e.message);
    
    if (e.data) {
      console.log("\nError data:", e.data);
    }
    
    if (e.transaction) {
      console.log("\nTransaction:", e.transaction);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
