import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  // Get GenesisFacet interface for error decoding
  const genesisFacet = await ethers.getContractFactory("GenesisFacet");
  const iface = genesisFacet.interface;
  
  console.log("Genesis Facet error selectors:");
  for (const error of iface.fragments.filter(f => f.type === "error")) {
    console.log(" ", error.name, ":", iface.getError(error.name)?.selector);
  }
  
  // Test 1: initializeGenesis WITHOUT value
  console.log("\n1. initializeGenesis WITHOUT value:");
  try {
    await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      from: deployer.address,
    });
    console.log("   Success!");
  } catch (e: any) {
    console.log("   Error:", e.shortMessage || e.message);
    if (e.data) {
      console.log("   Raw data:", e.data);
      try {
        const decoded = iface.parseError(e.data);
        console.log("   Decoded:", decoded?.name);
      } catch {
        console.log("   Could not decode with Genesis interface");
      }
    }
  }
  
  // Test 2: initializeGenesis WITH value
  console.log("\n2. initializeGenesis WITH 0.00001 ETH:");
  try {
    await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
    });
    console.log("   Success!");
  } catch (e: any) {
    console.log("   Error:", e.shortMessage || e.message);
    if (e.data) {
      console.log("   Raw data:", e.data);
      try {
        const decoded = iface.parseError(e.data);
        console.log("   Decoded:", decoded?.name);
      } catch {
        console.log("   Could not decode with Genesis interface");
        // Try to decode as string error
        if (e.data.startsWith("0x08c379a0")) {
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + e.data.slice(10));
          console.log("   String error:", reason[0]);
        }
      }
    }
  }
  
  // Test 3: contributeToGenesis
  console.log("\n3. contributeToGenesis WITH 0.00001 ETH:");
  try {
    await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x3427fe63",
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
    });
    console.log("   Success!");
  } catch (e: any) {
    console.log("   Error:", e.shortMessage || e.message);
    if (e.data) {
      console.log("   Raw data:", e.data);
      try {
        const decoded = iface.parseError(e.data);
        console.log("   Decoded:", decoded?.name);
      } catch {
        console.log("   Could not decode with Genesis interface");
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
