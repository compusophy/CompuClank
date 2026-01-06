import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

  console.log("Checking Clanker settings in Diamond at:", DIAMOND);
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  // Check main contract addresses
  console.log("\n=== Main Contract Addresses ===");
  const [cabalNFT, tbaImpl, registry, factory, feeLocker, weth] = await settingsFacet.getContractAddresses();
  console.log("cabalNFT:", cabalNFT);
  console.log("tbaImplementation:", tbaImpl);
  console.log("erc6551Registry:", registry);
  console.log("clankerFactory:", factory);
  console.log("clankerFeeLocker:", feeLocker);
  console.log("weth:", weth);
  
  // Check Clanker V4 addresses
  console.log("\n=== Clanker V4 Addresses ===");
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  console.log("hook:", hook);
  console.log("locker:", locker);
  console.log("mevModule:", mevModule);
  console.log("devBuyExtension:", devBuyExtension);
  
  // Expected values from ClankerAddresses.sol
  const expected = {
    factory: "0xE85A59c628F7d27878ACeB4bf3b35733630083a9",
    hook: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC",
    locker: "0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0",
    mevModule: "0xE143f9872A33c955F23cF442BB4B1EFB3A7402A2",
    devBuyExtension: "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be",
    weth: "0x4200000000000000000000000000000000000006",
  };
  
  console.log("\n=== Validation ===");
  let allGood = true;
  
  if (factory.toLowerCase() !== expected.factory.toLowerCase()) {
    console.log("❌ Factory WRONG! Expected:", expected.factory);
    allGood = false;
  } else {
    console.log("✅ Factory OK");
  }
  
  if (hook.toLowerCase() !== expected.hook.toLowerCase()) {
    console.log("❌ Hook WRONG! Expected:", expected.hook);
    allGood = false;
  } else {
    console.log("✅ Hook OK");
  }
  
  if (locker.toLowerCase() !== expected.locker.toLowerCase()) {
    console.log("❌ Locker WRONG! Expected:", expected.locker);
    allGood = false;
  } else {
    console.log("✅ Locker OK");
  }
  
  if (mevModule.toLowerCase() !== expected.mevModule.toLowerCase()) {
    console.log("❌ MevModule WRONG! Expected:", expected.mevModule);
    allGood = false;
  } else {
    console.log("✅ MevModule OK");
  }
  
  if (devBuyExtension.toLowerCase() !== expected.devBuyExtension.toLowerCase()) {
    console.log("❌ DevBuyExtension WRONG! Expected:", expected.devBuyExtension);
    allGood = false;
  } else {
    console.log("✅ DevBuyExtension OK");
  }
  
  if (weth.toLowerCase() !== expected.weth.toLowerCase()) {
    console.log("❌ WETH WRONG! Expected:", expected.weth);
    allGood = false;
  } else {
    console.log("✅ WETH OK");
  }
  
  // Check if any are zero address
  console.log("\n=== Zero Address Check ===");
  if (hook === ethers.ZeroAddress) {
    console.log("❌ Hook is ZERO ADDRESS - not initialized!");
    allGood = false;
  }
  if (locker === ethers.ZeroAddress) {
    console.log("❌ Locker is ZERO ADDRESS - not initialized!");
    allGood = false;
  }
  if (mevModule === ethers.ZeroAddress) {
    console.log("❌ MevModule is ZERO ADDRESS - not initialized!");
    allGood = false;
  }
  if (devBuyExtension === ethers.ZeroAddress) {
    console.log("❌ DevBuyExtension is ZERO ADDRESS - not initialized!");
    allGood = false;
  }
  
  // Check cabal 23 specifically
  console.log("\n=== Cabal 23 Status ===");
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND);
  try {
    const cabal = await viewFacet.getCabal(23n);
    console.log("Phase:", cabal.phase);
    console.log("Name:", cabal.name);
    console.log("Symbol:", cabal.symbol);
    console.log("TBA Address:", cabal.tbaAddress);
    console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
    console.log("Launch Approved At:", cabal.launchApprovedAt?.toString() || "Not approved");
    
    // Check TBA balance
    const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
    console.log("TBA ETH Balance:", ethers.formatEther(tbaBalance), "ETH");
    
    // Check if launch is ready
    const creationFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND);
    const voteStatus = await creationFacet.getLaunchVoteStatus(23n);
    console.log("\nLaunch Vote Status:");
    console.log("  Votes For:", ethers.formatEther(voteStatus.votesFor), "ETH");
    console.log("  Votes Against:", ethers.formatEther(voteStatus.votesAgainst), "ETH");
    console.log("  Total Raised:", ethers.formatEther(voteStatus.totalRaised), "ETH");
    console.log("  Majority Required:", ethers.formatEther(voteStatus.majorityRequired), "ETH");
    console.log("  Majority Met:", voteStatus.majorityMet);
    console.log("  Launch Approved At:", voteStatus.launchApprovedAt.toString());
    console.log("  Launchable At:", voteStatus.launchableAt.toString());
    
    const now = Math.floor(Date.now() / 1000);
    if (voteStatus.launchableAt > 0n) {
      const launchableAtNum = Number(voteStatus.launchableAt);
      if (now >= launchableAtNum) {
        console.log("  ✅ READY TO LAUNCH!");
      } else {
        console.log("  ⏳ Time remaining:", Math.ceil((launchableAtNum - now) / 60), "minutes");
      }
    }
  } catch (e: any) {
    console.log("Error fetching cabal:", e.message);
  }
  
  if (allGood) {
    console.log("\n✅ All settings look correct!");
  } else {
    console.log("\n❌ Some settings need to be fixed!");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
