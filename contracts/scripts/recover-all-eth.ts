import { ethers } from "hardhat";

// All diamond addresses from development
const DIAMOND_ADDRESSES = [
  "0x2c37109E089a274fD3e7029a4F379558d44937e3", // OLD
  "0xb3cDf23Ae53683176eB6FDAd0b613E349FEcb6a8", // OLD2
  "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9", // CURRENT
];

// Simple ABI for what we need
const VIEW_ABI = [
  "function getCabal(uint256 cabalId) view returns (tuple(address creator, string name, string symbol, string image, address tbaAddress, address tokenAddress, uint8 phase, uint256 totalRaised, uint256 totalTokensReceived, uint256 totalStaked, uint256 createdAt, uint256 launchedAt, uint256 parentCabalId, uint256 launchApprovedAt, tuple(uint256 votingPeriod, uint256 quorumBps, uint256 majorityBps, uint256 proposalThreshold) settings, address[] contributors))",
  "function isGenesisInitialized() view returns (bool)",
];

const SETTINGS_ABI = [
  "function recoverETHFromCabal(uint256 cabalId, address recipient, uint256 amount) external",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Scanning all diamonds for recoverable ETH...");
  console.log("Deployer:", signer.address);
  
  let totalRecovered = 0n;
  
  for (const diamondAddress of DIAMOND_ADDRESSES) {
    console.log("\n" + "=".repeat(60));
    console.log("Diamond:", diamondAddress);
    
    // Check if diamond has code
    const code = await ethers.provider.getCode(diamondAddress);
    if (code === "0x") {
      console.log("  ❌ No code at this address");
      continue;
    }
    
    const viewFacet = new ethers.Contract(diamondAddress, VIEW_ABI, signer);
    const settingsFacet = new ethers.Contract(diamondAddress, SETTINGS_ABI, signer);
    
    // Check if genesis initialized
    let isInitialized = false;
    try {
      isInitialized = await viewFacet.isGenesisInitialized();
    } catch (e) {
      console.log("  ⚠️ Could not check genesis state");
    }
    console.log("  Genesis Initialized:", isInitialized);
    
    // Scan for cabals (try IDs 0-30)
    const cabalsWithBalance: { id: number; tba: string; balance: bigint }[] = [];
    
    for (let i = 0; i <= 30; i++) {
      try {
        const cabal = await viewFacet.getCabal(i);
        if (cabal.tbaAddress && cabal.tbaAddress !== ethers.ZeroAddress) {
          const balance = await ethers.provider.getBalance(cabal.tbaAddress);
          if (balance > 0n) {
            cabalsWithBalance.push({ id: i, tba: cabal.tbaAddress, balance });
            console.log(`  CABAL${i}: ${cabal.tbaAddress} = ${ethers.formatEther(balance)} ETH`);
          }
        }
      } catch (e) {
        // Cabal doesn't exist, skip
      }
    }
    
    if (cabalsWithBalance.length === 0) {
      console.log("  No cabals with ETH found");
      continue;
    }
    
    console.log(`\n  Found ${cabalsWithBalance.length} cabals with ETH`);
    
    // Try to recover
    for (const cabal of cabalsWithBalance) {
      console.log(`\n  Recovering from CABAL${cabal.id}...`);
      try {
        const tx = await settingsFacet.recoverETHFromCabal(cabal.id, signer.address, cabal.balance);
        console.log(`    TX: ${tx.hash}`);
        await tx.wait();
        console.log(`    ✅ Recovered ${ethers.formatEther(cabal.balance)} ETH`);
        totalRecovered += cabal.balance;
      } catch (e: any) {
        console.log(`    ❌ Failed: ${e.message?.slice(0, 100)}`);
        
        // If recoverETHFromCabal doesn't exist, try direct TBA call
        // (only works if we own the NFT)
        console.log(`    Trying direct TBA recovery...`);
        try {
          const tbaNFT = new ethers.Contract(cabal.tba, [
            "function executeCall(address to, uint256 value, bytes data) payable returns (bytes)",
            "function owner() view returns (address)",
          ], signer);
          
          // Check owner
          const owner = await tbaNFT.owner();
          console.log(`    TBA owner: ${owner}`);
          console.log(`    Diamond: ${diamondAddress}`);
          
          if (owner.toLowerCase() === diamondAddress.toLowerCase()) {
            console.log(`    TBA owned by diamond - need recoverETHFromCabal function`);
          }
        } catch (e2: any) {
          console.log(`    ❌ Direct recovery also failed: ${e2.message?.slice(0, 80)}`);
        }
      }
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("Total Recovered:", ethers.formatEther(totalRecovered), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
