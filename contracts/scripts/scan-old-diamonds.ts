import { ethers } from "hardhat";

// Old diamond addresses from previous deployments
const OLD_DIAMONDS = [
  "0x2c37109E089a274fD3e7029a4F379558d44937e3",
  "0xb3cDf23Ae53683176eB6FDAd0b613E349FEcb6a8",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Scanning old diamonds for recoverable ETH...");
  console.log("Deployer:", signer.address);
  
  for (const diamondAddress of OLD_DIAMONDS) {
    console.log("\n========================================");
    console.log("Diamond:", diamondAddress);
    
    // Check if diamond has code
    const code = await ethers.provider.getCode(diamondAddress);
    if (code === "0x") {
      console.log("  No code at this address");
      continue;
    }
    console.log("  Has code, length:", code.length);
    
    try {
      const viewFacet = await ethers.getContractAt("ViewFacet", diamondAddress);
      const settingsFacet = await ethers.getContractAt("SettingsFacet", diamondAddress);
      
      // Scan cabal IDs 0-30
      console.log("\n  Scanning cabal IDs 0-30...");
      
      for (let cabalId = 0; cabalId <= 30; cabalId++) {
        try {
          const cabal = await viewFacet.getCabal(cabalId);
          
          if (cabal.tbaAddress !== ethers.ZeroAddress) {
            const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
            
            console.log(`  CABAL${cabalId}: TBA=${cabal.tbaAddress.slice(0,10)}... Balance=${ethers.formatEther(tbaBalance)} ETH`);
            
            if (tbaBalance > 0n) {
              console.log(`    -> HAS FUNDS! Attempting recovery...`);
              try {
                const tx = await settingsFacet.recoverETHFromCabal(cabalId, signer.address, tbaBalance);
                await tx.wait();
                console.log(`    ✅ Recovered ${ethers.formatEther(tbaBalance)} ETH!`);
              } catch (e: any) {
                console.log(`    ❌ Recovery failed: ${e.message?.slice(0, 100)}`);
              }
            }
          }
        } catch (e) {
          // Cabal doesn't exist
        }
      }
    } catch (e: any) {
      console.log("  Error:", e.message?.slice(0, 100));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
