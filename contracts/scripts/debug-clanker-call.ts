import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  console.log("Debugging Clanker Factory call...");
  
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  
  // Get cabal data
  const cabal = await viewFacet.getCabal(0);
  console.log("\n--- Cabal Data ---");
  console.log("Name:", cabal.name);
  console.log("Symbol:", cabal.symbol);
  console.log("TBA:", cabal.tbaAddress);
  console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
  
  // Get settings
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  console.log("\n--- Clanker Settings ---");
  console.log("Hook:", hook);
  console.log("Locker:", locker);
  console.log("MEV Module:", mevModule);
  console.log("DevBuy Extension:", devBuyExtension);
  
  const [cabalNFT, tbaImpl, registry, factory, feeLocker, weth] = await settingsFacet.getContractAddresses();
  console.log("\n--- Contract Addresses ---");
  console.log("Factory:", factory);
  console.log("WETH:", weth);
  
  // Calculate amounts
  const totalRaised = cabal.totalRaised;
  const protocolFee = totalRaised * 100n / 10000n;
  const remaining = totalRaised - protocolFee;
  const treasuryEth = remaining * 3300n / 9900n;
  const devBuyAmount = remaining - treasuryEth;
  
  console.log("\n--- Amounts ---");
  console.log("Total Raised:", ethers.formatEther(totalRaised));
  console.log("Protocol Fee:", ethers.formatEther(protocolFee));
  console.log("Treasury ETH:", ethers.formatEther(treasuryEth));
  console.log("DevBuy Amount:", ethers.formatEther(devBuyAmount));
  
  // Build the deployment config manually
  const DEFAULT_TICK = -230400;
  const DEFAULT_TICK_SPACING = 200;
  
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
  
  const poolConfig = {
    hook: hook,
    pairedToken: weth,
    tickIfToken0IsClanker: DEFAULT_TICK,
    tickSpacing: DEFAULT_TICK_SPACING,
    poolData: "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000271000000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000000258000000000000000000000000000000000000000000000000000000000001518000000000000000000000000000000000000000000000000000000000000000c800000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000251c"
  };
  
  // Locker config - For CABAL0, 100% to self
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
  
  const mevConfig = {
    mevModule: mevModule,
    mevModuleData: "0x00000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000000007530000000000000000000000000000000000000000000000000000000000000000f"
  };
  
  // DevBuy extension config
  // Encodes: { pairedTokenPoolKey, pairedTokenAmountOutMinimum, recipient }
  // For WETH pairs, poolKey is zeroed out
  const devBuyData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(address,address,uint24,int24,address)", "uint128", "address"],
    [[ethers.ZeroAddress, ethers.ZeroAddress, 0, 0, ethers.ZeroAddress], 0, cabal.tbaAddress]
  );
  
  const extensionConfigs = [{
    extension: devBuyExtension,
    msgValue: devBuyAmount,
    extensionBps: 6633, // ~66.33% of remaining after treasury ETH
    extensionData: devBuyData
  }];
  
  const deploymentConfig = {
    tokenConfig,
    poolConfig,
    lockerConfig,
    mevModuleConfig: mevConfig,
    extensionConfigs
  };
  
  console.log("\n--- DevBuy Extension Data ---");
  console.log("Extension:", devBuyExtension);
  console.log("MsgValue:", ethers.formatEther(devBuyAmount), "ETH");
  console.log("ExtensionBps:", 6633);
  console.log("ExtensionData:", devBuyData);
  
  // Try to encode and call the factory
  console.log("\n--- Simulating Factory Call ---");
  const factoryInterface = new ethers.Interface([
    "function deployToken((tuple(address,string,string,bytes32,string,string,string,uint256),tuple(address,address,int24,int24,bytes),tuple(address,address[],address[],uint16[],int24[],int24[],uint16[],bytes),tuple(address,bytes),tuple(address,uint256,uint16,bytes)[])) payable returns (address)"
  ]);
  
  try {
    const calldata = factoryInterface.encodeFunctionData("deployToken", [deploymentConfig]);
    console.log("Calldata length:", calldata.length);
    console.log("Calldata (first 100 chars):", calldata.slice(0, 100));
    
    // Try direct call simulation
    const result = await ethers.provider.call({
      to: CLANKER_FACTORY,
      data: calldata,
      value: devBuyAmount,
      from: cabal.tbaAddress // Simulate from TBA
    });
    console.log("✅ Direct call would succeed! Result:", result);
  } catch (e: any) {
    console.log("❌ Direct call failed:", e.message?.slice(0, 200));
    if (e.data) {
      console.log("Error data:", e.data);
      
      // Try to decode as string
      if (e.data.startsWith("0x08c379a0")) {
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + e.data.slice(10));
        console.log("Revert reason:", reason[0]);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
