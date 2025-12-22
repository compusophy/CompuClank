const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";

// Only test Static Hook with WETH
const ALL_HOOKS = [
  { name: "StaticFee", addr: "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC" }
];

// Possible fee/tick combos
const FEE_TICK = [
  { fee: 10000, tick: 200 },  // 1% standard
  { fee: 3000, tick: 60 },    // 0.3%
  { fee: 500, tick: 10 },     // 0.05%
  { fee: 100, tick: 1 },      // 0.01%
  { fee: 0x800000, tick: 200 }, // Dynamic fee flag
];

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log(`Searching for pools for token: ${TOKEN}\n`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  let found = false;

  // Try only WETH
  const pairs = [
    { name: "WETH", addr: WETH }
  ];

  for (const pair of pairs) {
    // Currency0 must be the lower address
    const isToken0 = TOKEN.toLowerCase() < pair.addr.toLowerCase();
    const currency0 = isToken0 ? TOKEN : pair.addr;
    const currency1 = isToken0 ? pair.addr : TOKEN;
    
    console.log(`\n=== Testing ${pair.name} pair ===`);
    console.log(`currency0: ${currency0}`);
    console.log(`currency1: ${currency1}`);
    
    for (const hook of ALL_HOOKS) {
      for (const ft of FEE_TICK) {
        const encoded = abiCoder.encode(
          ["address", "address", "uint24", "int24", "address"],
          [currency0, currency1, ft.fee, ft.tick, hook.addr]
        );
        const poolId = ethers.keccak256(encoded);
        
        try {
          const slot0 = await stateView.getSlot0(poolId);
          console.log(`Checking Fee: ${ft.fee}, Tick: ${ft.tick} -> sqrtPrice: ${slot0[0]}`);
          if (slot0[0] > 0n) {
            console.log(`\n✅ POOL FOUND!`);
            console.log(`   Hook: ${hook.name} (${hook.addr})`);
            console.log(`   Fee: ${ft.fee}`);
            console.log(`   TickSpacing: ${ft.tick}`);
            console.log(`   sqrtPriceX96: ${slot0[0]}`);
            console.log(`   tick: ${slot0[1]}`);
            console.log(`   Pool ID: ${poolId}`);
            found = true;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  if (!found) {
    console.log("\n❌ No pools found.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
