const { ethers } = require("hardhat");

// Updated addresses
const UNIVERSAL_ROUTER = "0x4F63E5e685126e7f307f0Ae108F6Bd374f061219";
const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const HOOK = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";

// Commands
const COMMAND_WRAP_ETH = 0x0b;
const COMMAND_V4_SWAP = 0x10;
const COMMAND_SWEEP = 0x04;

// Actions
const SWAP_EXACT_IN_SINGLE = 0x06;
const SETTLE_ALL = 0x0C;
const TAKE_ALL = 0x0F;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Testing direct swap with signer: ${signer.address}`);
  
  const amountIn = ethers.parseEther("0.0001");
  const minAmountOut = 0n;
  
  // Determine swap direction: WETH -> Token
  const zeroForOne = WETH.toLowerCase() < TOKEN.toLowerCase();
  console.log(`zeroForOne: ${zeroForOne}`);
  
  // Build PoolKey
  const poolKey = {
    currency0: zeroForOne ? WETH : TOKEN,
    currency1: zeroForOne ? TOKEN : WETH,
    fee: 8388608, // Dynamic fee flag
    tickSpacing: 200,
    hooks: HOOK,
  };
  console.log(`PoolKey:`, poolKey);
  
  // Build ExactInputSingleParams struct
  const swapParams = {
    poolKey: poolKey,
    zeroForOne: zeroForOne,
    amountIn: amountIn,
    amountOutMinimum: minAmountOut,
    hookData: "0x",
  };
  
  // Encode actions
  const actions = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
  );
  console.log(`Actions: ${actions}`);
  
  // Encode params for each action
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  // Param 0: ExactInputSingleParams
  const param0 = abiCoder.encode(
    ["tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)"],
    [[
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
      swapParams.zeroForOne,
      swapParams.amountIn,
      swapParams.amountOutMinimum,
      swapParams.hookData
    ]]
  );
  
  // Param 1: SETTLE_ALL (currency, maxAmount)
  const param1 = abiCoder.encode(
    ["address", "uint128"],
    [zeroForOne ? poolKey.currency0 : poolKey.currency1, amountIn]
  );
  
  // Param 2: TAKE_ALL (currency, minAmount)
  const param2 = abiCoder.encode(
    ["address", "uint128"],
    [zeroForOne ? poolKey.currency1 : poolKey.currency0, minAmountOut]
  );
  
  const params = [param0, param1, param2];
  
  // Build inputs
  const inputs: string[] = [];
  
  // Input 0: WRAP_ETH (recipient, amount)
  inputs.push(abiCoder.encode(["address", "uint256"], [UNIVERSAL_ROUTER, amountIn]));
  
  // Input 1: V4_SWAP (actions, params)
  inputs.push(abiCoder.encode(["bytes", "bytes[]"], [actions, params]));
  
  // Input 2: SWEEP (token, recipient, minAmount)
  inputs.push(abiCoder.encode(["address", "address", "uint256"], [TOKEN, signer.address, 0]));
  
  // Build commands
  const commands = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [COMMAND_WRAP_ETH, COMMAND_V4_SWAP, COMMAND_SWEEP]
  );
  console.log(`Commands: ${commands}`);
  
  // Get deadline
  const block = await ethers.provider.getBlock("latest");
  const deadline = block!.timestamp + 300;
  
  console.log(`\nExecuting swap...`);
  console.log(`  Amount In: ${ethers.formatEther(amountIn)} ETH`);
  
  // Call Universal Router directly
  const router = new ethers.Contract(UNIVERSAL_ROUTER, [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
  ], signer);
  
  try {
    const tx = await router.execute(commands, inputs, deadline, {
      value: amountIn,
      gasLimit: 500000
    });
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Transaction succeeded! Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log(`❌ Transaction failed`);
    console.log(`Error: ${e.message}`);
    
    // Try to decode error
    if (e.data) {
      console.log(`Error data: ${e.data}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
