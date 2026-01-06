import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  
  // From SDK: clanker_v4_base.related.feeDynamicHookV2
  const FEE_DYNAMIC_HOOK_V2 = "0xd60D6B218116cFd801E28F78d011a203D2b068Cc";

  console.log("Updating hook to feeDynamicHookV2");
  console.log("Diamond:", DIAMOND);
  console.log("New hook:", FEE_DYNAMIC_HOOK_V2);
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  const [currentHook] = await settingsFacet.getClankerAddresses();
  console.log("Current hook:", currentHook);
  
  if (currentHook.toLowerCase() === FEE_DYNAMIC_HOOK_V2.toLowerCase()) {
    console.log("✅ Already using feeDynamicHookV2");
    return;
  }
  
  console.log("\nUpdating...");
  const tx = await settingsFacet.updateContractAddress("clankerHook", FEE_DYNAMIC_HOOK_V2);
  await tx.wait();
  console.log("✅ Hook updated!");
  
  // Verify
  const [newHook] = await settingsFacet.getClankerAddresses();
  console.log("New hook:", newHook);
}

main().catch(console.error);
