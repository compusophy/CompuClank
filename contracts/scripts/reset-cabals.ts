import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Resetting cabals with account:", deployer.address);

  // Get the SettingsFacet
  const settings = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  
  // Get current count first
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const currentCabals = await viewFacet.getAllCabals();
  console.log("\nCurrent cabal count:", currentCabals.length);

  if (currentCabals.length === 0) {
    console.log("No cabals to reset!");
    return;
  }

  // Call resetAllCabals
  console.log("\nCalling resetAllCabals...");
  const tx = await settings.resetAllCabals();
  console.log("TX:", tx.hash);
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");

  // Parse the event
  const event = receipt?.logs.find((log: any) => {
    try {
      return settings.interface.parseLog(log)?.name === "AllCabalsReset";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = settings.interface.parseLog(event as any);
    console.log("\nReset", parsed?.args.previousCount.toString(), "cabals");
  }

  // Verify
  const newCabals = await viewFacet.getAllCabals();
  console.log("New cabal count:", newCabals.length);

  console.log("\n========================================");
  console.log("All cabals have been reset!");
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
