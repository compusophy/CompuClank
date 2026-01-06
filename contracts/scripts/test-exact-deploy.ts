import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Testing exact deploy config from CABAL0...");
  
  const factory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", CLANKER_FACTORY);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  
  // Get settings
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  const [cabalNFT, tbaImpl, registry, factoryAddr, feeLocker, weth] = await settingsFacet.getContractAddresses();
  
  // Get cabal data
  const cabal = await viewFacet.getCabal(0);
  console.log("CABAL0 TBA:", cabal.tbaAddress);
  
  // Build exact config that CabalCreationFacet would use
  const tokenConfig = {
    tokenAdmin: cabal.tbaAddress,
    name: cabal.name,
    symbol: cabal.symbol,
    salt: ethers.ZeroHash,
    image: "",
    metadata: "",
    context: '{"interface":"CABAL"}',
    originatingChainId: 8453n
  };
  
  console.log("TokenConfig:", tokenConfig);
  
  const poolConfig = {
    hook: hook,
    pairedToken: weth,
    tickIfToken0IsClanker: -230400,
    tickSpacing: 200,
    poolData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000258000000000000000000000000000000000000000000000000000000000001518000000000000000000000000000000000000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000251c"
  };
  
  console.log("PoolConfig hook:", poolConfig.hook);
  console.log("PoolConfig pairedToken:", poolConfig.pairedToken);
  
  // CABAL0 is protocol treasury, gets 100% fees
  const lockerConfig = {
    locker: locker,
    rewardAdmins: [cabal.tbaAddress],
    rewardRecipients: [cabal.tbaAddress],
    rewardBps: [10000],
    tickLower: [-230400, -214000, -202000, -155000, -141000],
    tickUpper: [-214000, -155000, -155000, -120000, -120000],
    positionBps: [1000, 5000, 1500, 2000, 500],
    lockerData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
  };
  
  console.log("LockerConfig locker:", lockerConfig.locker);
  
  const mevConfig = {
    mevModule: mevModule,
    mevModuleData: "0x00000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000007530000000000000000000000000000000000000000000000000000000000000000f"
  };
  
  console.log("MevConfig mevModule:", mevConfig.mevModule);
  
  // No extensions - devBuy disabled
  const extensionConfigs: any[] = [];
  
  const deploymentConfig = {
    tokenConfig,
    poolConfig,
    lockerConfig,
    mevModuleConfig: mevConfig,
    extensionConfigs
  };
  
  console.log("\n--- Simulating deploy with 0 ETH ---");
  try {
    const result = await factory.deployToken.staticCall(deploymentConfig, { value: 0 });
    console.log("✅ Would succeed! Token address:", result);
  } catch (e: any) {
    console.log("❌ Failed:", e.message?.slice(0, 150));
    if (e.data) console.log("   Error data:", e.data);
  }
  
  // Try calling from TBA perspective (but we can't actually do this without the TBA executing)
  console.log("\n--- Checking if error is from TBA call ---");
  console.log("Note: The finalizeCabal calls factory via TBA.executeCall");
  console.log("TBA:", cabal.tbaAddress);
  console.log("TBA Balance:", ethers.formatEther(await ethers.provider.getBalance(cabal.tbaAddress)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
