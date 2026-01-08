import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL3_TBA = "0xA09aAAfa198639b4330B8a3AFEE782251b1978de";
const CABAL0_TBA = "0x2a019eece7879e66ef1DE5704ECFeE020DCB8AFf";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing TBA calls...\n");
  
  // Get CabalTBA contract
  const cabalTBA = await ethers.getContractAt("CabalTBA", CABAL3_TBA);
  
  // Check TBA owner
  const owner = await cabalTBA.owner();
  console.log("TBA owner:", owner);
  console.log("Diamond:", DIAMOND_ADDRESS);
  console.log("Match:", owner.toLowerCase() === DIAMOND_ADDRESS.toLowerCase());
  
  // Check TBA balance
  const balance = await ethers.provider.getBalance(CABAL3_TBA);
  console.log("\nTBA balance:", ethers.formatEther(balance), "ETH");
  
  // Try to execute a call through the diamond to the TBA
  // This simulates what finalizeCabal does
  console.log("\n=== Testing ETH transfer from TBA ===");
  
  // Calculate the protocol fee
  const totalRaised = balance;
  const protocolFee = totalRaised / 100n; // 1%
  console.log("Protocol fee to send:", ethers.formatEther(protocolFee), "ETH");
  console.log("Recipient (CABAL0 TBA):", CABAL0_TBA);
  
  // The diamond needs to call TBA.executeCall to send ETH
  // But we can't do that directly from our EOA - only the diamond can
  // Let's check if maybe the diamond isn't set up properly
  
  console.log("\n=== Checking if Diamond can call TBA ===");
  // The diamond calls TBA through CabalCreationFacet
  // The TBA checks if msg.sender == owner()
  // owner() returns the owner of the NFT that the TBA is bound to
  // So we need to check if the Diamond owns the NFT
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const addresses = await settingsFacet.getContractAddresses();
  const nftAddress = addresses[0];
  console.log("CabalNFT address:", nftAddress);
  
  const cabalNFT = await ethers.getContractAt("IERC721", nftAddress);
  const nftOwner = await cabalNFT.ownerOf(3);
  console.log("Owner of CABAL3 NFT:", nftOwner);
  console.log("Diamond owns NFT:", nftOwner.toLowerCase() === DIAMOND_ADDRESS.toLowerCase());
  
  // Also check the token() function to see what NFT the TBA is bound to
  console.log("\n=== Checking TBA binding ===");
  const [chainId, tokenContract, tokenId] = await cabalTBA.token();
  console.log("TBA bound to chainId:", chainId.toString());
  console.log("TBA bound to contract:", tokenContract);
  console.log("TBA bound to tokenId:", tokenId.toString());
  
  // Compare with expected
  console.log("\nExpected contract:", nftAddress);
  console.log("Expected tokenId:", 3);
  console.log("Contract matches:", tokenContract.toLowerCase() === nftAddress.toLowerCase());
  console.log("TokenId matches:", tokenId === 3n);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
