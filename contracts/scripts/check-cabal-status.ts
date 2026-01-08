import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Use the compiled artifacts for correct ABI
  const ViewFacet = await ethers.getContractFactory("ViewFacet");
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  
  const viewFacet = ViewFacet.attach(DIAMOND_ADDRESS);
  const cabalCreationFacet = CabalCreationFacet.attach(DIAMOND_ADDRESS);

  console.log("=== CABAL0 Status ===");
  const cabal0 = await viewFacet.getCabal(0);
  console.log("Phase:", cabal0.phase, "(0=Presale, 1=Active, 2=Dissolved)");
  console.log("Total Raised:", ethers.formatEther(cabal0.totalRaised), "ETH");
  console.log("Token Address:", cabal0.tokenAddress);
  
  console.log("\n=== CABAL1 Status ===");
  const cabal1 = await viewFacet.getCabal(1);
  console.log("Phase:", cabal1.phase, "(0=Presale, 1=Active, 2=Dissolved)");
  console.log("Total Raised:", ethers.formatEther(cabal1.totalRaised), "ETH");
  console.log("Token Address:", cabal1.tokenAddress);
  
  console.log("\n=== CABAL1 Launch Vote Status ===");
  const voteStatus = await cabalCreationFacet.getLaunchVoteStatus(1);
  console.log("Votes For:", ethers.formatEther(voteStatus.votesFor), "ETH");
  console.log("Votes Against:", ethers.formatEther(voteStatus.votesAgainst), "ETH");
  console.log("Total Raised:", ethers.formatEther(voteStatus.totalRaised), "ETH");
  console.log("Majority Required:", ethers.formatEther(voteStatus.majorityRequired), "ETH");
  console.log("Majority Met:", voteStatus.majorityMet);
  console.log("Launch Approved At:", voteStatus.launchApprovedAt.toString());
  console.log("Launchable At:", voteStatus.launchableAt.toString());
  
  const now = Math.floor(Date.now() / 1000);
  console.log("\nCurrent timestamp:", now);
  if (voteStatus.launchableAt > 0) {
    const remaining = Number(voteStatus.launchableAt) - now;
    console.log("Time remaining:", remaining > 0 ? `${Math.ceil(remaining / 60)} minutes` : "READY TO FINALIZE");
  }
  
  // Check MIN_LAUNCH_AMOUNT
  const MIN_LAUNCH_AMOUNT = ethers.parseEther("0.001");
  console.log("\nMIN_LAUNCH_AMOUNT:", ethers.formatEther(MIN_LAUNCH_AMOUNT), "ETH");
  console.log("Has enough for launch:", cabal1.totalRaised >= MIN_LAUNCH_AMOUNT);
  
  // Check TBA balance
  console.log("\n=== CABAL1 TBA Status ===");
  console.log("TBA Address:", cabal1.tbaAddress);
  const tbaBalance = await ethers.provider.getBalance(cabal1.tbaAddress);
  console.log("TBA ETH Balance:", ethers.formatEther(tbaBalance), "ETH");
  
  // Simulate the split calculation
  const totalRaised = cabal1.totalRaised;
  const protocolFee = (totalRaised * 100n) / 10000n;  // 1%
  const remaining = totalRaised - protocolFee;
  const treasuryEth = (remaining * 3300n) / 9900n;  // 33% of remaining
  const devBuyAmount = remaining - treasuryEth;
  
  console.log("\n=== Launch Split Calculation ===");
  console.log("Total Raised:", ethers.formatEther(totalRaised), "ETH");
  console.log("Protocol Fee (1%):", ethers.formatEther(protocolFee), "ETH");
  console.log("Treasury ETH (33%):", ethers.formatEther(treasuryEth), "ETH");
  console.log("Dev Buy Amount (66%):", ethers.formatEther(devBuyAmount), "ETH");
  console.log("TBA has enough:", tbaBalance >= totalRaised);
  
  // Check Clanker settings
  const SettingsFacet = await ethers.getContractFactory("SettingsFacet");
  const settingsFacet = SettingsFacet.attach(DIAMOND_ADDRESS);
  
  console.log("\n=== Clanker Settings ===");
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  console.log("Hook:", hook);
  console.log("Locker:", locker);
  console.log("Mev Module:", mevModule);
  console.log("Dev Buy Extension:", devBuyExtension);
  console.log("Dev Buy Extension Set:", devBuyExtension !== ethers.ZeroAddress);
  
  // Check protocol treasury info
  console.log("\n=== Protocol Info ===");
  const protocolTreasury = await viewFacet.getProtocolTreasury();
  console.log("Protocol Treasury (CABAL0 TBA):", protocolTreasury);
  console.log("CABAL1 TBA:", cabal1.tbaAddress);
  console.log("Is CABAL1 the protocol treasury?", cabal1.tbaAddress === protocolTreasury);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
