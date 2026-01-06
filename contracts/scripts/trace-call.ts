import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Testing with different RPC approaches...\n");
  
  // 1. Direct eth_call with just the selector
  console.log("1. eth_call with selector 0x0420884e:");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
    });
    console.log("   Success! Result:", result);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // 2. Try with explicit gas
  console.log("\n2. eth_call with explicit gas limit:");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
      gasLimit: 1000000,
    });
    console.log("   Success! Result:", result);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // 3. Try with a different block tag
  console.log("\n3. eth_call at 'pending' block:");
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: "0x0420884e",
      value: ethers.parseEther("0.00001"),
      from: deployer.address,
    }, "pending");
    console.log("   Success! Result:", result);
  } catch (e: any) {
    console.log("   Failed:", e.shortMessage || e.message);
  }
  
  // 4. Check storage at different block numbers
  console.log("\n4. Checking storage at different blocks:");
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log("   Current block:", currentBlock);
  
  const SLOT = "0x6f42a3361c136ec4a062656edf3d19790dc0bba8a93b6bc1c524ca11074d4597";
  
  for (const offset of [0, -1, -10, -100]) {
    const block = currentBlock + offset;
    try {
      const value = await ethers.provider.getStorage(DIAMOND_ADDRESS, SLOT, block);
      console.log(`   Block ${block}: ${value}`);
    } catch (e: any) {
      console.log(`   Block ${block}: Error - ${e.message}`);
    }
  }
  
  // 5. Check when the facet was added
  console.log("\n5. Looking for DiamondCut events...");
  const iface = new ethers.Interface([
    "event DiamondCut(tuple(address facetAddress, uint8 action, bytes4[] functionSelectors)[] _diamondCut, address _init, bytes _calldata)"
  ]);
  
  const filter = {
    address: DIAMOND_ADDRESS,
    fromBlock: currentBlock - 10000,
    toBlock: "latest",
  };
  
  const logs = await ethers.provider.getLogs(filter);
  console.log(`   Found ${logs.length} logs`);
  
  for (const log of logs.slice(-5)) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed) {
        console.log(`   Block ${log.blockNumber}: DiamondCut event`);
        for (const cut of parsed.args._diamondCut) {
          console.log(`     Facet: ${cut.facetAddress}, Action: ${cut.action}, Selectors: ${cut.functionSelectors.length}`);
        }
      }
    } catch {}
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
