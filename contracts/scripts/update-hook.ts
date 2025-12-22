import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  
  // Official Clanker hooks on Base
  const CLANKER_HOOK_DYNAMIC_FEE = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC"; // Restoring the working hook
  const CLANKER_HOOK_STATIC_FEE = "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC";
  
  // Try the DynamicFee hook first
  const NEW_HOOK = CLANKER_HOOK_DYNAMIC_FEE;
  
  console.log("Connecting to Diamond at:", DIAMOND);
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  // Check current hook
  const [currentHook] = await settingsFacet.getClankerAddresses();
  console.log("\nCurrent hook:", currentHook);
  console.log("New hook:    ", NEW_HOOK);
  
  if (currentHook === NEW_HOOK) {
    console.log("\nHook is already correct! Exiting.");
    return;
  }
  
  console.log("\nUpdating hook address...");
  
  const tx = await settingsFacet.updateContractAddress("clankerHook", NEW_HOOK);
  console.log("Transaction submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  console.log("Transaction confirmed!");
  
  // Verify
  const [newHook] = await settingsFacet.getClankerAddresses();
  console.log("\nVerified new hook:", newHook);
  
  if (newHook === NEW_HOOK) {
    console.log("\n✅ Hook updated successfully!");
  } else {
    console.log("\n❌ Hook update verification failed!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
