import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  const CABAL_ID = 23;

  console.log("=== Simulating Token Deployment ===");

  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND);

  // Get all the addresses
  const [cabalNFT, tbaImpl, erc6551Registry, clankerFactory, clankerFeeLocker, weth] = 
    await settingsFacet.getContractAddresses();
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();

  console.log("\n=== Contract Addresses ===");
  console.log("clankerFactory:", clankerFactory);
  console.log("WETH:", weth);
  console.log("hook:", hook);
  console.log("locker:", locker);
  console.log("mevModule:", mevModule);
  console.log("devBuyExtension:", devBuyExtension);

  // Get cabal info
  const cabal = await viewFacet.getCabal(CABAL_ID);
  console.log("\n=== Cabal Info ===");
  console.log("Name:", cabal.name);
  console.log("Symbol:", cabal.symbol);
  console.log("TBA:", cabal.tbaAddress);
  console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");

  // Simulate building the deployment config
  // This is what the contract does internally
  const ZERO_BYTES32 = ethers.zeroPadValue("0x", 32);
  const tokenURI = `https://cabal.pub/api/token/${CABAL_ID}`;

  // Pool data - hardcoded as per contract
  const poolData = "0x000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000000";
  
  // Locker data - hardcoded as per contract
  const lockerData = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";
  
  // MEV data - hardcoded as per contract
  const mevModuleData = "0x0000000000000000000000000000000000000000000000000000000000000010";

  // Build the TokenConfig struct
  const tokenConfig = {
    deployer: cabal.tbaAddress,
    name: cabal.name,
    symbol: cabal.symbol,
    salt: ZERO_BYTES32,
    image: "",
    metadata: tokenURI,
    context: "",
    originatingChainId: 8453n, // Base chain ID
  };

  // Build PoolConfig
  const poolConfig = {
    pairedToken: weth,
    hook: hook,
    tickLower: -887220,
    tickUpper: 887220,
    data: poolData,
  };

  // Build LockerConfig
  const lockerConfig = {
    locker: locker,
    lpRecipients: [cabal.tbaAddress],
    rewardRecipients: [cabal.tbaAddress],
    lpBps: [10000],
    tickLowers: [-887220],
    tickUppers: [887220],
    rewardBps: [10000],
    data: lockerData,
  };

  // Build MevModuleConfig
  const mevModuleConfig = {
    mevModule: mevModule,
    data: mevModuleData,
  };

  // Extension configs
  const treasuryAmount = (cabal.totalRaised * 33n) / 100n;
  const devBuyAmount = cabal.totalRaised - treasuryAmount - (cabal.totalRaised / 100n);
  
  console.log("\n=== ETH Distribution ===");
  console.log("Treasury:", ethers.formatEther(treasuryAmount), "ETH");
  console.log("DevBuy:", ethers.formatEther(devBuyAmount), "ETH");
  console.log("Protocol Fee (1%):", ethers.formatEther(cabal.totalRaised / 100n), "ETH");

  const extensionConfigs = devBuyAmount > 0 ? [{
    extension: devBuyExtension,
    value: devBuyAmount,
    bps: 0,
    data: "0x",
  }] : [];

  const deploymentConfig = {
    tokenConfig,
    poolConfig,
    lockerConfig,
    mevModuleConfig,
    extensionConfigs,
  };

  console.log("\n=== Deployment Config ===");
  console.log(JSON.stringify(deploymentConfig, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  , 2));

  // Try to encode the call
  const IClankerFactory = await ethers.getContractAt(
    "contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", 
    clankerFactory
  );
  
  const calldata = IClankerFactory.interface.encodeFunctionData("deployToken", [deploymentConfig]);
  console.log("\n=== Calldata ===");
  console.log("Selector:", calldata.slice(0, 10));
  console.log("Length:", calldata.length, "bytes");

  // Now try to staticcall directly to the factory (simulating what the TBA would do)
  console.log("\n=== Simulating Factory Call ===");
  console.log("Calling factory at:", clankerFactory);
  console.log("With value:", ethers.formatEther(devBuyAmount), "ETH");

  try {
    const result = await ethers.provider.call({
      to: clankerFactory,
      data: calldata,
      value: devBuyAmount,
      from: cabal.tbaAddress, // Simulate from the TBA
    });
    console.log("✅ Static call succeeded!");
    console.log("Result:", result);
  } catch (error: any) {
    console.log("❌ Static call failed!");
    console.log("Error data:", error.data);
    console.log("Message:", error.message);
    
    // Try to decode the error
    if (error.data && error.data.length >= 10) {
      console.log("\nError selector:", error.data.slice(0, 10));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
