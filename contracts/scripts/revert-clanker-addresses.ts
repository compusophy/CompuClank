import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  
  // Revert to the OLD addresses that were there before fix-clanker-v4-addresses.ts
  // These might work with the hardcoded data blobs in CabalCreationFacet
  const OLD_WORKING = {
    hook: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC", // This was already correct
    locker: "0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496", // OLD - LP_LOCKER_FEE_CONVERSION
    mevModule: "0xebB25BB797D82CB78E1bc70406b13233c0854413", // OLD 
    devBuyExtension: "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be",
  };

  console.log("REVERTING Clanker V4 addresses to OLD working values!");
  console.log("Diamond:", DIAMOND);
  
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  console.log("\nReverting to OLD addresses:");
  console.log("  Hook:", OLD_WORKING.hook);
  console.log("  Locker:", OLD_WORKING.locker);
  console.log("  MevModule:", OLD_WORKING.mevModule);
  console.log("  DevBuyExtension:", OLD_WORKING.devBuyExtension);

  // Update each address using the updateContractAddress function
  console.log("\nUpdating locker...");
  let tx = await settingsFacet.updateContractAddress("clankerLocker", OLD_WORKING.locker);
  await tx.wait();
  console.log("  ✅ Locker updated");
  await new Promise(r => setTimeout(r, 2000));

  console.log("Updating mevModule...");
  tx = await settingsFacet.updateContractAddress("clankerMevModule", OLD_WORKING.mevModule);
  await tx.wait();
  console.log("  ✅ MevModule updated");

  // Verify
  console.log("\nVerifying...");
  const [hook, locker, mev, devBuy] = await settingsFacet.getClankerAddresses();
  console.log("Current addresses:");
  console.log("  Hook:", hook);
  console.log("  Locker:", locker);
  console.log("  MevModule:", mev);
  console.log("  DevBuyExtension:", devBuy);

  console.log("\n✅ Reverted to OLD working addresses!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
