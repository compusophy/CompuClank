import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Manual finalizeCabal test");
  console.log("Deployer:", deployer.address);
  
  // Get the interface to encode the call
  const cabalFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  const callData = cabalFacet.interface.encodeFunctionData("finalizeCabal", [3]);
  
  console.log("\n=== Sending raw transaction ===");
  console.log("Call data:", callData.slice(0, 66) + "...");
  
  try {
    // Send raw transaction with high gas, bypassing estimation
    const tx = await deployer.sendTransaction({
      to: DIAMOND_ADDRESS,
      data: callData,
      gasLimit: 10000000, // Increased for token deployment
    });
    
    console.log("TX submitted:", tx.hash);
    console.log("Check: https://basescan.org/tx/" + tx.hash);
    
    console.log("\nWaiting for confirmation...");
    const receipt = await tx.wait();
    
    if (receipt?.status === 1) {
      console.log("SUCCESS! Gas used:", receipt.gasUsed.toString());
    } else {
      console.log("REVERTED on-chain. Check Basescan for details.");
    }
  } catch (e: any) {
    console.log("ERROR:", e.message?.slice(0, 300));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
