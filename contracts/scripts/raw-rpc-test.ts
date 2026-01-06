import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Testing with raw JSON-RPC calls...\n");
  
  // Get the RPC URL from the provider
  const provider = ethers.provider;
  
  // Test 1: eth_call WITHOUT value
  console.log("1. eth_call WITHOUT value (raw):");
  try {
    const result1 = await provider.send("eth_call", [{
      from: deployer.address,
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
    }, "latest"]);
    console.log("   Result:", result1);
  } catch (e: any) {
    console.log("   Reverted (expected - InsufficientContribution):", e.data || e.message?.slice(0, 50));
  }
  
  // Test 2: eth_call WITH value as hex
  console.log("\n2. eth_call WITH value 0x2386f26fc10000 (0.01 ETH):");
  try {
    const result2 = await provider.send("eth_call", [{
      from: deployer.address,
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: "0x2386f26fc10000", // 0.01 ETH = 10000000000000000 wei
    }, "latest"]);
    console.log("   Result:", result2);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }
  
  // Test 3: eth_call WITH very small value
  console.log("\n3. eth_call WITH value 0x2540be400 (10 gwei = 0.00000001 ETH):");
  try {
    const result3 = await provider.send("eth_call", [{
      from: deployer.address,
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: "0x2540be400", // 10 gwei
    }, "latest"]);
    console.log("   Result:", result3);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }
  
  // Test 4: eth_call WITH exact minimum (0.00001 ETH = 10000000000000 wei = 0x9184e72a000)
  console.log("\n4. eth_call WITH value 0x9184e72a000 (0.00001 ETH = minimum):");
  try {
    const result4 = await provider.send("eth_call", [{
      from: deployer.address,
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: "0x9184e72a000",
    }, "latest"]);
    console.log("   Result:", result4);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }
  
  // Test 5: Actually SEND the transaction (not just simulate)
  console.log("\n5. Actually sending the transaction (NOT simulation)...");
  try {
    const tx = await deployer.sendTransaction({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: ethers.parseEther("0.00001"),
      gasLimit: 500000,
    });
    console.log("   TX sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("   Receipt status:", receipt?.status);
    console.log("   Gas used:", receipt?.gasUsed.toString());
    if (receipt?.logs.length) {
      console.log("   Logs:", receipt.logs.length);
      for (const log of receipt.logs) {
        console.log("     Topic0:", log.topics[0]);
      }
    }
  } catch (e: any) {
    console.log("   TX failed:", e.reason || e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
