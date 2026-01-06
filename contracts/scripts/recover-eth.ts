import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 0n;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Recovering ETH from CABAL0...");
  console.log("Deployer:", signer.address);
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Check current balance
  const cabal = await viewFacet.getCabal(CABAL_ID);
  const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
  console.log("\nCABAL0 TBA:", cabal.tbaAddress);
  console.log("TBA Balance:", ethers.formatEther(tbaBalance), "ETH");
  
  if (tbaBalance === 0n) {
    console.log("No ETH to recover!");
    return;
  }
  
  // Get deployer balance before
  const balanceBefore = await ethers.provider.getBalance(signer.address);
  console.log("\nDeployer balance before:", ethers.formatEther(balanceBefore), "ETH");
  
  // Recover all ETH
  console.log("\nRecovering", ethers.formatEther(tbaBalance), "ETH...");
  const tx = await settingsFacet.recoverETHFromCabal(CABAL_ID, signer.address, tbaBalance);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✅ Recovery complete!");
  
  // Check balances after
  const tbaBalanceAfter = await ethers.provider.getBalance(cabal.tbaAddress);
  const balanceAfter = await ethers.provider.getBalance(signer.address);
  console.log("\nTBA Balance after:", ethers.formatEther(tbaBalanceAfter), "ETH");
  console.log("Deployer balance after:", ethers.formatEther(balanceAfter), "ETH");
  console.log("Recovered:", ethers.formatEther(balanceAfter - balanceBefore), "ETH (minus gas)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
