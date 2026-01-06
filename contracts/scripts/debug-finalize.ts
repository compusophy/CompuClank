import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 0n; // CABAL0

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Debugging finalizeCabal for CABAL", CABAL_ID.toString());
  console.log("Diamond:", DIAMOND_ADDRESS);

  // Get contract interfaces
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const creationFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);

  // 1. Check cabal state
  console.log("\n--- Cabal State ---");
  const cabal = await viewFacet.getCabal(CABAL_ID);
  console.log("Phase:", cabal.phase, "(0=Presale, 1=Active)");
  console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
  console.log("TBA Address:", cabal.tbaAddress);
  
  // 2. Check launch vote status
  console.log("\n--- Launch Vote Status ---");
  const voteStatus = await creationFacet.getLaunchVoteStatus(CABAL_ID);
  console.log("Votes For:", ethers.formatEther(voteStatus[0]), "ETH");
  console.log("Votes Against:", ethers.formatEther(voteStatus[1]), "ETH");
  console.log("Total Raised:", ethers.formatEther(voteStatus[2]), "ETH");
  console.log("Majority Required:", ethers.formatEther(voteStatus[3]), "ETH");
  console.log("Majority Met:", voteStatus[4]);
  console.log("Launch Approved At:", voteStatus[5].toString());
  console.log("Launchable At:", voteStatus[6].toString());
  
  const now = Math.floor(Date.now() / 1000);
  console.log("Current Time:", now);
  console.log("Can Launch:", voteStatus[6] > 0n && BigInt(now) >= voteStatus[6]);

  // 3. Check Clanker V4 settings
  console.log("\n--- Clanker V4 Settings ---");
  try {
    const clankerSettings = await settingsFacet.getClankerAddresses();
    console.log("Hook:", clankerSettings[0]);
    console.log("Locker:", clankerSettings[1]);
    console.log("MEV Module:", clankerSettings[2]);
    console.log("DevBuy Extension:", clankerSettings[3]);
  } catch (e: any) {
    console.log("Error getting Clanker addresses:", e.message?.slice(0, 100));
  }

  // 4. Check contract addresses
  console.log("\n--- Contract Addresses ---");
  try {
    const addresses = await settingsFacet.getContractAddresses();
    console.log("CabalNFT:", addresses[0]);
    console.log("TBA Implementation:", addresses[1]);
    console.log("ERC6551 Registry:", addresses[2]);
    console.log("Clanker Factory:", addresses[3]);
    console.log("Clanker Fee Locker:", addresses[4]);
    console.log("WETH:", addresses[5]);
  } catch (e: any) {
    console.log("Error getting contract addresses:", e.message?.slice(0, 100));
  }

  // 5. Check TBA balance
  console.log("\n--- TBA Balance ---");
  const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
  console.log("TBA ETH Balance:", ethers.formatEther(tbaBalance), "ETH");

  // 6. Simulate finalize
  console.log("\n--- Simulating finalizeCabal ---");
  try {
    await creationFacet.finalizeCabal.staticCall(CABAL_ID);
    console.log("✅ Simulation SUCCESS - finalizeCabal would work");
  } catch (e: any) {
    console.log("❌ Simulation FAILED:");
    console.log("  Message:", e.message?.slice(0, 200));
    if (e.data) {
      console.log("  Error data:", e.data);
      // Try to decode
      try {
        const iface = creationFacet.interface;
        const decoded = iface.parseError(e.data);
        console.log("  Decoded error:", decoded?.name, decoded?.args);
      } catch {
        // Try as string
        if (e.data.startsWith("0x08c379a0")) {
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + e.data.slice(10));
          console.log("  String error:", reason[0]);
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
