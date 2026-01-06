import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const INIT_GENESIS_SELECTOR = "0x0420884e";

async function main() {
  console.log("Checking raw storage for Diamond:", DIAMOND_ADDRESS);
  
  // Diamond storage position: keccak256("diamond.standard.diamond.storage")
  const DIAMOND_STORAGE_POSITION = ethers.keccak256(ethers.toUtf8Bytes("diamond.standard.diamond.storage"));
  console.log("Diamond storage position:", DIAMOND_STORAGE_POSITION);
  
  // selectorToFacetAndPosition is the first field in DiamondStorage (slot 0 relative to position)
  // It's a mapping(bytes4 => FacetAddressAndPosition)
  // For a mapping at slot S with key K, the value is at keccak256(K . S) where . is concatenation
  // But we need to pad the key (bytes4) to 32 bytes
  
  const paddedSelector = ethers.zeroPadValue(INIT_GENESIS_SELECTOR, 32);
  console.log("Padded selector:", paddedSelector);
  
  // The mapping is at slot DIAMOND_STORAGE_POSITION (the base storage position)
  // So the value slot = keccak256(paddedSelector ++ DIAMOND_STORAGE_POSITION)
  const storageSlot = ethers.keccak256(ethers.concat([paddedSelector, DIAMOND_STORAGE_POSITION]));
  console.log("Storage slot for selector mapping:", storageSlot);
  
  // Read the storage
  const storageValue = await ethers.provider.getStorage(DIAMOND_ADDRESS, storageSlot);
  console.log("Raw storage value:", storageValue);
  
  // FacetAddressAndPosition is { address facetAddress; uint96 functionSelectorPosition; }
  // Both packed into 32 bytes: first 20 bytes = address, last 12 bytes = uint96
  const facetAddress = "0x" + storageValue.slice(26); // Last 20 bytes (40 hex chars)
  const position = "0x" + storageValue.slice(2, 26); // First 12 bytes (24 hex chars)
  
  console.log("\nDecoded:");
  console.log("  facetAddress:", facetAddress);
  console.log("  position:", position);
  
  // Also check what the bytecode looks like
  console.log("\n--- Diamond bytecode analysis ---");
  const code = await ethers.provider.getCode(DIAMOND_ADDRESS);
  console.log("Bytecode length:", code.length, "chars (", (code.length - 2) / 2, "bytes )");
  
  // Check the expected bytecode from artifacts
  const Diamond = await ethers.getContractFactory("Diamond");
  const expectedBytecode = Diamond.bytecode;
  console.log("Expected deployment bytecode length:", expectedBytecode.length, "chars");
  
  // The deployed bytecode doesn't include constructor code
  // Let's just compare a portion
  console.log("\nFirst 100 chars of deployed code:", code.slice(0, 100));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
