const { ethers } = require("hardhat");

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const POOL_MANAGER = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
const WETH = "0x4200000000000000000000000000000000000006";
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

// Known Clanker hooks on Base
const KNOWN_HOOKS = [
  { name: "ClankerHookDynamicFee", address: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC" },
  { name: "ClankerHookStaticFee", address: "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC" },
  { name: "Current in Settings", address: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC" },
];

// Test different fee/tickSpacing combinations
const FEE_COMBOS = [
  { fee: 10000, tickSpacing: 200, name: "1% / 200" },
  { fee: 3000, tickSpacing: 60, name: "0.3% / 60" },
  { fee: 500, tickSpacing: 10, name: "0.05% / 10" },
  { fee: 100, tickSpacing: 1, name: "0.01% / 1" },
];

// PoolManager interface for checking pools
const POOL_MANAGER_ABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  console.log("Debugging Pool Configuration...\n");

  // Get Diamond info
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND_ADDRESS);
  const poolKey = await swapFacet.getPoolKey(1);
  
  console.log("Cabal 1 Pool Key from Diamond:");
  console.log("  currency0:", poolKey[0]);
  console.log("  currency1:", poolKey[1]);
  console.log("  fee:", poolKey[2].toString());
  console.log("  tickSpacing:", poolKey[3].toString());
  console.log("  hooks:", poolKey[4]);

  const tokenAddress = poolKey[0] === WETH ? poolKey[1] : poolKey[0];
  console.log("\n  Token Address:", tokenAddress);

  // Check if pools exist with different hook addresses
  const poolManager = new ethers.Contract(POOL_MANAGER, POOL_MANAGER_ABI, ethers.provider);

  console.log("\n--- Testing Pool Existence ---\n");

  // Test with exact current settings
  const isWeth0 = WETH.toLowerCase() < tokenAddress.toLowerCase();
  const currency0 = isWeth0 ? WETH : tokenAddress;
  const currency1 = isWeth0 ? tokenAddress : WETH;
  const currentHook = poolKey[4];
  const currentFee = poolKey[2];
  const currentTickSpacing = poolKey[3];

  console.log("Testing exact pool key from Diamond:");
  console.log("  currency0:", currency0);
  console.log("  currency1:", currency1);
  console.log("  fee:", currentFee.toString());
  console.log("  tickSpacing:", currentTickSpacing.toString());
  console.log("  hook:", currentHook);

  // Try StateView instead
  const stateViewABI = [
    "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)",
    "function getLiquidity(bytes32 id) external view returns (uint128)"
  ];
  
  const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);

  // Compute pool ID using PoolIdLibrary method (pack the struct)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [currency0, currency1, currentFee, currentTickSpacing, currentHook]
  );
  const poolId = ethers.keccak256(encoded);
  
  console.log("\nComputed Pool ID:", poolId);

  try {
    const slot0 = await stateView.getSlot0(poolId);
    console.log("\nSlot0 result:");
    console.log("  sqrtPriceX96:", slot0[0].toString());
    console.log("  tick:", slot0[1].toString());
    console.log("  protocolFee:", slot0[2].toString());
    console.log("  lpFee:", slot0[3].toString());
    
    if (slot0[0] > 0n) {
      console.log("\n✅ Pool is initialized!");
    } else {
      console.log("\n❌ Pool is NOT initialized (sqrtPriceX96 = 0)");
    }
  } catch (e: any) {
    console.log("\nError querying StateView:", e.message);
  }

  // Also try with different hooks to see if pool exists elsewhere
  // Try with native ETH (address(0)) instead of WETH
  console.log("\n--- Testing with Native ETH (address(0)) ---\n");
  
  const NATIVE_ETH = ethers.ZeroAddress;
  const isNativeEth0 = NATIVE_ETH < tokenAddress;
  const nativeCurrency0 = isNativeEth0 ? NATIVE_ETH : tokenAddress;
  const nativeCurrency1 = isNativeEth0 ? tokenAddress : NATIVE_ETH;
  
  console.log("Testing with native ETH:");
  console.log("  currency0:", nativeCurrency0);
  console.log("  currency1:", nativeCurrency1);
  
  for (const hookInfo of KNOWN_HOOKS) {
    const encoded3 = abiCoder.encode(
      ["address", "address", "uint24", "int24", "address"],
      [nativeCurrency0, nativeCurrency1, currentFee, currentTickSpacing, hookInfo.address]
    );
    const poolId3 = ethers.keccak256(encoded3);
    
    try {
      const slot0 = await stateView.getSlot0(poolId3);
      console.log(`  Hook ${hookInfo.name}: sqrtPriceX96 = ${slot0[0]}`);
      if (slot0[0] > 0n) {
        console.log(`\n✅ POOL EXISTS with Native ETH and ${hookInfo.name}!`);
        console.log(`   Hook: ${hookInfo.address}`);
        console.log(`   sqrtPriceX96: ${slot0[0]}`);
      }
    } catch (e) {
      // ignore
    }
  }

  console.log("\nDone checking pools.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
