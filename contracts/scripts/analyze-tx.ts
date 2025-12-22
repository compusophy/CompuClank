const { ethers } = require("hardhat");

async function main() {
  const TX_HASH = "0x5935d7149f323afd2aae7f07614c5dd892d5dff8b04bc640433aebaed6885a32";
  
  console.log(`Analyzing transaction: ${TX_HASH}\n`);
  
  const tx = await ethers.provider.getTransaction(TX_HASH);
  const receipt = await ethers.provider.getTransactionReceipt(TX_HASH);
  
  // Look for PoolInitialized event from PoolManager
  // Event signature: Initialize(bytes32 id, address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)
  const POOL_INITIALIZED_TOPIC = "0xcf20c915598691530972338b1f506e10080644342416b7c25c6123497b76435f";
  
  console.log(`\nTransaction Logs (${receipt.logs.length}):`);
  
  for (const log of receipt.logs) {
    console.log(`\n  Log from ${log.address}:`);
    console.log(`    Topics: ${log.topics.join('\n            ')}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
