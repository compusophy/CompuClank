import { ethers } from "hardhat";

const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

// ABI for just the deployToken function
const FACTORY_ABI = [
  "function deployToken((tuple(address tokenAdmin, string name, string symbol, bytes32 salt, string image, string metadata, string context, uint256 originatingChainId) tokenConfig, tuple(address hook, address pairedToken, int24 tickIfToken0IsClanker, int24 tickSpacing, bytes poolData) poolConfig, tuple(address locker, address[] rewardAdmins, address[] rewardRecipients, uint16[] rewardBps, int24[] tickLower, int24[] tickUpper, uint16[] positionBps, bytes lockerData) lockerConfig, tuple(address mevModule, bytes mevModuleData) mevModuleConfig, tuple(address extension, uint256 msgValue, uint16 extensionBps, bytes extensionData)[] extensionConfigs) deploymentConfig) external payable returns (address)"
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing simple Clanker deployment...");
  console.log("Deployer:", deployer.address);
  
  const factory = new ethers.Contract(CLANKER_FACTORY, FACTORY_ABI, deployer);
  
  // Read the Clanker addresses from diamond
  const DIAMOND = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  const addresses = await settingsFacet.getContractAddresses();
  const weth = addresses[5];
  
  console.log("\nClanker settings:");
  console.log("Hook:", hook);
  console.log("Locker:", locker);
  console.log("MevModule:", mevModule);
  console.log("WETH:", weth);
  
  // Try to deploy a test token with minimal params
  const config = {
    tokenConfig: {
      tokenAdmin: deployer.address,
      name: "TestToken", // No space!
      symbol: "TEST",
      salt: ethers.ZeroHash,
      image: "",
      metadata: "",
      context: '{"interface":"TEST"}',
      originatingChainId: 8453n
    },
    poolConfig: {
      hook: hook,
      pairedToken: weth,
      tickIfToken0IsClanker: -230400,
      tickSpacing: 200,
      poolData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000002710000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000002580000000000000000000000000000000000000000000000000000000000015180000000000000000000000000000000000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000251c"
    },
    lockerConfig: {
      locker: locker,
      rewardAdmins: [deployer.address],
      rewardRecipients: [deployer.address],
      rewardBps: [10000],
      tickLower: [-230400, -214000, -202000, -155000, -141000],
      tickUpper: [-214000, -155000, -155000, -120000, -120000],
      positionBps: [1000, 5000, 1500, 2000, 500],
      lockerData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
    },
    mevModuleConfig: {
      mevModule: mevModule,
      mevModuleData: "0x00000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000007530000000000000000000000000000000000000000000000000000000000000000f"
    },
    extensionConfigs: []
  };
  
  console.log("\n=== Testing deployment ===");
  try {
    const gas = await factory.deployToken.estimateGas(config);
    console.log("Gas estimate succeeded:", gas.toString());
    console.log("This means the config is valid!");
  } catch (e: any) {
    console.log("Gas estimate FAILED:", e.message?.slice(0, 300));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
