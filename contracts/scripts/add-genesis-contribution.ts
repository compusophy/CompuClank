import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Contributing more ETH to CABAL0...");
  console.log("Account:", signer.address);
  
  const genesisFacet = await ethers.getContractAt("GenesisFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Get current state
  const cabal = await viewFacet.getCabal(0);
  console.log("Current Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
  
  // Need at least 0.003 ETH total for devBuy to work
  const targetRaised = ethers.parseEther("0.005"); // Target 0.005 ETH total
  const currentRaised = cabal.totalRaised;
  const neededContribution = targetRaised - currentRaised;
  
  if (neededContribution <= 0n) {
    console.log("Already have enough! Total:", ethers.formatEther(currentRaised));
    return;
  }
  
  console.log("Need to contribute:", ethers.formatEther(neededContribution), "ETH");
  
  // Contribute
  const tx = await genesisFacet.contributeToGenesis({ value: neededContribution });
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✅ Contribution successful!");
  
  // Check new state
  const cabalAfter = await viewFacet.getCabal(0);
  console.log("New Total Raised:", ethers.formatEther(cabalAfter.totalRaised), "ETH");
  
  // Calculate devBuy
  const protocolFee = cabalAfter.totalRaised * 100n / 10000n;
  const remaining = cabalAfter.totalRaised - protocolFee;
  const treasuryEth = remaining * 3300n / 9900n;
  const devBuy = remaining - treasuryEth;
  console.log("DevBuy will be:", ethers.formatEther(devBuy), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
