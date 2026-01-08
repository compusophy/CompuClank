import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Attempting to finalize CABAL1 with account:", deployer.address);
  
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const cabalCreationFacet = CabalCreationFacet.attach(DIAMOND_ADDRESS);
  
  try {
    // First try to estimate gas to see if it would revert
    console.log("\nEstimating gas...");
    const gasEstimate = await cabalCreationFacet.finalizeCabal.estimateGas(1);
    console.log("Gas estimate:", gasEstimate.toString());
    
    // If we get here, it should work - try the actual call
    console.log("\nSending transaction...");
    const tx = await cabalCreationFacet.finalizeCabal(1);
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);
    console.log("Gas used:", receipt?.gasUsed.toString());
    
  } catch (error: any) {
    console.error("\n=== ERROR ===");
    console.error("Error message:", error.message);
    
    // Try to decode the revert reason
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    // Log full error for debugging
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    if (error.error?.data) {
      console.error("Inner error data:", error.error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
