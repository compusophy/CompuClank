import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  
  // Correct Clanker V4 Factory address from ClankerAddresses.sol
  const CORRECT_CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

  console.log("Fixing Clanker Factory address in Diamond at:", DIAMOND);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  // Check current state
  console.log("\nChecking current addresses...");
  const [cabalNFT, tbaImpl, registry, currentFactory, feeLocker, weth] = await settingsFacet.getContractAddresses();
  console.log("Current clankerFactory:", currentFactory);
  console.log("Correct clankerFactory:", CORRECT_CLANKER_FACTORY);

  if (currentFactory.toLowerCase() === CORRECT_CLANKER_FACTORY.toLowerCase()) {
    console.log("\n✅ Factory address is already correct!");
    return;
  }

  console.log("\n⚠️  Factory address is WRONG - updating...");

  // Update the factory address
  const tx = await settingsFacet.updateContractAddress("clankerFactory", CORRECT_CLANKER_FACTORY);
  console.log("Transaction submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  
  await tx.wait();
  console.log("Transaction confirmed!");

  // Verify
  console.log("\nVerifying...");
  const [, , , newFactory, ,] = await settingsFacet.getContractAddresses();
  console.log("New clankerFactory:", newFactory);

  if (newFactory.toLowerCase() === CORRECT_CLANKER_FACTORY.toLowerCase()) {
    console.log("\n✅ Factory address updated successfully!");
  } else {
    console.log("\n❌ Update failed!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
