import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Debugging eth_call behavior...\n");
  
  // Try calling initializeGenesis WITHOUT value
  console.log("1. eth_call initializeGenesis WITHOUT value:");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      from: deployer.address,
    });
    console.log("   Success! Result:", result);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // Try calling a different function - like getTotalCabals from ViewFacet
  // Need to get the selector for getTotalCabals
  const viewIface = new ethers.Interface([
    "function getTotalCabals() view returns (uint256)"
  ]);
  const totalCabalsData = viewIface.encodeFunctionData("getTotalCabals", []);
  
  console.log("\n2. eth_call getTotalCabals (selector:", totalCabalsData, "):");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: totalCabalsData,
    });
    console.log("   Success! Result:", result, "=", parseInt(result, 16));
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // Try calling owner()
  console.log("\n3. eth_call owner():");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x8da5cb5b", // owner() selector
    });
    console.log("   Success! Result:", result);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // Try calling facetAddress for a DIFFERENT selector
  const loupeIface = new ethers.Interface([
    "function facetAddress(bytes4) view returns (address)"
  ]);
  
  // Check facetAddress for owner() selector
  const facetAddrData = loupeIface.encodeFunctionData("facetAddress", ["0x8da5cb5b"]);
  console.log("\n4. eth_call facetAddress(0x8da5cb5b) [owner selector]:");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: facetAddrData,
    });
    const decoded = loupeIface.decodeFunctionResult("facetAddress", result);
    console.log("   Success! Facet:", decoded[0]);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // Try contributeToGenesis instead (another function from GenesisFacet)
  console.log("\n5. eth_call contributeToGenesis (0x3427fe63):");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x3427fe63",
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
    });
    console.log("   Success! Result:", result);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
    if (e.data) {
      console.log("   Error data:", e.data);
    }
  }
  
  // Debug: manually compute and check the slot for 0x3427fe63
  console.log("\n6. Checking storage for contributeToGenesis selector (0x3427fe63):");
  const selector2 = "0x3427fe63";
  const DIAMOND_STORAGE_POSITION = "0xc8fcad8db84d3cc18b4c41d551ea0ee66dd599cde068d998e57d5e09332c131c";
  const selectorPadded = selector2 + "00000000000000000000000000000000000000000000000000000000";
  const hashInput = selectorPadded + DIAMOND_STORAGE_POSITION.slice(2);
  const slot = ethers.keccak256(hashInput);
  const value = await ethers.provider.getStorage(DIAMOND_ADDRESS, slot);
  console.log("   Slot:", slot);
  console.log("   Value:", value);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
