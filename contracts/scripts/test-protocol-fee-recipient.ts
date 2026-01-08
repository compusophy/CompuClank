import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Checking protocol fee recipient...\n");
  
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Get CABAL0's TBA
  const cabal0 = await viewFacet.getCabal(0);
  console.log("CABAL0 TBA (protocol treasury):", cabal0.tbaAddress);
  
  // Verify it's a valid contract
  const code = await ethers.provider.getCode(cabal0.tbaAddress);
  console.log("Has code:", code.length > 2);
  
  // Check if it can receive ETH
  const balance = await ethers.provider.getBalance(cabal0.tbaAddress);
  console.log("Current balance:", ethers.formatEther(balance), "ETH");
  
  // Check CABAL3's parent chain
  console.log("\n=== CABAL3 Ancestor Chain ===");
  const cabal3 = await viewFacet.getCabal(3);
  console.log("CABAL3 parent ID:", cabal3.parentCabalId.toString());
  
  const cabal1 = await viewFacet.getCabal(1);
  console.log("CABAL1 TBA:", cabal1.tbaAddress);
  console.log("CABAL1 parent ID:", cabal1.parentCabalId.toString());
  
  // So ancestor chain for CABAL3:
  // _getAncestorChain(3) starts with parentCabalId = 1
  // Loop: currentId = 1, != 0, count = 1, currentId = getCabalData(1).parentCabalId = 0
  // Loop: currentId = 0, == 0, exit
  // ancestors = [getCabalData(1).tbaAddress] = [CABAL1 TBA]
  console.log("\nExpected ancestor chain: [CABAL1 TBA]");
  console.log("  = [", cabal1.tbaAddress, "]");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
