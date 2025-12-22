const { ethers } = require("hardhat");

const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const WETH = "0x4200000000000000000000000000000000000006";
const NATIVE_ETH = ethers.ZeroAddress;
const TOKEN = "0xd2c0871Eb9D5FD851724a208332Fbec440A18bdf";

// All known hooks on Base (from Clanker docs)
const ALL_HOOKS = [
  "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC", // ClankerHookDynamicFee
  "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC", // ClankerHookStaticFee
  "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC", // Old hook
  "0x0000000000000000000000000000000000000000", // No hook
  // V2 hooks (from docs)
  "0x5cdfbd1c70D10C1C0A2EA0d11F3Af3E6e3E7c5CC", // Possible V2
];

const FEE_OPTIONS = [10000, 3000, 500, 100, 8388608]; // Include dynamic fee flag
const TICK_SPACING_OPTIONS = [200, 60, 10, 1];

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log(`Exhaustive pool search for token: ${TOKEN}\n`);
  
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  let found = false;
  let checked = 0;

  // Test with WETH
  for (const pairedToken of [WETH, NATIVE_ETH]) {
    const pairName = pairedToken === WETH ? "WETH" : "Native ETH";
    const isToken0 = TOKEN.toLowerCase() < pairedToken.toLowerCase();
    const currency0 = isToken0 ? TOKEN : pairedToken;
    const currency1 = isToken0 ? pairedToken : TOKEN;
    
    console.log(`Checking ${pairName} pairs (token is currency${isToken0 ? 0 : 1})...`);
    
    for (const hook of ALL_HOOKS) {
      for (const fee of FEE_OPTIONS) {
        for (const tickSpacing of TICK_SPACING_OPTIONS) {
          checked++;
          
          const encoded = abiCoder.encode(
            ["address", "address", "uint24", "int24", "address"],
            [currency0, currency1, fee, tickSpacing, hook]
          );
          const poolId = ethers.keccak256(encoded);
          
          try {
            const slot0 = await stateView.getSlot0(poolId);
            if (slot0[0] > 0n) {
              console.log(`\n✅ POOL FOUND!`);
              console.log(`   Pair: ${pairName}`);
              console.log(`   Hook: ${hook}`);
              console.log(`   Fee: ${fee}`);
              console.log(`   TickSpacing: ${tickSpacing}`);
              console.log(`   sqrtPriceX96: ${slot0[0]}`);
              found = true;
            }
          } catch (e) {
            // ignore
          }
        }
      }
    }
  }
  
  console.log(`\nChecked ${checked} pool combinations.`);
  
  if (!found) {
    console.log("\n❌ No pools found. The token's liquidity pool was never created.");
    console.log("\nThis means the finalizeCabal() call succeeded in deploying the token,");
    console.log("but the Clanker factory did not create the Uniswap V4 pool.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
