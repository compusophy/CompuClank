const { ethers } = require("hardhat");

// Updated addresses
const UNIVERSAL_ROUTER = "0x4F63E5e685126e7f307f0Ae108F6Bd374f061219";
const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const HOOK = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";
const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

// Commands
const COMMAND_WRAP_ETH = 0x0b;
const COMMAND_V4_SWAP = 0x10;
const COMMAND_SWEEP = 0x04;

// Actions
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0C;
const TAKE_ALL = 0x0F;

async function main() {
  console.log("Comparing encoding between working test and SwapFacet...\n");
  
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const amountIn = ethers.parseEther("0.0001");
  const minAmountOut = 0n;
  const zeroForOne = WETH.toLowerCase() < TOKEN.toLowerCase();
  
  // Build PoolKey
  const poolKey = {
    currency0: zeroForOne ? WETH : TOKEN,
    currency1: zeroForOne ? TOKEN : WETH,
    fee: 8388608,
    tickSpacing: 200,
    hooks: HOOK,
  };
  
  // === WORKING ENCODING (from test script) ===
  const actions = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
  );
  
  // Param 0: ExactInputSingleParams
  const param0 = abiCoder.encode(
    ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [[
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
      zeroForOne,
      amountIn,
      minAmountOut,
      "0x"
    ]]
  );
  
  // Param 1: SETTLE_ALL (currency, maxAmount) - using uint128
  const param1 = abiCoder.encode(
    ["address", "uint128"],
    [poolKey.currency0, amountIn]
  );
  
  // Param 2: TAKE_ALL (currency, minAmount) - using uint128
  const param2 = abiCoder.encode(
    ["address", "uint128"],
    [poolKey.currency1, minAmountOut]
  );
  
  const params = [param0, param1, param2];
  
  // Build inputs
  const input0 = abiCoder.encode(["address", "uint256"], [UNIVERSAL_ROUTER, amountIn]);
  const input1 = abiCoder.encode(["bytes", "bytes[]"], [actions, params]);
  const input2 = abiCoder.encode(["address", "address", "uint256"], [TOKEN, DIAMOND, 0]);
  
  const commands = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [COMMAND_WRAP_ETH, COMMAND_V4_SWAP, COMMAND_SWEEP]
  );
  
  console.log("WORKING ENCODING:");
  console.log("================");
  console.log("Commands:", commands);
  console.log("Input 0 (WRAP_ETH):", input0);
  console.log("Input 1 (V4_SWAP):", input1.slice(0, 200) + "...");
  console.log("Input 2 (SWEEP):", input2);
  
  console.log("\nParam 0 (ExactInputSingleParams):", param0.slice(0, 200) + "...");
  console.log("Param 1 (SETTLE_ALL):", param1);
  console.log("Param 2 (TAKE_ALL):", param2);
  
  // === NOW TRY WITH uint256 for SETTLE_ALL and TAKE_ALL (what SwapFacet might be doing) ===
  console.log("\n\n=== Comparing with uint256 encoding ===\n");
  
  const param1_u256 = abiCoder.encode(
    ["address", "uint256"],
    [poolKey.currency0, amountIn]
  );
  
  const param2_u256 = abiCoder.encode(
    ["address", "uint256"],
    [poolKey.currency1, minAmountOut]
  );
  
  console.log("Param 1 with uint128:", param1);
  console.log("Param 1 with uint256:", param1_u256);
  console.log("Are they equal?", param1 === param1_u256);
  
  console.log("\nParam 2 with uint128:", param2);
  console.log("Param 2 with uint256:", param2_u256);
  console.log("Are they equal?", param2 === param2_u256);
  
  // Try calling with uint256 encoding
  console.log("\n\n=== Testing swap with uint256 encoding ===\n");
  
  const [signer] = await ethers.getSigners();
  
  const params256 = [param0, param1_u256, param2_u256];
  const input1_256 = abiCoder.encode(["bytes", "bytes[]"], [actions, params256]);
  
  const router = new ethers.Contract(UNIVERSAL_ROUTER, [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
  ], signer);
  
  const block = await ethers.provider.getBlock("latest");
  const deadline = block!.timestamp + 300;
  
  try {
    const tx = await router.execute(commands, [input0, input1_256, input2], deadline, {
      value: amountIn,
      gasLimit: 500000
    });
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ uint256 encoding works! Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log(`❌ uint256 encoding failed: ${e.message?.slice(0, 200)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
