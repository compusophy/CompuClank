const { ethers } = require("hardhat");

// CORRECT router (verified has 39KB code)
const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43";
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
  console.log(`Testing with CORRECT router: ${UNIVERSAL_ROUTER}`);
  console.log(`Signer: ${signer.address}\n`);
  
  const routerCode = await ethers.provider.getCode(UNIVERSAL_ROUTER);
  console.log(`Router code length: ${routerCode.length} bytes\n`);
  
  const amountIn = ethers.parseEther("0.0001");
  const minAmountOut = 0n;
  
  const zeroForOne = WETH.toLowerCase() < TOKEN.toLowerCase();
  
  const poolKey = {
    currency0: zeroForOne ? WETH : TOKEN,
    currency1: zeroForOne ? TOKEN : WETH,
    fee: 8388608,
    tickSpacing: 200,
    hooks: HOOK,
  };
  
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
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
  
  const param1 = abiCoder.encode(["address", "uint256"], [poolKey.currency0, amountIn]);
  const param2 = abiCoder.encode(["address", "uint256"], [poolKey.currency1, minAmountOut]);
  
  const params = [param0, param1, param2];
  
  // WRAP_ETH: (recipient, amount)
  const input0 = abiCoder.encode(["address", "uint256"], [UNIVERSAL_ROUTER, amountIn]);
  const input1 = abiCoder.encode(["bytes", "bytes[]"], [actions, params]);
  const input2 = abiCoder.encode(["address", "address", "uint256"], [TOKEN, signer.address, 0]);
  
  const commands = ethers.solidityPacked(
    ["uint8", "uint8", "uint8"],
    [COMMAND_WRAP_ETH, COMMAND_V4_SWAP, COMMAND_SWEEP]
  );
  
  const block = await ethers.provider.getBlock("latest");
  const deadline = block!.timestamp + 300;
  
  console.log("Testing swap...");
  
  const router = new ethers.Contract(UNIVERSAL_ROUTER, [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable"
  ], signer);
  
  try {
    const tx = await router.execute(commands, [input0, input1, input2], deadline, {
      value: amountIn,
      gasLimit: 500000
    });
    console.log(`Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ SUCCESS! Gas used: ${receipt.gasUsed}`);
  } catch (e: any) {
    console.log(`❌ FAILED`);
    console.log(`Error: ${e.message?.slice(0, 300)}`);
    if (e.data) console.log(`Error data: ${e.data}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
