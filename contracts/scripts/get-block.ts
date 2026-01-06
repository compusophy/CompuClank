import { ethers } from "hardhat";

async function main() {
  const block = await ethers.provider.getBlockNumber();
  console.log("Current block:", block);
  
  // Decode the mevModuleData to understand what it means
  const mevModuleData = "0x00000000000000000000000000000000000000000000000000000000000a2c99000000000000000000000000000000000000000000000000000000000000a2c9000000000000000000000000000000000000000000000000000000000000000f";
  
  // Decode as 3 uint256 values
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
    ["uint256", "uint256", "uint256"],
    mevModuleData
  );
  console.log("\nMEV Module Data decoded:");
  console.log("  Value 1:", decoded[0].toString(), "(block number?)");
  console.log("  Value 2:", decoded[1].toString(), "(block number?)");
  console.log("  Value 3:", decoded[2].toString(), "(delay blocks?)");
}

main().catch(console.error);
