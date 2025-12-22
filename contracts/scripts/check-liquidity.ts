const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const POOL_ID = "0x54194474bcc45ce1fcabcc48a25c6cb3c30d77a1ee528139f82740dc80e66b33";

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
  "function getLiquidity(bytes32 id) external view returns (uint128)"
];

async function main() {
  console.log(`Checking Liquidity for Pool: ${POOL_ID}\n`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  
  try {
    const liquidity = await stateView.getLiquidity(POOL_ID);
    console.log(`Liquidity: ${liquidity}`);
    
    if (liquidity === 0n) {
      console.log("\n❌ POOL HAS ZERO LIQUIDITY! Swaps will fail.");
    } else {
      console.log("\n✅ Pool has liquidity.");
    }
  } catch (e) {
    console.log(`❌ Failed to read liquidity: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
