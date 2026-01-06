import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Checking if Diamond has onERC721Received...");
  
  // onERC721Received(address,address,uint256,bytes) selector = 0x150b7a02
  const selector = "0x150b7a02";
  
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  const facetAddress = await loupe.facetAddress(selector);
  
  console.log("onERC721Received selector:", selector);
  console.log("Facet address:", facetAddress);
  
  if (facetAddress === ethers.ZeroAddress) {
    console.log("\n❌ MISSING! The Diamond cannot receive ERC721 tokens via safeMint!");
    console.log("\nThis is why initializeGenesis fails when value >= minimum:");
    console.log("1. Value check passes");
    console.log("2. Code calls CabalNFT.mint(address(this))");
    console.log("3. CabalNFT uses _safeMint which calls onERC721Received on Diamond");
    console.log("4. Diamond doesn't have onERC721Received, so it reverts with 'Function does not exist'");
    console.log("\nWith value < minimum:");
    console.log("1. Value check fails immediately with InsufficientContribution");
    console.log("2. CabalNFT.mint is never called");
  } else {
    console.log("\n✅ onERC721Received is registered to facet:", facetAddress);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
