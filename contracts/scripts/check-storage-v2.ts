import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const INIT_GENESIS_SELECTOR = "0x0420884e";

async function main() {
  console.log("Checking raw storage for Diamond:", DIAMOND_ADDRESS);
  
  // Diamond storage position: keccak256("diamond.standard.diamond.storage")
  const DIAMOND_STORAGE_POSITION = "0xc8fcad8db84d3cc18b4c41d551ea0ee66dd599cde068d998e57d5e09332c131c";
  console.log("Diamond storage position:", DIAMOND_STORAGE_POSITION);
  
  // For a mapping(bytes4 => ...) at a base slot S, the value is at:
  // keccak256(key_padded || S)
  // bytes4 is LEFT-padded in Solidity mappings
  const leftPaddedSelector = INIT_GENESIS_SELECTOR + "00".repeat(28); // 4 bytes + 28 bytes of zeros
  console.log("Left-padded selector:", leftPaddedSelector);
  
  // Calculate storage slot
  const storageSlot = ethers.keccak256(ethers.concat([leftPaddedSelector, DIAMOND_STORAGE_POSITION]));
  console.log("Storage slot for selector mapping:", storageSlot);
  
  // Read the storage
  const storageValue = await ethers.provider.getStorage(DIAMOND_ADDRESS, storageSlot);
  console.log("Raw storage value:", storageValue);
  
  // FacetAddressAndPosition is { address facetAddress; uint96 functionSelectorPosition; }
  // address is 20 bytes (160 bits), uint96 is 12 bytes (96 bits) = 32 bytes total
  // In EVM storage, packed structs are stored with first field in LOW-order bytes
  // So facetAddress is in bytes 0-19 (low), position is in bytes 20-31 (high)
  // Reading as uint256: low 160 bits = address, high 96 bits = position
  
  const value = BigInt(storageValue);
  const facetAddress = "0x" + (value & ((1n << 160n) - 1n)).toString(16).padStart(40, "0");
  const position = value >> 160n;
  
  console.log("\nDecoded:");
  console.log("  facetAddress:", facetAddress);
  console.log("  position:", position.toString());
  
  // Also try the Diamond's own lookup
  console.log("\n--- Simulating Diamond fallback lookup ---");
  // The Diamond does: CALLDATALOAD(0) & 0xffffffff... to get selector
  // Then: keccak256(memory[0..0x40]) where memory[0] = selector (padded), memory[0x20] = DIAMOND_STORAGE_POSITION
  // But wait, the selector is at memory position 0 and takes 32 bytes, then DIAMOND_STORAGE_POSITION at 0x20
  
  // Looking at the bytecode:
  // 5f8035 = PUSH0, DUP1, CALLDATALOAD -> stack: [0, calldata[0:32]]
  // 7fffffffff... = PUSH32 mask -> stack: [0, calldata[0:32], mask]
  // 16 = AND -> stack: [0, selector_masked]
  // 81 = DUP2 -> stack: [0, selector_masked, 0]  
  // 52 = MSTORE -> stores selector_masked at memory[0]
  // 7fc8fcad... = PUSH32 DIAMOND_STORAGE_POSITION
  // 6020 = PUSH1 0x20
  // 52 = MSTORE -> stores DIAMOND_STORAGE_POSITION at memory[0x20]
  // 6040 = PUSH1 0x40
  // Wait, let me re-read the bytecode...
  
  // Actually looking more carefully:
  // 81 7fc8fcad... 6020 52 -> MSTORE(0x20, DIAMOND_STORAGE_POSITION)
  // 6040 90 20 -> PUSH1 0x40, SWAP1, SHA3
  // So it does keccak256(memory[0..0x40]) where:
  // memory[0..32] = selector (with mask applied, so it's left-aligned: 0x0420884e00...00)
  // memory[32..64] = DIAMOND_STORAGE_POSITION
  
  // Let me compute this:
  const selectorMasked = INIT_GENESIS_SELECTOR + "00000000000000000000000000000000000000000000000000000000";
  const hashInput = selectorMasked + DIAMOND_STORAGE_POSITION.slice(2);
  console.log("Hash input (64 bytes):", hashInput);
  console.log("Hash input length:", (hashInput.length - 2) / 2, "bytes");
  
  const computedSlot = ethers.keccak256(hashInput);
  console.log("Computed slot:", computedSlot);
  
  const value2 = await ethers.provider.getStorage(DIAMOND_ADDRESS, computedSlot);
  console.log("Storage at computed slot:", value2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
