const { ethers } = require("hardhat");

const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const UNIVERSAL_ROUTER = "0x4F63E5e685126e7f307f0Ae108F6Bd374f061219";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Simulating buyTokens step by step...\n");
  
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND);
  const amountIn = ethers.parseEther("0.0001");
  
  // Step 1: Check if the cabal passes validation
  console.log("Step 1: Checking cabal validation...");
  const hasPool = await swapFacet.hasActivePool(4);
  console.log(`  hasActivePool(4): ${hasPool}`);
  
  // Step 2: Get the pool key the SwapFacet would construct
  console.log("\nStep 2: Pool Key from SwapFacet...");
  const poolKey = await swapFacet.getPoolKey(4);
  console.log(`  currency0: ${poolKey[0]}`);
  console.log(`  currency1: ${poolKey[1]}`);
  console.log(`  fee: ${poolKey[2]}`);
  console.log(`  tickSpacing: ${poolKey[3]}`);
  console.log(`  hooks: ${poolKey[4]}`);
  
  // Step 3: Check if Universal Router is accessible
  console.log("\nStep 3: Checking Universal Router...");
  const routerCode = await ethers.provider.getCode(UNIVERSAL_ROUTER);
  console.log(`  Router code length: ${routerCode.length} bytes`);
  
  // Step 4: Try to call the router directly with the same encoding SwapFacet uses
  console.log("\nStep 4: Simulating Router call...");
  
  // Get the calldata that SwapFacet would construct
  const WETH = "0x4200000000000000000000000000000000000006";
  const token = poolKey[1]; // currency1 is the token
  const hook = poolKey[4];
  
  const zeroForOne = WETH.toLowerCase() < token.toLowerCase();
  
  const COMMAND_WRAP_ETH = 0x0b;
  const COMMAND_V4_SWAP = 0x10;
  const COMMAND_SWEEP = 0x04;
  const SWAP_EXACT_IN_SINGLE = 0x06;
  const SETTLE_ALL = 0x0C;
  const TAKE_ALL = 0x0F;
  
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  // Build the exact same encoding SwapFacet uses
  const actions = ethers.solidityPacked(["uint8", "uint8", "uint8"], [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]);
  
  // ExactInputSingleParams - match Solidity struct encoding
  const param0 = abiCoder.encode(
    ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [[
      [poolKey[0], poolKey[1], poolKey[2], poolKey[3], poolKey[4]],
      zeroForOne,
      amountIn,
      0n,
      "0x"
    ]]
  );
  
  const param1 = abiCoder.encode(["address", "uint256"], [poolKey[0], amountIn]);
  const param2 = abiCoder.encode(["address", "uint256"], [poolKey[1], 0n]);
  
  const params = [param0, param1, param2];
  
  const input0 = abiCoder.encode(["address", "uint256"], [UNIVERSAL_ROUTER, amountIn]);
  const input1 = abiCoder.encode(["bytes", "bytes[]"], [actions, params]);
  const input2 = abiCoder.encode(["address", "address", "uint256"], [token, DIAMOND, 0n]);
  
  const commands = ethers.solidityPacked(["uint8", "uint8", "uint8"], [COMMAND_WRAP_ETH, COMMAND_V4_SWAP, COMMAND_SWEEP]);
  
  const block = await ethers.provider.getBlock("latest");
  const deadline = block!.timestamp + 300;
  
  // Call router directly
  console.log("\n  Calling router directly (as EOA)...");
  const router = new ethers.Contract(UNIVERSAL_ROUTER, [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
  ], signer);
  
  try {
    const tx = await router.execute(commands, [input0, input1, input2], deadline, {
      value: amountIn,
      gasLimit: 500000
    });
    const receipt = await tx.wait();
    console.log(`  ✅ Direct call works! Tx: ${tx.hash}`);
  } catch (e: any) {
    console.log(`  ❌ Direct call failed: ${e.message?.slice(0, 200)}`);
  }
  
  // Now try to call the router FROM the diamond
  console.log("\n  Calling router from Diamond context (simulating SwapFacet)...");
  
  // The key difference: when SwapFacet calls the router, it does so from Diamond's context
  // The WRAP_ETH command sends WETH to the ROUTER itself, not to the Diamond
  // Then V4_SWAP uses those WETH tokens
  // Then SWEEP sends tokens back to address(this) which is Diamond
  
  // Let's check if the issue is the WRAP_ETH recipient
  // In SwapFacet: inputs[0] = abi.encode(UNIVERSAL_ROUTER, uint256(amountIn));
  // This wraps ETH and sends WETH to the router itself - is this correct?
  
  console.log("\n  WRAP_ETH recipient: UNIVERSAL_ROUTER");
  console.log("  This should be correct - router needs WETH to do the swap");
  
  // Maybe the issue is something else - let me try with a different recipient
  const input0_v2 = abiCoder.encode(["address", "uint256"], [signer.address, amountIn]);
  
  console.log("\n  Testing with WRAP_ETH to signer.address instead...");
  try {
    // This probably won't work but let's see
    const tx = await router.execute(commands, [input0_v2, input1, input2], deadline, {
      value: amountIn,
      gasLimit: 500000
    });
    const receipt = await tx.wait();
    console.log(`  ✅ Works with signer as recipient! Tx: ${tx.hash}`);
  } catch (e: any) {
    console.log(`  ❌ Failed (expected): ${e.message?.slice(0, 100)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
