import { ethers } from "hardhat";

async function main() {
  console.log("=== Checking Configuration ===\n");

  // Check position BPS sum
  const positionBps = [1000, 5000, 1500, 2000, 500];
  const positionSum = positionBps.reduce((a, b) => a + b, 0);
  console.log("Position BPS:", positionBps);
  console.log("Position BPS sum:", positionSum, positionSum === 10000 ? "✓" : "✗");

  // Check reward BPS for CABAL0
  const rewardBpsCABAL0 = [10000];
  const rewardSumCABAL0 = rewardBpsCABAL0.reduce((a, b) => a + b, 0);
  console.log("\nCABAL0 Reward BPS:", rewardBpsCABAL0);
  console.log("Reward BPS sum:", rewardSumCABAL0, rewardSumCABAL0 === 10000 ? "✓" : "✗");

  // Check tick ranges vs starting tick
  const DEFAULT_TICK = -230400;
  const ticks = [
    { lower: -230400, upper: -214000 },
    { lower: -214000, upper: -155000 },
    { lower: -202000, upper: -155000 },
    { lower: -155000, upper: -120000 },
    { lower: -141000, upper: -120000 },
  ];

  console.log("\nTick ranges (must be >= DEFAULT_TICK of", DEFAULT_TICK, "):");
  for (let i = 0; i < ticks.length; i++) {
    const valid = ticks[i].lower >= DEFAULT_TICK && ticks[i].upper >= DEFAULT_TICK;
    console.log(`  Position ${i}: [${ticks[i].lower}, ${ticks[i].upper}]`, valid ? "✓" : "✗");
  }

  // Compute error selector for common names with parameters
  const errorSignatures = [
    "NotWhitelisted(address)",
    "NotAllowlisted(address)",
    "InvalidModuleAddress(address)",
    "ModuleNotAllowed(address)",
    "HookNotAllowed(address)",
    "LockerNotAllowed(address)",
    "MevModuleNotAllowed(address)",
    "ExtensionNotAllowed(address)",
    "InvalidHookForPool(address)",
    "InvalidLockerForPool(address)",
    "InvalidMevModuleForPool(address)",
    "PoolDataValidationFailed()",
    "LockerDataValidationFailed()",
    "MevDataValidationFailed()",
    "ExtensionDataValidationFailed()",
    "InvalidFeeConfiguration()",
    "FeeConfigurationError()",
    "FeeTooHigh()",
    "FeeTooLow()",
    "InvalidFeeBps()",
    "InvalidRewardBps(uint16)",
    "InvalidPositionBps(uint16)",
    "PositionBpsMismatch()",
    "RewardBpsMismatch()",
    "ArrayLengthMismatch()",
    "LengthMismatch()",
    "InvalidArrayLength()",
    "TooManyRecipients()",
    "TooManyPositions()",
    "InvalidTickSpacing(int24)",
    "TickSpacingMismatch()",
  ];

  console.log("\nSearching for error 0x23bba199:");
  for (const sig of errorSignatures) {
    const selector = ethers.id(sig).slice(0, 10);
    if (selector === "0x23bba199") {
      console.log(`  ✓ FOUND: ${sig}`);
      return;
    }
  }
  console.log("  Not found in additional signatures");

  // Let me also compute what the error name might be by trying common patterns
  console.log("\nTrying to find error by brute-force common names...");
  const prefixes = ["Invalid", "Not", "Wrong", "Bad", "Missing", "Failed", "Error", "Mismatch"];
  const suffixes = ["Config", "Data", "Params", "Value", "Amount", "Address", "BPS", "Tick", "Fee", "Module", "Hook", "Locker", "Pool", "Token", "Extension", "Recipient", "Admin", "Position", "Reward"];
  
  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      const sig = `${prefix}${suffix}()`;
      const selector = ethers.id(sig).slice(0, 10);
      if (selector === "0x23bba199") {
        console.log(`  ✓ FOUND: ${sig}`);
        return;
      }
    }
  }
  console.log("  Still not found");
}

main().catch(console.error);
