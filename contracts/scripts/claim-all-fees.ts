import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

interface CabalFeeInfo {
  cabalId: number;
  name: string;
  symbol: string;
  tokenAddress: string;
  tbaAddress: string;
  fees: {
    token: string;
    address: string;
    amount: bigint;
  }[];
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
  {
    inputs: [
      { internalType: "address", name: "feeOwner", type: "address" },
      { internalType: "address", name: "token", type: "address" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function main() {
  console.log("🚀 Starting fee claiming process...\n");

  const [signer] = await ethers.getSigners();
  console.log("📝 Signer:", signer.address);

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

  const feeLocker = new ethers.Contract(feeLockerAddress, FEE_LOCKER_ABI, signer);

  const cabalsToClaimFrom: CabalFeeInfo[] = [];
  const commonTokens = [
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" }, // Base WETH
    { symbol: "USD+", address: "0xB6fe221d63c969236e86970d3f653f9355a9f97e" }, // Base USD+
  ];

  console.log("🔍 Scanning for cabals with claimable fees...\n");

  // Check cabals 0-99 (adjust as needed)
  for (let i = 0; i <= 99; i++) {
    try {
      const cabal = await viewFacet.getCabal(i);

      // Skip presale cabals or those without tokens
      if (cabal.phase !== 1n || cabal.tokenAddress === ethers.ZeroAddress) {
        continue;
      }

      const cabalInfo: CabalFeeInfo = {
        cabalId: i,
        name: cabal.name,
        symbol: cabal.symbol,
        tokenAddress: cabal.tokenAddress,
        tbaAddress: cabal.tbaAddress,
        fees: [],
      };

      // Check each common token
      for (const token of commonTokens) {
        try {
          const availableFees = await feeLocker.availableFees(cabal.tbaAddress, token.address);

          if (availableFees > 0n) {
            cabalInfo.fees.push({
              token: token.symbol,
              address: token.address,
              amount: availableFees,
            });
          }
        } catch (e) {
          // Token check failed, continue
        }
      }

      // Only include cabals with claimable fees
      if (cabalInfo.fees.length > 0) {
        cabalsToClaimFrom.push(cabalInfo);
      }
    } catch (e: any) {
      // Cabal doesn't exist or error reading, continue
    }
  }

  if (cabalsToClaimFrom.length === 0) {
    console.log("📭 No cabals with claimable fees found.\n");
    process.exit(0);
  }

  console.log(`💰 Found ${cabalsToClaimFrom.length} cabal(s) with claimable fees:\n`);

  // Display what will be claimed
  let totalClaims = 0;
  for (const cabal of cabalsToClaimFrom) {
    console.log(`CABAL${cabal.cabalId}: ${cabal.name} (${cabal.symbol})`);
    for (const fee of cabal.fees) {
      console.log(`  • ${fee.token}: ${ethers.formatEther(fee.amount)} ETH`);
      totalClaims++;
    }
  }

  console.log(`\n📊 Total claims to execute: ${totalClaims}`);
  console.log("\n⏳ Proceeding with claims in 5 seconds... (Press Ctrl+C to cancel)\n");

  // Wait 5 seconds
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Execute claims
  let successCount = 0;
  let failureCount = 0;
  const results = [];

  for (const cabal of cabalsToClaimFrom) {
    for (const fee of cabal.fees) {
      try {
        console.log(
          `📤 Claiming ${fee.token} for CABAL${cabal.cabalId} (${cabal.name})...`
        );

        const tx = await feeLocker.claim(cabal.tbaAddress, fee.address);
        const receipt = await tx.wait();

        console.log(`   ✅ Tx: ${tx.hash}`);
        console.log(`   📦 Block: ${receipt?.blockNumber}\n`);

        successCount++;
        results.push({
          cabalId: cabal.cabalId,
          cabalName: cabal.name,
          token: fee.token,
          amount: ethers.formatEther(fee.amount),
          txHash: tx.hash,
          status: "success",
        });
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}\n`);
        failureCount++;
        results.push({
          cabalId: cabal.cabalId,
          cabalName: cabal.name,
          token: fee.token,
          amount: ethers.formatEther(fee.amount),
          error: error.message,
          status: "failed",
        });
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("📋 CLAIM SUMMARY");
  console.log("=".repeat(80));
  console.log(`✅ Successful claims: ${successCount}`);
  console.log(`❌ Failed claims: ${failureCount}`);
  console.log(`📊 Total processed: ${successCount + failureCount}\n`);

  if (results.length > 0) {
    console.log("Detailed Results:");
    console.log(JSON.stringify(results, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
