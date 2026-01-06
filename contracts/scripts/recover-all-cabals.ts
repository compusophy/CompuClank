import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Scanning for recoverable ETH from all cabals...");
  console.log("Deployer:", signer.address);
  
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  
  let totalRecovered = 0n;
  
  // Scan cabal IDs 0-30
  console.log("\nScanning cabal IDs 0-30...");
  
  for (let cabalId = 0; cabalId <= 30; cabalId++) {
    try {
      const cabal = await viewFacet.getCabal(cabalId);
      
      if (cabal.tbaAddress !== ethers.ZeroAddress) {
        const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
        
        if (tbaBalance > 0n) {
          console.log(`\nCABAL${cabalId}:`);
          console.log(`  TBA: ${cabal.tbaAddress}`);
          console.log(`  Balance: ${ethers.formatEther(tbaBalance)} ETH`);
          console.log(`  Name: ${cabal.name}`);
          
          // Try to recover
          try {
            console.log(`  Recovering...`);
            const tx = await settingsFacet.recoverETHFromCabal(cabalId, signer.address, tbaBalance);
            await tx.wait();
            console.log(`  ✅ Recovered!`);
            totalRecovered += tbaBalance;
          } catch (e: any) {
            console.log(`  ❌ Failed: ${e.message?.slice(0, 80)}`);
          }
        }
      }
    } catch (e) {
      // Cabal doesn't exist
    }
  }
  
  console.log("\n========================================");
  console.log("Total recovered:", ethers.formatEther(totalRecovered), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
