const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const WETH = "0x4200000000000000000000000000000000000006";
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const HOOK = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log("Checking pool configurations...\n");
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  const fee = 8388608; // Dynamic fee flag
  const tickSpacing = 200;
  
  // Test 1: WETH pool
  console.log("=== WETH Pool ===");
  const wethCurrency0 = WETH.toLowerCase() < TOKEN.toLowerCase() ? WETH : TOKEN;
  const wethCurrency1 = WETH.toLowerCase() < TOKEN.toLowerCase() ? TOKEN : WETH;
  
  const wethEncoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [wethCurrency0, wethCurrency1, fee, tickSpacing, HOOK]
  );
  const wethPoolId = ethers.keccak256(wethEncoded);
  
  console.log(`currency0: ${wethCurrency0}`);
  console.log(`currency1: ${wethCurrency1}`);
  console.log(`poolId: ${wethPoolId}`);
  
  try {
    const slot0 = await stateView.getSlot0(wethPoolId);
    console.log(`sqrtPriceX96: ${slot0[0]}`);
    if (slot0[0] > 0n) {
      console.log(`✅ WETH POOL EXISTS!`);
    } else {
      console.log(`❌ WETH pool not initialized`);
    }
  } catch (e) {
    console.log(`❌ Error checking WETH pool`);
  }
  
  // Test 2: Native ETH pool
  console.log("\n=== Native ETH Pool ===");
  const nativeCurrency0 = NATIVE_ETH.toLowerCase() < TOKEN.toLowerCase() ? NATIVE_ETH : TOKEN;
  const nativeCurrency1 = NATIVE_ETH.toLowerCase() < TOKEN.toLowerCase() ? TOKEN : NATIVE_ETH;
  
  const nativeEncoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [nativeCurrency0, nativeCurrency1, fee, tickSpacing, HOOK]
  );
  const nativePoolId = ethers.keccak256(nativeEncoded);
  
  console.log(`currency0: ${nativeCurrency0}`);
  console.log(`currency1: ${nativeCurrency1}`);
  console.log(`poolId: ${nativePoolId}`);
  
  try {
    const slot0 = await stateView.getSlot0(nativePoolId);
    console.log(`sqrtPriceX96: ${slot0[0]}`);
    if (slot0[0] > 0n) {
      console.log(`✅ NATIVE ETH POOL EXISTS!`);
    } else {
      console.log(`❌ Native ETH pool not initialized`);
    }
  } catch (e) {
    console.log(`❌ Error checking Native ETH pool`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
