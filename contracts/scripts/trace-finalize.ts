import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 0n;

async function main() {
  console.log("Tracing finalizeCabal call...");
  
  const [signer] = await ethers.getSigners();
  const creationFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Get cabal info
  const cabal = await viewFacet.getCabal(CABAL_ID);
  console.log("TBA Address:", cabal.tbaAddress);
  console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
  
  // Calculate what the finalize would do
  const PROTOCOL_FEE_BPS = 100n;
  const TREASURY_ETH_BPS = 3300n;
  const BPS_DENOMINATOR = 10000n;
  
  const protocolFee = (cabal.totalRaised * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
  const remaining = cabal.totalRaised - protocolFee;
  const treasuryEth = (remaining * TREASURY_ETH_BPS) / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);
  const devBuyAmount = remaining - treasuryEth;
  
  console.log("\n--- Calculated Amounts ---");
  console.log("Protocol Fee (1%):", ethers.formatEther(protocolFee), "ETH");
  console.log("Remaining:", ethers.formatEther(remaining), "ETH");
  console.log("Treasury ETH (33% of remaining):", ethers.formatEther(treasuryEth), "ETH");
  console.log("DevBuy Amount (67%):", ethers.formatEther(devBuyAmount), "ETH");
  console.log("DevBuy in Wei:", devBuyAmount.toString());
  
  // Check TBA balance
  const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
  console.log("\nTBA Balance:", ethers.formatEther(tbaBalance), "ETH");
  console.log("TBA can afford devBuy:", tbaBalance >= devBuyAmount);
  
  // Let's check if devBuy extension has a minimum
  console.log("\n--- Checking DevBuy Extension ---");
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  console.log("DevBuy Extension:", devBuyExtension);
  
  // Try to get code at devBuyExtension
  const devBuyCode = await ethers.provider.getCode(devBuyExtension);
  console.log("DevBuy Extension has code:", devBuyCode !== "0x");
  
  // Try to call estimate gas with more detail
  console.log("\n--- Estimating Gas ---");
  try {
    const gasEstimate = await creationFacet.finalizeCabal.estimateGas(CABAL_ID);
    console.log("Gas estimate:", gasEstimate.toString());
  } catch (e: any) {
    console.log("Gas estimation failed!");
    console.log("Error message:", e.message);
    
    // Try to decode error
    if (e.data) {
      console.log("Error data:", e.data);
      
      // Common error patterns
      const errorPatterns = [
        { selector: "0x23bba199", possible: "DevBuyAmountTooLow" },
        { selector: "0x08c379a0", possible: "Error(string)" },
      ];
      
      for (const pattern of errorPatterns) {
        if (e.data.startsWith(pattern.selector)) {
          console.log("Possible error:", pattern.possible);
        }
      }
    }
    
    // Try to get the reason
    if (e.info?.error?.data) {
      console.log("Inner error data:", e.info.error.data);
    }
  }
  
  // Common Clanker errors to check
  console.log("\n--- Possible Issues ---");
  console.log("1. DevBuy amount might be below Clanker minimum");
  console.log("2. TBA might not have ERC721Receiver (but we added that)");
  console.log("3. Extension data might be malformed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
