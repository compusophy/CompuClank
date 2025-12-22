const { ethers } = require("hardhat");

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const STATE_VIEW = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71";
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

const KNOWN_HOOKS = [
  { name: "ClankerHookDynamicFee", address: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC" },
  { name: "ClankerHookStaticFee", address: "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC" },
];

const stateViewABI = [
  "function getSlot0(bytes32 id) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)"
];

async function main() {
  const CABAL_ID = 4; // New token
  
  console.log(`Debugging Cabal ${CABAL_ID}...\n`);
  
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND_ADDRESS);
  const poolKey = await swapFacet.getPoolKey(CABAL_ID);
  
  console.log(`Pool Key from Diamond:`);
  console.log(`  currency0: ${poolKey[0]}`);
  console.log(`  currency1: ${poolKey[1]}`);
  console.log(`  fee: ${poolKey[2]}`);
  console.log(`  tickSpacing: ${poolKey[3]}`);
  console.log(`  hooks: ${poolKey[4]}`);

  const tokenAddress = poolKey[1]; // currency1 is the token (currency0 is native ETH)
  console.log(`\n  Token Address: ${tokenAddress}`);

  const stateView = new ethers.Contract(STATE_VIEW, stateViewABI, ethers.provider);
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Test with native ETH + current hook from settings
  console.log("\n--- Testing Pool with Native ETH ---\n");
  
  const currentHook = poolKey[4];
  const fee = poolKey[2];
  const tickSpacing = poolKey[3];
  
  const encoded = abiCoder.encode(
    ["address", "address", "uint24", "int24", "address"],
    [NATIVE_ETH, tokenAddress, fee, tickSpacing, currentHook]
  );
  const poolId = ethers.keccak256(encoded);
  
  console.log(`Pool ID: ${poolId}`);
  
  try {
    const slot0 = await stateView.getSlot0(poolId);
    console.log(`sqrtPriceX96: ${slot0[0]}`);
    if (slot0[0] > 0n) {
      console.log(`\n✅ POOL EXISTS with current hook!`);
    } else {
      console.log(`\n❌ Pool NOT initialized with current hook`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }

  // Test with known Clanker hooks
  console.log("\n--- Testing with Known Clanker Hooks ---\n");
  
  for (const hookInfo of KNOWN_HOOKS) {
    const encoded2 = abiCoder.encode(
      ["address", "address", "uint24", "int24", "address"],
      [NATIVE_ETH, tokenAddress, fee, tickSpacing, hookInfo.address]
    );
    const poolId2 = ethers.keccak256(encoded2);
    
    try {
      const slot0 = await stateView.getSlot0(poolId2);
      if (slot0[0] > 0n) {
        console.log(`✅ POOL EXISTS with ${hookInfo.name}!`);
        console.log(`   Hook: ${hookInfo.address}`);
        console.log(`   sqrtPriceX96: ${slot0[0]}`);
      } else {
        console.log(`❌ No pool with ${hookInfo.name}`);
      }
    } catch (e) {
      console.log(`❌ Error with ${hookInfo.name}`);
    }
  }

  // Now try the buyTokens call
  console.log("\n--- Testing buyTokens ---\n");
  
  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  
  try {
    const tx = await swapFacet.buyTokens(CABAL_ID, 0, {
      value: ethers.parseEther("0.0001"),
      gasLimit: 500000
    });
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Transaction succeeded!`);
    console.log(`Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log(`❌ Transaction failed`);
    if (e.data) {
      console.log(`Error data: ${e.data}`);
    }
    console.log(`Error: ${e.message?.slice(0, 500)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
