const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const WETH = "0x4200000000000000000000000000000000000006";
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// Token from cabal 4
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";

const KNOWN_HOOKS = [
  { name: "ClankerHookDynamicFee", address: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC" },
  { name: "ClankerHookStaticFee", address: "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC" },
  { name: "Current stored hook", address: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC" },
];

const FEES = [
  { name: "Dynamic Fee Flag (0x800000)", value: 8388608 },
  { name: "1% (10000)", value: 10000 },
  { name: "0.3% (3000)", value: 3000 },
];

const TICK_SPACINGS = [200, 100, 60, 10];

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log(`Looking for pools with token: ${TOKEN}\n`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  let found = false;

  for (const base of [{ name: "Native ETH", addr: NATIVE_ETH }, { name: "WETH", addr: WETH }]) {
    // Determine currency ordering
    const currency0 = base.addr.toLowerCase() < TOKEN.toLowerCase() ? base.addr : TOKEN;
    const currency1 = base.addr.toLowerCase() < TOKEN.toLowerCase() ? TOKEN : base.addr;
    
    console.log(`\n=== Testing with ${base.name} ===`);
    console.log(`currency0: ${currency0}`);
    console.log(`currency1: ${currency1}`);
    
    for (const hook of KNOWN_HOOKS) {
      for (const fee of FEES) {
        for (const tickSpacing of TICK_SPACINGS) {
          const encoded = abiCoder.encode(
            ["address", "address", "uint24", "int24", "address"],
            [currency0, currency1, fee.value, tickSpacing, hook.address]
          );
          const poolId = ethers.keccak256(encoded);
          
          try {
            const slot0 = await stateView.getSlot0(poolId);
            if (slot0[0] > 0n) {
              console.log(`\n✅ POOL FOUND!`);
              console.log(`   Base: ${base.name}`);
              console.log(`   Hook: ${hook.name} (${hook.address})`);
              console.log(`   Fee: ${fee.name}`);
              console.log(`   Tick Spacing: ${tickSpacing}`);
              console.log(`   Pool ID: ${poolId}`);
              console.log(`   sqrtPriceX96: ${slot0[0]}`);
              found = true;
            }
          } catch (e) {
            // Pool doesn't exist
          }
        }
      }
    }
  }
  
  if (!found) {
    console.log(`\n❌ No pool found with any combination!`);
    console.log(`\nThe token might not have a pool yet, or uses a different hook/parameters.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
