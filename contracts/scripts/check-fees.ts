import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

interface CabalFeeInfo {
  cabalId: number;
  name: string;
  symbol: string;
  tokenAddress: string;
  tbaAddress: string;
  phase: number;
  fees: {
    token: string;
    amount: string;
    amountEth: number;
  }[];
  totalFeesEth: number;
}

const FEE_LOCKER_ABI = [
  {
    inputs: [
      { internalType: "address", name: "feeOwner", type: "address" },
      { internalType: "address", name: "token", type: "address" },
    ],
    name: "availableFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

async function main() {
  console.log("🔍 Checking available fees for all active cabals...\n");

  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);

  // Fetch Fee Locker address from Diamond
  let feeLockerAddress: string;
  try {
    const addresses = await settingsFacet.getContractAddresses();
    feeLockerAddress = addresses.clankerFeeLocker;
    console.log(`✅ Fee Locker Address (from Diamond): ${feeLockerAddress}\n`);
  } catch (error: any) {
    console.error("❌ Failed to fetch Fee Locker address from Diamond:", error.message);
    process.exit(1);
  }

  if (feeLockerAddress === ethers.ZeroAddress) {
    console.error(
      "❌ Fee Locker address not initialized in Diamond. Please initialize it first."
    );
    process.exit(1);
  }

  const feeLocker = new ethers.Contract(feeLockerAddress, FEE_LOCKER_ABI, ethers.provider);

  const cabalsWithFees: CabalFeeInfo[] = [];
  let totalFees = 0n;
  let cabalCount = 0;

  // Check cabals 0-99 (adjust as needed)
  for (let i = 0; i <= 99; i++) {
    try {
      const cabal = await viewFacet.getCabal(i);

      // Skip presale cabals or those without tokens
      if (cabal.phase !== 1n || cabal.tokenAddress === ethers.ZeroAddress) {
        continue;
      }

      cabalCount++;
      const cabalInfo: CabalFeeInfo = {
        cabalId: i,
        name: cabal.name,
        symbol: cabal.symbol,
        tokenAddress: cabal.tokenAddress,
        tbaAddress: cabal.tbaAddress,
        phase: Number(cabal.phase),
        fees: [],
        totalFeesEth: 0,
      };

      // Check WETH fees (most common)
      try {
        const wethAddress = "0x4200000000000000000000000000000000000006"; // Base WETH
        const availableWeth = await feeLocker.availableFees(cabal.tbaAddress, wethAddress);

        if (availableWeth > 0n) {
          const wethEth = parseFloat(ethers.formatEther(availableWeth));
          cabalInfo.fees.push({
            token: "WETH",
            amount: availableWeth.toString(),
            amountEth: wethEth,
          });
          cabalInfo.totalFeesEth += wethEth;
          totalFees += availableWeth;
        }
      } catch (e) {
        // WETH check failed, continue
      }

      // Check USD+ fees if available
      try {
        const usdPlusAddress = "0xB6fe221d63c969236e86970d3f653f9355a9f97e"; // Base USD+
        const availableUsdPlus = await feeLocker.availableFees(cabal.tbaAddress, usdPlusAddress);

        if (availableUsdPlus > 0n) {
          const usdPlusEth = parseFloat(ethers.formatEther(availableUsdPlus));
          cabalInfo.fees.push({
            token: "USD+",
            amount: availableUsdPlus.toString(),
            amountEth: usdPlusEth,
          });
          cabalInfo.totalFeesEth += usdPlusEth;
        }
      } catch (e) {
        // USD+ check failed, continue
      }

      // Only include cabals with claimable fees
      if (cabalInfo.fees.length > 0) {
        cabalsWithFees.push(cabalInfo);
      }
    } catch (e: any) {
      // Cabal doesn't exist or error reading, continue
      if (!e.message.includes("out of range")) {
        // Only log unexpected errors
      }
    }
  }

  // Display results
  console.log(`✅ Scanned ${cabalCount} active cabals\n`);

  if (cabalsWithFees.length === 0) {
    console.log("📭 No cabals with claimable fees found.\n");
    return;
  }

  console.log(`💰 Found ${cabalsWithFees.length} cabal(s) with claimable fees:\n`);
  console.log("=" + "=".repeat(99));

  for (const cabal of cabalsWithFees) {
    console.log(`\n📍 CABAL${cabal.cabalId}: ${cabal.name} (${cabal.symbol})`);
    console.log(`   Token: ${cabal.tokenAddress}`);
    console.log(`   TBA: ${cabal.tbaAddress}`);

    for (const fee of cabal.fees) {
      console.log(`   💵 ${fee.token}: ${fee.amountEth.toFixed(6)} ETH (${fee.amount})`);
    }

    console.log(`   📊 Total claimable: ${cabal.totalFeesEth.toFixed(6)} ETH`);
  }

  console.log("\n" + "=".repeat(100));
  console.log(`\n🎯 Total fees available to claim: ${ethers.formatEther(totalFees)} ETH`);
  console.log(`📦 Cabals eligible for claiming: ${cabalsWithFees.length}\n`);

  // Export for use by claim script
  console.log("📋 For claiming, use: npm run claim-all-fees");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
