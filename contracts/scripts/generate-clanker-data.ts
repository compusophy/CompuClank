import { ethers } from "hardhat";

async function main() {
  console.log("=== Generate Correct Clanker Data Blobs ===\n");

  // ============ LOCKER DATA ============
  // From SDK: ClankerLpLocker_Instantiation_v4_abi
  // Format: tuple(uint8[] feePreference) where 0=CLANKER_TOKEN, 1=PAIRED_TOKEN
  // We want rewards in PAIRED_TOKEN (ETH/WETH)
  const feePreference = [1]; // PAIRED_TOKEN
  
  const lockerData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(uint8[] feePreference)"],
    [{ feePreference }]
  );
  console.log("=== LOCKER DATA ===");
  console.log("feePreference:", feePreference, "(1 = PAIRED_TOKEN)");
  console.log("Encoded:", lockerData);
  console.log();

  // ============ MEV MODULE DATA ============
  // From SDK: Clanker_MevSniperAuction_InitData_v4_1_abi
  // Format: tuple(uint24 startingFee, uint24 endingFee, uint256 secondsToDecay)
  // These are the default values from the SDK
  const mevConfig = {
    startingFee: 10000,    // 100% fee at start (in BPS, so 10000 = 100%)
    endingFee: 100,        // 1% fee at end (in BPS, so 100 = 1%)
    secondsToDecay: 15n    // 15 seconds decay period
  };
  
  const mevModuleData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(uint24 startingFee, uint24 endingFee, uint256 secondsToDecay)"],
    [mevConfig]
  );
  console.log("=== MEV MODULE DATA ===");
  console.log("startingFee:", mevConfig.startingFee, "(100% in BPS)");
  console.log("endingFee:", mevConfig.endingFee, "(1% in BPS)");
  console.log("secondsToDecay:", mevConfig.secondsToDecay.toString());
  console.log("Encoded:", mevModuleData);
  console.log();

  // ============ POOL DATA (for feeDynamicHook) ============
  // From SDK: ClankerHook_DynamicFee_Instantiation_v4_abi
  // Format: [uint24 baseFee, uint24 maxLpFee, uint256 referenceTickFilterPeriod, 
  //          uint256 resetPeriod, int24 resetTickFilter, uint256 feeControlNumerator, uint24 decayFilterBps]
  // Default values from SDK:
  const dynamicFeeConfig = {
    baseFee: 100,                       // 0.01% base fee (100 in uniBps)
    maxLpFee: 10000,                    // 1% max fee (10000 in uniBps)
    referenceTickFilterPeriod: 600n,    // 10 minutes
    resetPeriod: 86400n,                // 24 hours
    resetTickFilter: 200,               // tick filter value
    feeControlNumerator: 1000000n,      // fee control numerator
    decayFilterBps: 9500                // 95% decay filter
  };
  
  const poolData = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint24", "uint24", "uint256", "uint256", "int24", "uint256", "uint24"],
    [
      dynamicFeeConfig.baseFee,
      dynamicFeeConfig.maxLpFee,
      dynamicFeeConfig.referenceTickFilterPeriod,
      dynamicFeeConfig.resetPeriod,
      dynamicFeeConfig.resetTickFilter,
      dynamicFeeConfig.feeControlNumerator,
      dynamicFeeConfig.decayFilterBps
    ]
  );
  console.log("=== POOL DATA (Dynamic Fee Hook) ===");
  console.log("baseFee:", dynamicFeeConfig.baseFee);
  console.log("maxLpFee:", dynamicFeeConfig.maxLpFee);
  console.log("referenceTickFilterPeriod:", dynamicFeeConfig.referenceTickFilterPeriod.toString());
  console.log("resetPeriod:", dynamicFeeConfig.resetPeriod.toString());
  console.log("resetTickFilter:", dynamicFeeConfig.resetTickFilter);
  console.log("feeControlNumerator:", dynamicFeeConfig.feeControlNumerator.toString());
  console.log("decayFilterBps:", dynamicFeeConfig.decayFilterBps);
  console.log("Encoded:", poolData);
  console.log();

  // ============ SUMMARY FOR CONTRACT ============
  console.log("=== COPY THESE TO CabalCreationFacet.sol ===\n");
  console.log("poolData (for feeDynamicHook):");
  console.log(`hex"${poolData.slice(2)}"`);
  console.log();
  console.log("lockerData:");
  console.log(`hex"${lockerData.slice(2)}"`);
  console.log();
  console.log("mevModuleData:");
  console.log(`hex"${mevModuleData.slice(2)}"`);
}

main().catch(console.error);
