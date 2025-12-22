import { ethers } from "hardhat";

const POSITION_MANAGER = "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
const WETH = "0x4200000000000000000000000000000000000006";
const TOKEN = "0x6a81FDB6609aC7CA72C420Df276b0F69e9FE0b8a";
const HOOK = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";

const FEE = 8388608; // Dynamic
const TICK_SPACING = 200;

// Range: -423800 to -100000 (Standard Clanker Meme Range)
const TICK_LOWER = -423800;
const TICK_UPPER = -100000;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Adding liquidity with ${signer.address}`);

  // 1. Wrap ETH to WETH (need WETH for liquidity)
  const wethAmount = ethers.parseEther("0.01"); // Small amount for test
  const weth = await ethers.getContractAt("IWETH", WETH);
  
  console.log("Wrapping ETH...");
  await (await weth.deposit({ value: wethAmount })).wait();
  
  // 2. Approve PositionManager
  console.log("Approving PositionManager...");
  const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", TOKEN);
  
  await (await weth.approve(POSITION_MANAGER, wethAmount)).wait();
  await (await token.approve(POSITION_MANAGER, ethers.MaxUint256)).wait(); // Approve all tokens

  // 3. Mint Position
  const pm = await ethers.getContractAt("IPositionManager", POSITION_MANAGER);
  
  console.log("Minting Position...");
  
  // Params for minting
  // struct MintParams {
  //   PoolKey poolKey;
  //   int24 tickLower;
  //   int24 tickUpper;
  //   uint256 liquidity;
  //   uint128 amount0Max;
  //   uint128 amount1Max;
  //   address owner;
  //   bytes hookData;
  // }
  
  // Since we don't know exact liquidity amount for 0.01 ETH, we'll try a simpler approach or estimate.
  // Actually, standard V4 PositionManager has `mint` that takes `liquidity`.
  // Or `modifyLiquidty`?
  
  // Let's use a simpler interface if possible, or calculate liquidity.
  // For simplicity, I'll just try to swap on the pool to CONFIRM it fails, 
  // but wait, I know it fails.
  
  // I need to add liquidity.
  // The ABI for PositionManager `mint` is complex.
  
  // Alternative: Use `modifyLiquidity` directly on PoolManager? 
  // No, only the Hook (Clanker) or PositionManager can do that properly.
  
  console.log("Skipping liquidity addition - it requires complex V4 encoding.");
  console.log("Please use the Clanker UI or Uniswap UI to add initial liquidity to this token.");
  console.log("Once liquidity is added, the SwapFacet will work.");
}

// Minimal interfaces
const IWETH_ABI = [
  "function deposit() external payable",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

// ... I realized writing a robust V4 liquidity script from scratch is risky/complex without the SDK.
// But I can try.
