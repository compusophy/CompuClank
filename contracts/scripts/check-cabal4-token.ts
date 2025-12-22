const { ethers } = require("hardhat");

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const TOKEN_ADDRESS = "0xd2c0871Eb9D5FD851724a208332Fbec440A18bdf";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
];

async function main() {
  console.log(`Checking Cabal 4 Token: ${TOKEN_ADDRESS}\n`);
  
  // Check if it's a contract
  const code = await ethers.provider.getCode(TOKEN_ADDRESS);
  
  if (code === "0x") {
    console.log("❌ This is NOT a contract!");
    return;
  }
  
  console.log(`✅ Contract deployed with ${code.length} bytes\n`);
  
  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const decimals = await token.decimals();
    
    console.log("Token Info:");
    console.log(`  Name: ${name}`);
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Decimals: ${decimals}`);
    console.log(`  Total Supply: ${ethers.formatUnits(totalSupply, decimals)}`);
  } catch (e: any) {
    console.log("Error reading token info:", e.message);
  }
  
  // Get Cabal data
  const viewFacet = await ethers.getContractAt(
    [
      "function getCabal(uint256) view returns (tuple(address creator, string name, string symbol, string image, address tbaAddress, address tokenAddress, uint8 phase, address[] contributors, uint256 totalRaised, uint256 totalTokensReceived, tuple(uint256 votingPeriod, uint256 quorumBps, uint256 majorityBps, uint256 proposalThreshold) settings))"
    ],
    DIAMOND_ADDRESS
  );
  
  try {
    const cabal = await viewFacet.getCabal(4);
    console.log("\nCabal 4 Data:");
    console.log(`  Creator: ${cabal.creator}`);
    console.log(`  Name: ${cabal.name}`);
    console.log(`  Symbol: ${cabal.symbol}`);
    console.log(`  TBA: ${cabal.tbaAddress}`);
    console.log(`  Token: ${cabal.tokenAddress}`);
    console.log(`  Phase: ${cabal.phase} (2=Active)`);
    console.log(`  Total Raised: ${ethers.formatEther(cabal.totalRaised)} ETH`);
    console.log(`  Tokens Received: ${ethers.formatUnits(cabal.totalTokensReceived, 18)}`);
    
    // Check TBA balance
    const tbaBalance = await token.balanceOf(cabal.tbaAddress);
    console.log(`\n  TBA Token Balance: ${ethers.formatUnits(tbaBalance, 18)}`);
  } catch (e: any) {
    console.log("Error reading Cabal data:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
