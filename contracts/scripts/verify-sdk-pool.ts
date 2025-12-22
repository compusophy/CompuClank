const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const STATIC_HOOK = "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC";

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log(`Checking SPECIFIC pool for SDK token: ${TOKEN}\n`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  const isWeth0 = WETH.toLowerCase() < TOKEN.toLowerCase();
  const currency0 = isWeth0 ? WETH : TOKEN;
  const currency1 = isWeth0 ? TOKEN : WETH;
  
  console.log(`Config:`);
  console.log(`  Currency0: ${currency0}`);
  console.log(`  Currency1: ${currency1}`);
  console.log(`  Fee: 10000`);
  console.log(`  TickSpacing: 200`);
  console.log(`  Hook: ${STATIC_HOOK}`);
  
  const encoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [currency0, currency1, 10000, 200, STATIC_HOOK]
  );
  const poolId = ethers.keccak256(encoded);
  
  console.log(`\nPool ID: ${poolId}`);
  
  try {
    const slot0 = await stateView.getSlot0(poolId);
    console.log(`\n✅ POOL FOUND!`);
    console.log(`   sqrtPriceX96: ${slot0.sqrtPriceX96}`);
    console.log(`   tick: ${slot0.tick}`);
  } catch (e) {
    console.log(`\n❌ Pool NOT found: ${e.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
