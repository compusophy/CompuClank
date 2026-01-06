import { ethers } from "hardhat";

const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing direct Clanker deploy...");
  console.log("Signer:", signer.address);
  
  // Get the contract interface
  const factory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", CLANKER_FACTORY);
  
  // Check selector
  const deploySelector = factory.interface.getFunction("deployToken")?.selector;
  console.log("deployToken selector:", deploySelector);
  
  // Known working Clanker V4 addresses from Base
  const hook = "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC";
  const locker = "0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0";
  const mevModule = "0xE143f9872A33c955F23cF442BB4B1EFB3A7402A2";
  const devBuyExtension = "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be";
  const weth = "0x4200000000000000000000000000000000000006";
  
  const devBuyAmount = ethers.parseEther("0.003"); // Test with 0.003 ETH
  
  // Token config
  const tokenConfig = {
    tokenAdmin: signer.address,
    name: "Test Token",
    symbol: "TEST",
    salt: ethers.ZeroHash,
    image: "",
    metadata: "",
    context: '{"interface":"TEST"}',
    originatingChainId: 8453n
  };
  
  // Pool config - from SDK
  const poolConfig = {
    hook: hook,
    pairedToken: weth,
    tickIfToken0IsClanker: -230400,
    tickSpacing: 200,
    poolData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000258000000000000000000000000000000000000000000000000000000000001518000000000000000000000000000000000000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000251c"
  };
  
  // Locker config
  const lockerConfig = {
    locker: locker,
    rewardAdmins: [signer.address],
    rewardRecipients: [signer.address],
    rewardBps: [10000],
    tickLower: [-230400, -214000, -202000, -155000, -141000],
    tickUpper: [-214000, -155000, -155000, -120000, -120000],
    positionBps: [1000, 5000, 1500, 2000, 500],
    lockerData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
  };
  
  // MEV config
  const mevConfig = {
    mevModule: mevModule,
    mevModuleData: "0x00000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000007530000000000000000000000000000000000000000000000000000000000000000f"
  };
  
  // Extension config - try with NO extensions first
  const extensionsEmpty: any[] = [];
  
  const configNoExt = {
    tokenConfig,
    poolConfig,
    lockerConfig,
    mevModuleConfig: mevConfig,
    extensionConfigs: extensionsEmpty
  };
  
  console.log("\n--- Testing WITHOUT extensions (no devBuy) ---");
  try {
    await factory.deployToken.staticCall(configNoExt, { value: 0 });
    console.log("✅ Would succeed without extensions!");
  } catch (e: any) {
    console.log("❌ Failed:", e.message?.slice(0, 150));
    if (e.data) console.log("   Error data:", e.data);
  }
  
  // Now try WITH extension
  console.log("\n--- Testing WITH devBuy extension ---");
  
  // DevBuy extension data
  const devBuyData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(address,address,uint24,int24,address)", "uint128", "address"],
    [[ethers.ZeroAddress, ethers.ZeroAddress, 0, 0, ethers.ZeroAddress], 0, signer.address]
  );
  
  const extensionsWithDevBuy = [{
    extension: devBuyExtension,
    msgValue: devBuyAmount,
    extensionBps: 0, // Try 0 first
    extensionData: devBuyData
  }];
  
  const configWithExt = {
    tokenConfig,
    poolConfig,
    lockerConfig,
    mevModuleConfig: mevConfig,
    extensionConfigs: extensionsWithDevBuy
  };
  
  try {
    await factory.deployToken.staticCall(configWithExt, { value: devBuyAmount });
    console.log("✅ Would succeed with extension!");
  } catch (e: any) {
    console.log("❌ Failed:", e.message?.slice(0, 150));
    if (e.data) console.log("   Error data:", e.data);
  }
  
  // Try with extensionBps = 1000 (10%)
  console.log("\n--- Testing WITH extensionBps = 1000 ---");
  extensionsWithDevBuy[0].extensionBps = 1000;
  
  try {
    await factory.deployToken.staticCall(configWithExt, { value: devBuyAmount });
    console.log("✅ Would succeed with extensionBps=1000!");
  } catch (e: any) {
    console.log("❌ Failed:", e.message?.slice(0, 150));
    if (e.data) console.log("   Error data:", e.data);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
