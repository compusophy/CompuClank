import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  console.log("Checking root cabal ID...\n");
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  
  // Check if there's a function to get root cabal ID
  try {
    // Try to read the root cabal ID from storage directly
    // The position is keccak256("cabal.diamond.storage.rootCabalId")
    const position = ethers.keccak256(ethers.toUtf8Bytes("cabal.diamond.storage.rootCabalId"));
    console.log("Root position hash:", position);
    
    const value = await ethers.provider.getStorage(DIAMOND_ADDRESS, position);
    console.log("Root cabal ID from storage:", BigInt(value).toString());
    
    // Also get CABAL0's TBA to compare
    const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
    const cabal0 = await viewFacet.getCabal(0);
    console.log("CABAL0 TBA:", cabal0.tbaAddress);
  } catch (e: any) {
    console.log("Error:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
