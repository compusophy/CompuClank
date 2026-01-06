import { ethers } from "hardhat";

async function main() {
  // Check the deployToken selector
  const sig = "deployToken((address,string,string,bytes32,string,string,string,uint256),(address,address,int24,int24,bytes),(address,address[],address[],uint16[],int24[],int24[],uint16[],bytes),(address,bytes),(address,uint256,uint16,bytes)[])";
  const selector = ethers.id(sig).slice(0, 10);
  console.log("Expected deployToken selector:", selector);
  console.log("IClankerFactory comment says:", "0xdf40224a");
  console.log("Match:", selector === "0xdf40224a");
  
  // Also check using the interface
  const factory = await ethers.getContractFactory("CabalCreationFacet");
  // Can't get factory interface directly, let's use the actual interface
  const IClankerFactory = await ethers.getContractAt("contracts/cabal/interfaces/IClankerFactory.sol:IClankerFactory", ethers.ZeroAddress);
  const actualSelector = IClankerFactory.interface.getFunction("deployToken")?.selector;
  console.log("\nActual selector from interface:", actualSelector);
}

main().catch(console.error);
