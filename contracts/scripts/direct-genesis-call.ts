import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const INIT_GENESIS_SELECTOR = "0x0420884e";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Account:", deployer.address);
  console.log("Diamond:", DIAMOND_ADDRESS);
  
  // Get code at diamond address to verify it exists
  const code = await ethers.provider.getCode(DIAMOND_ADDRESS);
  console.log("\nDiamond bytecode length:", code.length);
  if (code === "0x") {
    console.log("ERROR: No contract at this address!");
    return;
  }
  
  // Try eth_call directly with the selector
  console.log("\n--- Testing with eth_call ---");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: INIT_GENESIS_SELECTOR,
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
    });
    console.log("eth_call result:", result);
  } catch (e: any) {
    console.log("eth_call FAILED:");
    console.log("  Message:", e.message);
    if (e.data) {
      console.log("  Data:", e.data);
      // Try to decode
      try {
        const iface = new ethers.Interface([
          "error Error(string)",
        ]);
        const decoded = iface.parseError(e.data);
        console.log("  Decoded:", decoded);
      } catch {
        // Try as string
        if (e.data.length > 10) {
          const hex = e.data.slice(10);
          try {
            const text = ethers.toUtf8String("0x" + hex.slice(128));
            console.log("  Error text:", text);
          } catch {}
        }
      }
    }
  }
  
  // Check facet address via loupe
  console.log("\n--- Checking via DiamondLoupe ---");
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  const facetAddr = await loupe.facetAddress(INIT_GENESIS_SELECTOR);
  console.log("Facet for 0x0420884e:", facetAddr);
  
  if (facetAddr === ethers.ZeroAddress) {
    console.log("\n⚠️  SELECTOR NOT REGISTERED IN DIAMOND!");
    console.log("The upgrade may have failed or pointed to wrong diamond.");
  } else {
    console.log("\n✅ Selector is registered to facet:", facetAddr);
    
    // Check if facet has code
    const facetCode = await ethers.provider.getCode(facetAddr);
    console.log("Facet bytecode length:", facetCode.length);
    
    if (facetCode === "0x") {
      console.log("⚠️  NO CODE AT FACET ADDRESS!");
    }
  }
  
  // Try to actually send the transaction (not just simulate)
  console.log("\n--- Attempting actual transaction ---");
  try {
    const tx = await deployer.sendTransaction({
      to: DIAMOND_ADDRESS,
      data: INIT_GENESIS_SELECTOR,
      value: ethers.parseEther("0.00001"),
      gasLimit: 500000,
    });
    console.log("TX Hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ SUCCESS! Gas used:", receipt?.gasUsed.toString());
  } catch (e: any) {
    console.log("❌ Transaction FAILED:");
    console.log("  Reason:", e.reason || e.message);
    if (e.data) {
      console.log("  Revert data:", e.data);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
