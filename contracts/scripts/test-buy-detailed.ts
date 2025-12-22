const { ethers } = require("hardhat");

const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log(`Testing buyTokens with signer: ${signer.address}`);
  console.log(`Diamond: ${DIAMOND}\n`);
  
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND);
  
  // Check cabal state first
  const viewABI = [
    "function getCabal(uint256 cabalId) view returns (tuple(uint256 id, address creator, string name, string symbol, string image, address tbaAddress, address tokenAddress, uint8 phase, uint256 totalRaised, uint256 totalTokensReceived, uint256 totalStaked, uint256 contributorCount, tuple(uint256 votingPeriod, uint256 quorumBps, uint256 majorityBps, uint256 proposalThreshold) settings))"
  ];
  const view = new ethers.Contract(DIAMOND, viewABI, ethers.provider);
  
  console.log("=== Cabal 4 State ===");
  try {
    const cabal = await view.getCabal(4);
    console.log(`  tokenAddress: ${cabal.tokenAddress}`);
    console.log(`  phase: ${cabal.phase} (1 = Active)`);
    console.log(`  tbaAddress: ${cabal.tbaAddress}`);
  } catch (e: any) {
    console.log(`  Error getting cabal: ${e.message}`);
  }
  
  // Check ClankerV4Settings
  const settingsABI = [
    "function getClankerAddresses() view returns (address hook, address locker, address mevModule, address devBuyExtension)"
  ];
  const settings = new ethers.Contract(DIAMOND, settingsABI, ethers.provider);
  
  console.log("\n=== ClankerV4Settings ===");
  try {
    const addrs = await settings.getClankerAddresses();
    console.log(`  hook: ${addrs[0]}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
  
  // Now try the buy
  const amountIn = ethers.parseEther("0.0001");
  console.log(`\n=== Attempting buyTokens ===`);
  console.log(`  Amount: ${ethers.formatEther(amountIn)} ETH`);
  console.log(`  Cabal ID: 4`);
  console.log(`  Min Amount Out: 0`);
  
  try {
    // Try estimating gas first
    console.log("\n  Estimating gas...");
    const gasEstimate = await swapFacet.buyTokens.estimateGas(4, 0, { value: amountIn });
    console.log(`  Gas estimate: ${gasEstimate}`);
    
    // Now send transaction
    console.log("\n  Sending transaction...");
    const tx = await swapFacet.buyTokens(4, 0, {
      value: amountIn,
      gasLimit: 600000
    });
    console.log(`  Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log(`\n  ✅ SUCCESS!`);
    console.log(`  Gas used: ${receipt.gasUsed}`);
    
    // Check for TokensBought event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = swapFacet.interface.parseLog(log);
        return parsed?.name === "TokensBought";
      } catch { return false; }
    });
    
    if (event) {
      const parsed = swapFacet.interface.parseLog(event);
      console.log(`  Tokens received: ${ethers.formatEther(parsed?.args.tokensReceived)}`);
    }
    
  } catch (e: any) {
    console.log(`\n  ❌ FAILED`);
    console.log(`  Error message: ${e.message?.slice(0, 500)}`);
    
    // Try to decode the error
    if (e.data) {
      console.log(`  Error data: ${e.data}`);
    }
    
    // Also try to get the error from the revert reason
    if (e.error?.data) {
      console.log(`  Inner error data: ${e.error.data}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
