const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const POOL_ID = "0x54194474bcc45ce1fcabcc48a25c6cb3c30d77a1ee528139f82740dc80e66b33";

const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const HOOK = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";

const FEE_OPTIONS = [10000, 3000, 500, 100, 0x800000]; 
const TICK_SPACING_OPTIONS = [200, 60, 10, 1];

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log(`Checking Pool ID: ${POOL_ID}\n`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  // 1. Check if pool is initialized
  try {
    const slot0 = await stateView.getSlot0(POOL_ID);
    console.log(`✅ POOL IS INITIALIZED!`);
    console.log(`   sqrtPriceX96: ${slot0.sqrtPriceX96}`);
    console.log(`   tick: ${slot0.tick}`);
  } catch (e) {
    console.log(`❌ Pool read failed: ${e.message}`);
  }
  
  // 2. Brute force parameters
  console.log("\nReverse engineering parameters...");
  
  const isWeth0 = WETH.toLowerCase() < TOKEN.toLowerCase();
  const currency0 = isWeth0 ? WETH : TOKEN;
  const currency1 = isWeth0 ? TOKEN : WETH;
  
  for (const fee of FEE_OPTIONS) {
    for (const tickSpacing of TICK_SPACING_OPTIONS) {
      const encoded = abiCoder.encode(
        ["address", "address", "uint24", "int24", "address"],
        [currency0, currency1, fee, tickSpacing, HOOK]
      );
      const computedId = ethers.keccak256(encoded);
      
      if (computedId.toLowerCase() === POOL_ID.toLowerCase()) {
        console.log("\n🎉 MATCH FOUND!");
        console.log(`   Fee: ${fee}`);
        console.log(`   TickSpacing: ${tickSpacing}`);
        console.log(`   Hook: ${HOOK}`);
        return;
      }
    }
  }
  
  console.log("\n❌ No parameter match found.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
