import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Checking all cabals...\n");
  
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  for (let i = 0; i <= 3; i++) {
    try {
      const cabal = await viewFacet.getCabal(i);
      console.log(`=== CABAL${i} ===`);
      console.log("Name:", cabal.name);
      console.log("Symbol:", cabal.symbol);
      console.log("Phase:", cabal.phase === 0n ? "Presale" : "Active");
      console.log("Token:", cabal.tokenAddress === ethers.ZeroAddress ? "None" : cabal.tokenAddress);
      console.log("TBA:", cabal.tbaAddress);
      console.log("Parent:", cabal.parentCabalId.toString());
      console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
      console.log("");
    } catch (e: any) {
      console.log(`CABAL${i}: Not found or error`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
