import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  const CABAL_ID = 23n;

  console.log("=== Debug Launch for Cabal", CABAL_ID.toString(), "===\n");
  
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Get contract instances
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  const creationFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND);

  // Check Clanker V4 addresses
  console.log("\n=== Clanker V4 Addresses ===");
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  console.log("Hook:", hook);
  console.log("Locker:", locker);
  console.log("MevModule:", mevModule);
  console.log("DevBuyExtension:", devBuyExtension);

  // CORRECT addresses from Clanker SDK v4.2.8
  const expectedHook = "0xd60D6B218116cFd801E28F78d011a203D2b068Cc";     // feeDynamicHookV2 (matches SDK output)
  const expectedLocker = "0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496";   // related.locker
  const expectedMev = "0xebB25BB797D82CB78E1bc70406b13233c0854413";      // mevModuleV2

  if (hook.toLowerCase() !== expectedHook.toLowerCase()) {
    console.log("❌ Hook is WRONG! Run fix-clanker-v4-addresses.ts first!");
    return;
  }
  if (locker.toLowerCase() !== expectedLocker.toLowerCase()) {
    console.log("❌ Locker is WRONG! Run fix-clanker-v4-addresses.ts first!");
    return;
  }
  if (mevModule.toLowerCase() !== expectedMev.toLowerCase()) {
    console.log("❌ MevModule is WRONG! Run fix-clanker-v4-addresses.ts first!");
    return;
  }
  console.log("✅ All Clanker V4 addresses are correct");

  // Get cabal info
  console.log("\n=== Cabal Info ===");
  const cabal = await viewFacet.getCabal(CABAL_ID);
  console.log("Phase:", cabal.phase, cabal.phase === 0n ? "(Presale)" : cabal.phase === 1n ? "(Active)" : "(Other)");
  console.log("TBA:", cabal.tbaAddress);
  console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");

  // Get TBA balance
  const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
  console.log("TBA Balance:", ethers.formatEther(tbaBalance), "ETH");

  // Get launch vote status
  console.log("\n=== Launch Vote Status ===");
  const voteStatus = await creationFacet.getLaunchVoteStatus(CABAL_ID);
  console.log("Votes For:", ethers.formatEther(voteStatus.votesFor), "ETH");
  console.log("Majority Met:", voteStatus.majorityMet);
  console.log("Launch Approved At:", voteStatus.launchApprovedAt.toString());
  console.log("Launchable At:", voteStatus.launchableAt.toString());

  const now = Math.floor(Date.now() / 1000);
  const launchableAt = Number(voteStatus.launchableAt);
  console.log("Current Time:", now);
  console.log("Time Diff:", now - launchableAt, "seconds");

  if (cabal.phase !== 0n) {
    console.log("\n❌ Cabal is not in Presale phase!");
    return;
  }

  if (voteStatus.launchApprovedAt === 0n) {
    console.log("\n❌ Launch not approved yet (need 51% votes)");
    return;
  }

  if (now < launchableAt) {
    console.log("\n❌ Timer not elapsed yet! Wait", Math.ceil((launchableAt - now) / 60), "more minutes");
    return;
  }

  console.log("\n✅ All pre-checks pass! Attempting static call...");

  // Try static call to see what error we get
  try {
    await creationFacet.finalizeCabal.staticCall(CABAL_ID);
    console.log("\n✅ Static call succeeded! Transaction should work.");
  } catch (error: any) {
    console.log("\n❌ Static call failed!");
    console.log("Error:", error.message);
    
    // Try to decode the error
    if (error.data) {
      console.log("Error data:", error.data);
    }
    if (error.reason) {
      console.log("Reason:", error.reason);
    }
    
    // Check specific error signatures
    const errorSigs: Record<string, string> = {
      "0x8c5be1e5": "CabalNotInPresale",
      "0x": "Unknown",
    };
    
    // Print full error for debugging
    console.log("\nFull error object:");
    console.log(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
