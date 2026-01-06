import { ethers } from "hardhat";

/**
 * Comprehensive recovery script for all old development cabals
 * 
 * This script:
 * 1. Scans all old diamond addresses for cabals
 * 2. Claims LP fees for each cabal (converts to WETH)
 * 3. Checks and recovers WETH from each TBA
 * 4. Checks and recovers governance tokens from each TBA
 * 5. Recovers any remaining ETH
 * 
 * EXCLUDES: Current production CABAL0 (cabal ID 0 on current diamond)
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

const TREASURY_ABI = [
  "function claimLPFees(uint256 cabalId, address token) external",
];

const SETTINGS_ABI = [
  "function recoverETHFromCabal(uint256 cabalId, address recipient, uint256 amount) external",
  "function recoverTokensFromCabal(uint256 cabalId, address token, address recipient, uint256 amount) external",
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

interface CabalInfo {
  id: number;
  tba: string;
  tokenAddress: string;
  symbol: string;
  phase: number;
  ethBalance: bigint;
  wethBalance: bigint;
  tokenBalance: bigint;
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("=" .repeat(70));
  console.log("COMPREHENSIVE ASSET RECOVERY SCRIPT");
  console.log("=" .repeat(70));
  console.log("Deployer:", signer.address);
  console.log("WETH:", WETH);
  console.log("");

  const wethContract = new ethers.Contract(WETH, ERC20_ABI, signer);
  
  let totalEthRecovered = 0n;
  let totalWethRecovered = 0n;
  let totalTokensRecovered: { [symbol: string]: bigint } = {};

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
    const treasuryFacet = new ethers.Contract(diamondAddress, TREASURY_ABI, signer);
    const settingsFacet = new ethers.Contract(diamondAddress, SETTINGS_ABI, signer);

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
      maxCabalId = Number(count) + 5; // Add buffer
      console.log("  Cabal Count:", count.toString());
    } catch {
      console.log("  Cabal count not available, scanning 0-30");
    }

    // ============ PHASE 1: Scan all cabals ============
    console.log("\n  📊 PHASE 1: Scanning cabals...");
    const cabals: CabalInfo[] = [];

    for (let i = 0; i <= maxCabalId; i++) {
      // Skip CABAL0 on current diamond
      if (diamondAddress === CURRENT_DIAMOND && i === 0) {
        console.log(`    CABAL0: Skipping (production cabal)`);
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
              tokenBalance = await tokenContract.balanceOf(cabal.tbaAddress);
              symbol = await tokenContract.symbol();
            } catch {
              symbol = "ERROR";
            }
          }

          const info: CabalInfo = {
            id: i,
            tba: cabal.tbaAddress,
            tokenAddress: cabal.tokenAddress,
            symbol,
            phase: cabal.phase,
            ethBalance,
            wethBalance,
            tokenBalance,
          };
          
          cabals.push(info);
          
          const hasAssets = ethBalance > 0n || wethBalance > 0n || tokenBalance > 0n;
          if (hasAssets) {
            console.log(`    CABAL${i} (${symbol}): Phase ${cabal.phase}`);
            console.log(`      TBA: ${cabal.tbaAddress}`);
            if (ethBalance > 0n) console.log(`      ETH: ${ethers.formatEther(ethBalance)}`);
            if (wethBalance > 0n) console.log(`      WETH: ${ethers.formatEther(wethBalance)}`);
            if (tokenBalance > 0n) console.log(`      ${symbol}: ${ethers.formatEther(tokenBalance)}`);
          }
        }
      } catch {
        // Cabal doesn't exist
      }
    }

    if (cabals.length === 0) {
      console.log("    No cabals found");
      continue;
    }

    console.log(`\n  Found ${cabals.length} cabals`);

    // ============ PHASE 2: Claim LP Fees ============
    console.log("\n  💰 PHASE 2: Claiming LP fees...");
    for (const cabal of cabals) {
      if (cabal.tokenAddress && cabal.tokenAddress !== ethers.ZeroAddress) {
        try {
          console.log(`    CABAL${cabal.id}: Claiming LP fees for ${cabal.symbol}...`);
          const tx = await treasuryFacet.claimLPFees(cabal.id, cabal.tokenAddress);
          console.log(`      TX: ${tx.hash}`);
          await tx.wait();
          console.log(`      ✅ LP fees claimed`);
        } catch (e: any) {
          const msg = e.message || "";
          if (msg.includes("no fees") || msg.includes("zero")) {
            console.log(`      ℹ️ No LP fees to claim`);
          } else {
            console.log(`      ❌ Failed: ${msg.slice(0, 80)}`);
          }
        }
      }
    }

    // ============ PHASE 3: Re-scan WETH balances after claiming ============
    console.log("\n  🔄 PHASE 3: Re-scanning balances after LP claim...");
    for (const cabal of cabals) {
      cabal.wethBalance = await wethContract.balanceOf(cabal.tba);
      cabal.ethBalance = await ethers.provider.getBalance(cabal.tba);
      if (cabal.tokenAddress && cabal.tokenAddress !== ethers.ZeroAddress) {
        try {
          const tokenContract = new ethers.Contract(cabal.tokenAddress, ERC20_ABI, signer);
          cabal.tokenBalance = await tokenContract.balanceOf(cabal.tba);
        } catch {}
      }
    }

    // ============ PHASE 4: Recover WETH ============
    console.log("\n  💵 PHASE 4: Recovering WETH...");
    for (const cabal of cabals) {
      if (cabal.wethBalance > 0n) {
        console.log(`    CABAL${cabal.id}: ${ethers.formatEther(cabal.wethBalance)} WETH`);
        try {
          const tx = await settingsFacet.recoverTokensFromCabal(
            cabal.id,
            WETH,
            signer.address,
            cabal.wethBalance
          );
          console.log(`      TX: ${tx.hash}`);
          await tx.wait();
          console.log(`      ✅ Recovered ${ethers.formatEther(cabal.wethBalance)} WETH`);
          totalWethRecovered += cabal.wethBalance;
        } catch (e: any) {
          console.log(`      ❌ Failed: ${e.message?.slice(0, 80)}`);
        }
      }
    }

    // ============ PHASE 5: Recover Governance Tokens ============
    console.log("\n  🏛️ PHASE 5: Recovering governance tokens...");
    for (const cabal of cabals) {
      if (cabal.tokenBalance > 0n && cabal.tokenAddress !== ethers.ZeroAddress) {
        console.log(`    CABAL${cabal.id}: ${ethers.formatEther(cabal.tokenBalance)} ${cabal.symbol}`);
        try {
          const tx = await settingsFacet.recoverTokensFromCabal(
            cabal.id,
            cabal.tokenAddress,
            signer.address,
            cabal.tokenBalance
          );
          console.log(`      TX: ${tx.hash}`);
          await tx.wait();
          console.log(`      ✅ Recovered ${ethers.formatEther(cabal.tokenBalance)} ${cabal.symbol}`);
          totalTokensRecovered[cabal.symbol] = (totalTokensRecovered[cabal.symbol] || 0n) + cabal.tokenBalance;
        } catch (e: any) {
          console.log(`      ❌ Failed: ${e.message?.slice(0, 80)}`);
        }
      }
    }

    // ============ PHASE 6: Recover ETH ============
    console.log("\n  ⛽ PHASE 6: Recovering ETH...");
    for (const cabal of cabals) {
      // Re-check ETH balance (might have changed after other operations)
      const currentEthBalance = await ethers.provider.getBalance(cabal.tba);
      if (currentEthBalance > 0n) {
        console.log(`    CABAL${cabal.id}: ${ethers.formatEther(currentEthBalance)} ETH`);
        try {
          const tx = await settingsFacet.recoverETHFromCabal(
            cabal.id,
            signer.address,
            currentEthBalance
          );
          console.log(`      TX: ${tx.hash}`);
          await tx.wait();
          console.log(`      ✅ Recovered ${ethers.formatEther(currentEthBalance)} ETH`);
          totalEthRecovered += currentEthBalance;
        } catch (e: any) {
          console.log(`      ❌ Failed: ${e.message?.slice(0, 80)}`);
        }
      }
    }
  }

  // ============ FINAL SUMMARY ============
  console.log("\n" + "=".repeat(70));
  console.log("RECOVERY SUMMARY");
  console.log("=".repeat(70));
  console.log(`ETH Recovered:  ${ethers.formatEther(totalEthRecovered)} ETH`);
  console.log(`WETH Recovered: ${ethers.formatEther(totalWethRecovered)} WETH`);
  
  if (Object.keys(totalTokensRecovered).length > 0) {
    console.log("Tokens Recovered:");
    for (const [symbol, amount] of Object.entries(totalTokensRecovered)) {
      console.log(`  ${symbol}: ${ethers.formatEther(amount)}`);
    }
  }
  
  console.log("=".repeat(70));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
