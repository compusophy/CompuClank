import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Reading CABAL3 data through CabalCreationFacet...\n");
  
  const cabalFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  
  // Try to read vote status (which reads CabalData)
  console.log("=== getLaunchVoteStatus(3) ===");
  try {
    const status = await cabalFacet.getLaunchVoteStatus(3);
    console.log("Votes For:", ethers.formatEther(status[0]));
    console.log("Votes Against:", ethers.formatEther(status[1]));
    console.log("Total Raised:", ethers.formatEther(status[2]));
    console.log("Majority Met:", status[4]);
    console.log("Launch Approved At:", status[5].toString());
    console.log("Launchable At:", status[6].toString());
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }
  
  // Try to read contributors
  console.log("\n=== getContributors(3) ===");
  try {
    const contributors = await cabalFacet.getContributors(3);
    console.log("Contributors:", contributors.length);
    for (const c of contributors) {
      console.log("  -", c);
    }
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }
  
  // Check if finalizeCabal preconditions pass
  console.log("\n=== Checking finalizeCabal preconditions ===");
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  try {
    const cabal = await viewFacet.getCabal(3);
    console.log("Phase:", cabal.phase === 0n ? "Presale (0)" : "Active (1)");
    
    const status = await cabalFacet.getLaunchVoteStatus(3);
    const launchApprovedAt = status[5];
    console.log("Launch Approved At:", launchApprovedAt.toString());
    console.log("Launch Approved:", launchApprovedAt > 0n);
    
    const LAUNCH_DELAY = 600n; // 10 minutes
    const now = BigInt(Math.floor(Date.now() / 1000));
    console.log("Current Time:", now.toString());
    console.log("Timer Elapsed:", now >= launchApprovedAt + LAUNCH_DELAY);
    
    const MIN_LAUNCH = ethers.parseEther("0.001");
    console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
    console.log("Min Required:", ethers.formatEther(MIN_LAUNCH), "ETH");
    console.log("Has Enough:", cabal.totalRaised >= MIN_LAUNCH);
  } catch (e: any) {
    console.log("ERROR:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
