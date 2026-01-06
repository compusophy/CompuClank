import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
  
  // Clanker V4 addresses on Base Mainnet (updated Jan 2026)
  // These addresses were extracted from successful Clanker transactions
  const CLANKER_V4 = {
    hook: "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC",       // Dynamic fee hook
    locker: "0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496",     // LP Locker Fee Conversion v4
    mevModule: "0xebB25BB797D82CB78E1bc70406b13233c0854413",  // Sniper Auction
    devBuyExtension: "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be",  // Univ4 ETH DevBuy
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
    
    // Check if update needed
    if (hook === CLANKER_V4.hook && locker === CLANKER_V4.locker && mev === CLANKER_V4.mevModule && devBuy === CLANKER_V4.devBuyExtension) {
      console.log("\nAddresses already correct! Exiting.");
      return;
    }
    console.log("\nAddresses need updating...")
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
