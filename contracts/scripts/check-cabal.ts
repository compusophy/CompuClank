import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  const cabal = await viewFacet.getCabal(0);
  
  console.log("CABAL0 Status:");
  console.log("  Name:", cabal.name);
  console.log("  Symbol:", cabal.symbol);
  console.log("  Phase:", cabal.phase.toString(), "(0=Presale, 1=Active)");
  console.log("  Token Address:", cabal.tokenAddress);
  console.log("  TBA Address:", cabal.tbaAddress);
  console.log("  Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
  console.log("  Total Tokens Received:", cabal.totalTokensReceived.toString());
  console.log("  Total Staked:", cabal.totalStaked.toString());
  console.log("  Launched At:", new Date(Number(cabal.launchedAt) * 1000).toISOString());
  
  // Check TBA balance
  const tbaBalance = await ethers.provider.getBalance(cabal.tbaAddress);
  console.log("\n  TBA ETH Balance:", ethers.formatEther(tbaBalance), "ETH");
  
  // Check if token exists
  if (cabal.tokenAddress !== ethers.ZeroAddress) {
    const token = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", cabal.tokenAddress);
    const tbaTokenBalance = await token.balanceOf(cabal.tbaAddress);
    console.log("  TBA Token Balance:", ethers.formatUnits(tbaTokenBalance, 18));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
