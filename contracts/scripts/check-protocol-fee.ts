import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const ViewFacet = await ethers.getContractFactory("ViewFacet");
  const viewFacet = ViewFacet.attach(DIAMOND_ADDRESS);
  
  const cabal0 = await viewFacet.getCabal(0);
  const cabal1 = await viewFacet.getCabal(1);
  
  console.log("=== CABAL0 (Protocol Treasury) ===");
  console.log("TBA Address:", cabal0.tbaAddress);
  const cabal0Balance = await ethers.provider.getBalance(cabal0.tbaAddress);
  console.log("TBA ETH Balance:", ethers.formatEther(cabal0Balance), "ETH");
  
  console.log("\n=== CABAL1 ===");
  console.log("TBA Address:", cabal1.tbaAddress);
  console.log("Total Raised:", ethers.formatEther(cabal1.totalRaised), "ETH");
  
  // Calculate expected protocol fee from CABAL1
  const protocolFee = (cabal1.totalRaised * 100n) / 10000n; // 1%
  console.log("Protocol Fee (1%):", ethers.formatEther(protocolFee), "ETH");
  
  console.log("\n=== Protocol Fee Verification ===");
  console.log("CABAL0 treasury should have received:", ethers.formatEther(protocolFee), "ETH from CABAL1 launch");
  console.log("CABAL0 initial contribution was 0.005 ETH");
  console.log("Expected CABAL0 balance (approx):", ethers.formatEther(ethers.parseEther("0.005") + protocolFee), "ETH");
  console.log("Actual CABAL0 balance:", ethers.formatEther(cabal0Balance), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
