const { ethers } = require("hardhat");

const UNIVERSAL_ROUTER = "0x4F63E5e685126e7f307f0Ae108F6Bd374f061219";
const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const HOOK = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";

const COMMAND_WRAP_ETH = 0x0b;
const COMMAND_V4_SWAP = 0x10;
const COMMAND_SWEEP = 0x04;

const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0C;
const TAKE_ALL = 0x0F;

async function main() {
  console.log("Deploying EncodeTest contract...");
  
  const EncodeTest = await ethers.getContractFactory("EncodeTest");
  const encodeTest = await EncodeTest.deploy();
  await encodeTest.waitForDeployment();
  
  const address = await encodeTest.getAddress();
  console.log(`EncodeTest deployed to: ${address}`);
  
  const amountIn = ethers.parseEther("0.0001");
  const minAmountOut = 0n;
  
  // Get Solidity encoding
  const result = await encodeTest.getEncoding(TOKEN, HOOK, amountIn, minAmountOut);
  
  console.log("\n=== SOLIDITY ENCODING ===");
  console.log("Commands:", result.commands);
  console.log("Input 0:", result.input0);
  console.log("Input 1:", result.input1.slice(0, 200) + "...");
  console.log("Input 2:", result.input2);
  
  // Get JS encoding (working version)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const zeroForOne = WETH.toLowerCase() < TOKEN.toLowerCase();
  
  const poolKey = {
    currency0: zeroForOne ? WETH : TOKEN,
    currency1: zeroForOne ? TOKEN : WETH,
    fee: 8388608,
    tickSpacing: 200,
    hooks: HOOK,
  };
  
  const actions = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
  );
  
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
  
  const param1 = abiCoder.encode(
    ["address", "uint256"],
    [poolKey.currency0, amountIn]
  );
  
  const param2 = abiCoder.encode(
    ["address", "uint256"],
    [poolKey.currency1, minAmountOut]
  );
  
  const jsInput0 = abiCoder.encode(["address", "uint256"], [UNIVERSAL_ROUTER, amountIn]);
  const jsInput1 = abiCoder.encode(["bytes", "bytes[]"], [actions, [param0, param1, param2]]);
  const jsInput2 = abiCoder.encode(["address", "address", "uint256"], [TOKEN, address, 0]);
  
  const jsCommands = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [COMMAND_WRAP_ETH, COMMAND_V4_SWAP, COMMAND_SWEEP]
  );
  
  console.log("\n=== JAVASCRIPT ENCODING ===");
  console.log("Commands:", jsCommands);
  console.log("Input 0:", jsInput0);
  console.log("Input 1:", jsInput1.slice(0, 200) + "...");
  console.log("Input 2:", jsInput2);
  
  console.log("\n=== COMPARISON ===");
  console.log("Commands equal?", result.commands === jsCommands);
  console.log("Input 0 equal?", result.input0 === jsInput0);
  console.log("Input 1 equal?", result.input1 === jsInput1);
  // Input 2 will differ due to different recipient (address(this) vs address)
  
  // Now test if Solidity encoding works with the router
  console.log("\n=== Testing Solidity Encoding ===");
  
  const [signer] = await ethers.getSigners();
  const router = new ethers.Contract(UNIVERSAL_ROUTER, [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
  ], signer);
  
  const block = await ethers.provider.getBlock("latest");
  const deadline = block!.timestamp + 300;
  
  // Use the Solidity encoding
  const solInputs = [result.input0, result.input1, result.input2];
  
  try {
    const tx = await router.execute(result.commands, solInputs, deadline, {
      value: amountIn,
      gasLimit: 500000
    });
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Solidity encoding WORKS! Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log(`❌ Solidity encoding FAILED: ${e.message?.slice(0, 300)}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
