import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing devBuy deploy...");
  
  const factory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", CLANKER_FACTORY);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  
  // Get current (updated) settings
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  const [cabalNFT, tbaImpl, registry, factoryAddr, feeLocker, weth] = await settingsFacet.getContractAddresses();
  
  console.log("\n--- Current Settings ---");
  console.log("Hook:", hook);
  console.log("Locker:", locker);
  console.log("MevModule:", mevModule);
  console.log("DevBuy Extension:", devBuyExtension);
  
  const devBuyAmount = ethers.parseEther("0.001"); // Test with 0.001 ETH
  
  // Token config
  const tokenConfig = {
    tokenAdmin: signer.address,
    name: "Test DevBuy Token",
    symbol: "TESTDEV",
    salt: ethers.keccak256(ethers.toUtf8Bytes("test-devbuy-" + Date.now())),
    image: "",
    metadata: "",
    context: '{"interface":"TEST"}',
    originatingChainId: 8453n
  };
  
  // Pool config
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
  
  // DevBuy extension data
  const devBuyData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(address,address,uint24,int24,address)", "uint128", "address"],
    [[ethers.ZeroAddress, ethers.ZeroAddress, 0, 0, ethers.ZeroAddress], 0, signer.address]
  );
  
  const extensionConfigs = [{
    extension: devBuyExtension,
    msgValue: devBuyAmount,
    extensionBps: 0,
    extensionData: devBuyData
  }];
  
  const deploymentConfig = {
    tokenConfig,
    poolConfig,
    lockerConfig,
    mevModuleConfig: mevConfig,
    extensionConfigs
  };
  
  console.log("\n--- Testing deploy with devBuy (0.001 ETH) ---");
  try {
    const result = await factory.deployToken.staticCall(deploymentConfig, { value: devBuyAmount });
    console.log("✅ Simulation SUCCESS! Token address would be:", result);
    console.log("\nDevBuy is working with the new Clanker V4 addresses!");
  } catch (e: any) {
    console.log("❌ Simulation failed:", e.message?.slice(0, 200));
    if (e.data) console.log("   Error data:", e.data);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
