import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 0n;
const WETH = "0x4200000000000000000000000000000000000006";
const RECIPIENT = "0xDcAa03A2Ff649B233946E6d9960f98D67fAf802B";
const AMOUNT_TO_RECOVER = ethers.parseEther("0.2"); // 0.2 WETH

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Recovering 0.2 WETH from CABAL0...");
  console.log("Deployer:", signer.address);
  console.log("Recipient:", RECIPIENT);
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const weth = await ethers.getContractAt("IERC20", WETH);
  
  // Check current balance
  const cabal = await viewFacet.getCabal(CABAL_ID);
  const wethBalance = await weth.balanceOf(cabal.tbaAddress);
  console.log("\nCABAL0 TBA:", cabal.tbaAddress);
  console.log("TBA WETH Balance:", ethers.formatEther(wethBalance), "WETH");
  
  if (wethBalance < AMOUNT_TO_RECOVER) {
    console.log("Not enough WETH! Need 0.2 but only have", ethers.formatEther(wethBalance));
    return;
  }
  
  // Get recipient balance before
  const recipientBalanceBefore = await weth.balanceOf(RECIPIENT);
  console.log("\nRecipient WETH balance before:", ethers.formatEther(recipientBalanceBefore), "WETH");
  
  // Recover 0.2 WETH
  console.log("\nRecovering 0.2 WETH to", RECIPIENT, "...");
  const tx = await settingsFacet.recoverTokensFromCabal(CABAL_ID, WETH, RECIPIENT, AMOUNT_TO_RECOVER);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("✅ Recovery complete!");
  
  // Check balances after
  const wethBalanceAfter = await weth.balanceOf(cabal.tbaAddress);
  const recipientBalanceAfter = await weth.balanceOf(RECIPIENT);
  console.log("\nTBA WETH Balance after:", ethers.formatEther(wethBalanceAfter), "WETH");
  console.log("Recipient WETH balance after:", ethers.formatEther(recipientBalanceAfter), "WETH");
  console.log("Recovered:", ethers.formatEther(recipientBalanceAfter - recipientBalanceBefore), "WETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
