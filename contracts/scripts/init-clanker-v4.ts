import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  
  // Clanker V4 addresses on Base Mainnet
  const CLANKER_V4 = {
    hook: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC",
    locker: "0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0",
    mevModule: "0xE143f9872A33c955F23cF442BB4B1EFB3A7402A2",
    devBuyExtension: "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be",
  };

  console.log("Connecting to Diamond at:", DIAMOND);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  // First check current state
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  console.log("\nChecking current Clanker V4 addresses...");
  try {
    const [hook, locker, mev, devBuy] = await settingsFacet.getClankerAddresses();
    console.log("Current state:");
    console.log("  Hook:", hook);
    console.log("  Locker:", locker);
    console.log("  MevModule:", mev);
    console.log("  DevBuyExtension:", devBuy);
    
    if (hook !== ethers.ZeroAddress) {
      console.log("\nAddresses already initialized! Exiting.");
      return;
    }
  } catch (e) {
    console.log("Could not read current state, proceeding with initialization...");
  }

  console.log("\nInitializing Clanker V4 addresses...");
  console.log("  Hook:", CLANKER_V4.hook);
  console.log("  Locker:", CLANKER_V4.locker);
  console.log("  MevModule:", CLANKER_V4.mevModule);
  console.log("  DevBuyExtension:", CLANKER_V4.devBuyExtension);

  const tx = await settingsFacet.initializeClankerAddresses(
    CLANKER_V4.hook,
    CLANKER_V4.locker,
    CLANKER_V4.mevModule,
    CLANKER_V4.devBuyExtension
  );
  
  console.log("\nTransaction submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify
  console.log("\nVerifying...");
  const [hook, locker, mev, devBuy] = await settingsFacet.getClankerAddresses();
  console.log("New state:");
  console.log("  Hook:", hook);
  console.log("  Locker:", locker);
  console.log("  MevModule:", mev);
  console.log("  DevBuyExtension:", devBuy);

  if (
    hook === CLANKER_V4.hook &&
    locker === CLANKER_V4.locker &&
    mev === CLANKER_V4.mevModule &&
    devBuy === CLANKER_V4.devBuyExtension
  ) {
    console.log("\n✅ All addresses initialized correctly!");
  } else {
    console.log("\n❌ Verification failed - addresses don't match!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
