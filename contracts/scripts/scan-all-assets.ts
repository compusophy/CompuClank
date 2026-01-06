import { ethers } from "hardhat";

/**
 * DRY RUN: Scan all old development cabals for recoverable assets
 * 
 * This script ONLY READS - no transactions are executed.
 * Use this to see what's available before running recover-all-assets.ts
 */

// All diamond addresses from development
const DIAMOND_ADDRESSES = [
  "0x2c37109E089a274fD3e7029a4F379558d44937e3", // OLD
  "0xb3cDf23Ae53683176eB6FDAd0b613E349FEcb6a8", // OLD2
  "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9", // CURRENT
];

// Base WETH address
const WETH = "0x4200000000000000000000000000000000000006";

// Current production diamond (skip CABAL0 on this one)
const CURRENT_DIAMOND = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// ABIs
const VIEW_ABI = [
  "function getCabal(uint256 cabalId) view returns (tuple(address creator, string name, string symbol, string image, address tbaAddress, address tokenAddress, uint8 phase, uint256 totalRaised, uint256 totalTokensReceived, uint256 totalStaked, uint256 createdAt, uint256 launchedAt, uint256 parentCabalId, uint256 launchApprovedAt, tuple(uint256 votingPeriod, uint256 quorumBps, uint256 majorityBps, uint256 proposalThreshold) settings, address[] contributors))",
  "function isGenesisInitialized() view returns (bool)",
  "function getCabalCount() view returns (uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=" .repeat(70));
  console.log("ASSET SCAN (DRY RUN - NO TRANSACTIONS)");
  console.log("=" .repeat(70));
  console.log("Deployer:", signer.address);
  console.log("WETH:", WETH);
  console.log("");

  const wethContract = new ethers.Contract(WETH, ERC20_ABI, signer);
  
  let totalEth = 0n;
  let totalWeth = 0n;
  let totalTokens: { [symbol: string]: bigint } = {};
  let cabalCount = 0;

  for (const diamondAddress of DIAMOND_ADDRESSES) {
    console.log("\n" + "=".repeat(70));
    console.log("DIAMOND:", diamondAddress);
    console.log(diamondAddress === CURRENT_DIAMOND ? "(CURRENT - will skip CABAL0)" : "(OLD)");
    console.log("=".repeat(70));

    // Check if diamond has code
    const code = await ethers.provider.getCode(diamondAddress);
    if (code === "0x") {
      console.log("  ❌ No code at this address");
      continue;
    }

    const viewFacet = new ethers.Contract(diamondAddress, VIEW_ABI, signer);

    // Check if genesis initialized
    let isInitialized = false;
    try {
      isInitialized = await viewFacet.isGenesisInitialized();
    } catch {
      console.log("  ⚠️ Could not check genesis state");
    }
    console.log("  Genesis Initialized:", isInitialized);

    // Get cabal count if available
    let maxCabalId = 30;
    try {
      const count = await viewFacet.getCabalCount();
      maxCabalId = Number(count) + 5;
      console.log("  Cabal Count:", count.toString());
    } catch {
      console.log("  Cabal count not available, scanning 0-30");
    }

    console.log("");

    for (let i = 0; i <= maxCabalId; i++) {
      // Skip CABAL0 on current diamond
      if (diamondAddress === CURRENT_DIAMOND && i === 0) {
        console.log(`  CABAL0: 🛡️ SKIPPING (production cabal)`);
        continue;
      }

      try {
        const cabal = await viewFacet.getCabal(i);
        if (cabal.tbaAddress && cabal.tbaAddress !== ethers.ZeroAddress) {
          const ethBalance = await ethers.provider.getBalance(cabal.tbaAddress);
          const wethBalance = await wethContract.balanceOf(cabal.tbaAddress);
          
          let tokenBalance = 0n;
          let symbol = "UNKNOWN";
          if (cabal.tokenAddress && cabal.tokenAddress !== ethers.ZeroAddress) {
            try {
              const tokenContract = new ethers.Contract(cabal.tokenAddress, ERC20_ABI, signer);
              tokenBalance = await tokenContract.balanceOf(cabal.tba);
              symbol = await tokenContract.symbol();
            } catch {
              // Try using TBA address correctly
              try {
                const tokenContract = new ethers.Contract(cabal.tokenAddress, ERC20_ABI, signer);
                tokenBalance = await tokenContract.balanceOf(cabal.tbaAddress);
                symbol = await tokenContract.symbol();
              } catch {
                symbol = "ERROR";
              }
            }
          }

          const phaseNames = ["Presale", "Active", "Paused", "Closed"];
          const phaseName = phaseNames[cabal.phase] || `Phase${cabal.phase}`;
          
          const hasAssets = ethBalance > 0n || wethBalance > 0n || tokenBalance > 0n;
          
          if (hasAssets) {
            cabalCount++;
            console.log(`  CABAL${i} (${symbol}) - ${phaseName}`);
            console.log(`    TBA: ${cabal.tbaAddress}`);
            console.log(`    Token: ${cabal.tokenAddress}`);
            if (ethBalance > 0n) {
              console.log(`    💰 ETH:  ${ethers.formatEther(ethBalance)}`);
              totalEth += ethBalance;
            }
            if (wethBalance > 0n) {
              console.log(`    💵 WETH: ${ethers.formatEther(wethBalance)}`);
              totalWeth += wethBalance;
            }
            if (tokenBalance > 0n) {
              console.log(`    🏛️ ${symbol}: ${ethers.formatEther(tokenBalance)}`);
              totalTokens[symbol] = (totalTokens[symbol] || 0n) + tokenBalance;
            }
            console.log("");
          }
        }
      } catch {
        // Cabal doesn't exist
      }
    }
  }

  // ============ SUMMARY ============
  console.log("\n" + "=".repeat(70));
  console.log("SCAN SUMMARY");
  console.log("=".repeat(70));
  console.log(`Cabals with assets: ${cabalCount}`);
  console.log("");
  console.log(`Total ETH:  ${ethers.formatEther(totalEth)} ETH`);
  console.log(`Total WETH: ${ethers.formatEther(totalWeth)} WETH`);
  
  if (Object.keys(totalTokens).length > 0) {
    console.log("\nGovernance Tokens:");
    for (const [symbol, amount] of Object.entries(totalTokens)) {
      console.log(`  ${symbol}: ${ethers.formatEther(amount)}`);
    }
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("NOTE: LP fees have NOT been claimed yet.");
  console.log("After claiming LP fees, WETH balances will likely increase.");
  console.log("Run: npx hardhat run scripts/recover-all-assets.ts --network base");
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
