const { ethers } = require("hardhat");

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const WETH = "0x4200000000000000000000000000000000000006";

const KNOWN_HOOKS = [
  { name: "ClankerHookDynamicFee", address: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC" },
  { name: "ClankerHookStaticFee", address: "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC" },
  { name: "Old Hook", address: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC" },
];

const FEE_OPTIONS = [10000, 3000, 500, 100];
const TICK_SPACING_OPTIONS = [200, 60, 10, 1];

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  const CABAL_ID = 4;
  
  console.log(`Searching for pools for Cabal ${CABAL_ID}...\n`);
  
  // Use the SDK-deployed token
  const tokenAddress = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
  console.log(`Token Address: ${tokenAddress}`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Check for WETH pools (currency0 is the lower address)
  const isWeth0 = WETH.toLowerCase() < tokenAddress.toLowerCase();
  const currency0 = isWeth0 ? WETH : tokenAddress;
  const currency1 = isWeth0 ? tokenAddress : WETH;
  
  console.log(`\nSearching for WETH/${isWeth0 ? "Token" : "WETH"} pool...`);
  console.log(`  currency0: ${currency0}`);
  console.log(`  currency1: ${currency1}`);
  
  let found = false;
  
  for (const hookInfo of KNOWN_HOOKS) {
    for (const fee of FEE_OPTIONS) {
      for (const tickSpacing of TICK_SPACING_OPTIONS) {
        const encoded = abiCoder.encode(
          ["address", "address", "uint24", "int24", "address"],
          [currency0, currency1, fee, tickSpacing, hookInfo.address]
        );
        const poolId = ethers.keccak256(encoded);
        
        try {
          const slot0 = await stateView.getSlot0(poolId);
          if (slot0[0] > 0n) {
            console.log(`\n✅ POOL FOUND!`);
            console.log(`   Hook: ${hookInfo.name} (${hookInfo.address})`);
            console.log(`   Fee: ${fee} (${fee/100}%)`);
            console.log(`   TickSpacing: ${tickSpacing}`);
            console.log(`   sqrtPriceX96: ${slot0[0]}`);
            console.log(`   tick: ${slot0[1]}`);
            found = true;
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }
  
  if (!found) {
    console.log("\n❌ No pools found with any hook/fee/tickSpacing combination");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
