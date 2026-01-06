import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Checking if Diamond is a proxy:", DIAMOND_ADDRESS);
  
  // Common proxy implementation slots
  const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const EIP1967_ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
  const EIP1967_BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
  
  // Check each slot
  const implValue = await ethers.provider.getStorage(DIAMOND_ADDRESS, EIP1967_IMPL_SLOT);
  const adminValue = await ethers.provider.getStorage(DIAMOND_ADDRESS, EIP1967_ADMIN_SLOT);
  const beaconValue = await ethers.provider.getStorage(DIAMOND_ADDRESS, EIP1967_BEACON_SLOT);
  
  console.log("\nEIP-1967 slots:");
  console.log("  Implementation:", implValue);
  console.log("  Admin:", adminValue);
  console.log("  Beacon:", beaconValue);
  
  // Get the full bytecode
  const code = await ethers.provider.getCode(DIAMOND_ADDRESS);
  console.log("\nFull bytecode:");
  console.log(code);
  
  // Check owner slot in LibDiamond storage
  // Owner is at offset 4 in DiamondStorage struct (after 4 mappings/arrays)
  const DIAMOND_STORAGE_POSITION = ethers.keccak256(ethers.toUtf8Bytes("diamond.standard.diamond.storage"));
  // In the DiamondStorage struct:
  // slot 0: selectorToFacetAndPosition (mapping - just takes 1 slot for the base)
  // slot 1: facetFunctionSelectors (mapping)
  // slot 2: facetAddresses (array - length stored here)
  // slot 3: supportedInterfaces (mapping)
  // slot 4: contractOwner (address)
  
  const ownerSlot = ethers.toBigInt(DIAMOND_STORAGE_POSITION) + 4n;
  const ownerValue = await ethers.provider.getStorage(DIAMOND_ADDRESS, ownerSlot);
  console.log("\nOwner slot value:", ownerValue);
  
  // Try slot 2 (facetAddresses array length)
  const facetArraySlot = ethers.toBigInt(DIAMOND_STORAGE_POSITION) + 2n;
  const arrayLength = await ethers.provider.getStorage(DIAMOND_ADDRESS, facetArraySlot);
  console.log("FacetAddresses array length:", arrayLength, "=", parseInt(arrayLength, 16));
  
  // Direct eth_call to loupe
  console.log("\n--- Direct eth_call to facetAddress(0x0420884e) ---");
  const iface = new ethers.Interface([
    "function facetAddress(bytes4) view returns (address)"
  ]);
  const calldata = iface.encodeFunctionData("facetAddress", ["0x0420884e"]);
  
  try {
    const result = await ethers.provider.call({
      to: DIAMOND_ADDRESS,
      data: calldata,
    });
    console.log("Raw result:", result);
    const decoded = iface.decodeFunctionResult("facetAddress", result);
    console.log("Decoded facet address:", decoded[0]);
  } catch (e: any) {
    console.log("Call failed:", e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
