import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 3; // CABAL3

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing finalizeCabal with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);
  console.log("Cabal ID:", CABAL_ID);
  
  // Get contract
  const cabalFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  // Check cabal state
  console.log("\n=== Checking CABAL state ===");
  try {
    const cabal = await viewFacet.getCabal(CABAL_ID);
    console.log("Name:", cabal.name);
    console.log("Symbol:", cabal.symbol);
    console.log("Phase:", cabal.phase);
    console.log("Total Raised:", ethers.formatEther(cabal.totalRaised), "ETH");
    console.log("TBA:", cabal.tbaAddress);
    console.log("Parent ID:", cabal.parentCabalId.toString());
    
    // Check vote status (on CabalCreationFacet, not ViewFacet)
    const voteStatus = await cabalFacet.getLaunchVoteStatus(CABAL_ID);
    console.log("\n=== Vote Status ===");
    console.log("Votes For:", ethers.formatEther(voteStatus[0]));
    console.log("Votes Against:", ethers.formatEther(voteStatus[1]));
    console.log("Total Staked:", ethers.formatEther(voteStatus[2]));
    console.log("Voting Ended:", voteStatus[3]);
    console.log("Majority Met:", voteStatus[4]);
    console.log("Approved At:", voteStatus[5].toString());
    console.log("Finalizable At:", voteStatus[6].toString());
    
    const now = Math.floor(Date.now() / 1000);
    console.log("Current Time:", now);
    console.log("Can Finalize:", voteStatus[4] && now >= Number(voteStatus[6]));
    
  } catch (e: any) {
    console.log("Error fetching state:", e.message);
  }
  
  // Try to estimate gas first
  console.log("\n=== Estimating gas for finalizeCabal ===");
  try {
    const gasEstimate = await cabalFacet.finalizeCabal.estimateGas(CABAL_ID);
    console.log("Gas estimate:", gasEstimate.toString());
    
    // If we get here, it would work
    console.log("\n=== Attempting finalizeCabal ===");
    const tx = await cabalFacet.finalizeCabal(CABAL_ID, { gasLimit: gasEstimate * 120n / 100n });
    console.log("TX hash:", tx.hash);
    console.log("Check on Basescan: https://basescan.org/tx/" + tx.hash);
    const receipt = await tx.wait();
    console.log("TX succeeded! Gas used:", receipt?.gasUsed.toString());
  } catch (e: any) {
    console.log("FAILED:");
    // Log full error for debugging
    console.log("Error message:", e.message?.slice(0, 1000));
    console.log("");
    
    // Try to get revert data
    try {
      const callData = cabalFacet.interface.encodeFunctionData("finalizeCabal", [CABAL_ID]);
      const result = await ethers.provider.call({
        to: DIAMOND_ADDRESS,
        data: callData
      });
      console.log("Call result:", result);
    } catch (callError: any) {
      console.log("Call error data:", callError.data);
      // Try to decode error
      if (callError.data && callError.data.length > 10) {
        console.log("Error selector:", callError.data.slice(0, 10));
      }
    }
  }
  
  // Check if token already exists
  console.log("\n=== Checking if token exists ===");
  try {
    const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
    const cabal = await viewFacet.getCabal(CABAL_ID);
    console.log("Token address:", cabal.tokenAddress);
    console.log("Token exists:", cabal.tokenAddress !== ethers.ZeroAddress);
  } catch (e: any) {
    console.log("Error:", e.message);
  }
  
  // Check NFT ownership
  console.log("\n=== Checking NFT ownership ===");
  try {
    // Get NFT contract address from settings
    const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
    const addresses = await settingsFacet.getContractAddresses();
    const nftAddress = addresses[0]; // cabalNFT is first return value
    console.log("CabalNFT address:", nftAddress);
    
    // Check owner of CABAL3 NFT
    const cabalNFT = await ethers.getContractAt("IERC721", nftAddress);
    const nftOwner = await cabalNFT.ownerOf(CABAL_ID);
    console.log("Owner of CABAL3 NFT:", nftOwner);
    console.log("Diamond address:", DIAMOND_ADDRESS);
    console.log("Diamond is owner:", nftOwner.toLowerCase() === DIAMOND_ADDRESS.toLowerCase());
    
    // Check TBA's owner() function
    const tbaAddress = "0xA09aAAfa198639b4330B8a3AFEE782251b1978de";
    const cabalTBA = await ethers.getContractAt("CabalTBA", tbaAddress);
    const tbaOwner = await cabalTBA.owner();
    console.log("TBA owner():", tbaOwner);
  } catch (e: any) {
    console.log("Error:", e.message);
  }
  
  // Check Clanker settings
  console.log("\n=== Checking Clanker settings ===");
  try {
    const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
    const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
    console.log("Hook:", hook);
    console.log("Locker:", locker);
    console.log("MevModule:", mevModule);
    console.log("DevBuyExtension:", devBuyExtension);
    
    // Check if any are zero
    if (hook === ethers.ZeroAddress) console.log("WARNING: Hook is zero address!");
    if (locker === ethers.ZeroAddress) console.log("WARNING: Locker is zero address!");
    if (mevModule === ethers.ZeroAddress) console.log("WARNING: MevModule is zero address!");
    if (devBuyExtension === ethers.ZeroAddress) console.log("WARNING: DevBuyExtension is zero address!");
  } catch (e: any) {
    console.log("Error getting settings:", e.message);
  }
  
  // Check TBA balance
  console.log("\n=== Checking TBA ETH balance ===");
  try {
    const tbaAddress = "0xA09aAAfa198639b4330B8a3AFEE782251b1978de";
    const balance = await ethers.provider.getBalance(tbaAddress);
    console.log("TBA ETH balance:", ethers.formatEther(balance), "ETH");
    
    // Check what the fees would be
    const totalRaised = ethers.parseEther("0.00103");
    const protocolFee = totalRaised * 100n / 10000n; // 1%
    console.log("Protocol fee would be:", ethers.formatEther(protocolFee), "ETH");
    
    // Get ancestor chain for CABAL3
    // CABAL3 -> CABAL1 -> CABAL0
    // ancestors = [CABAL1, CABAL0]
    const ancestorCount = 2n; // parent + root
    const ancestorFees = totalRaised * 100n * ancestorCount / 10000n;
    console.log("Ancestor fees would be:", ethers.formatEther(ancestorFees), "ETH");
    
    const remaining = totalRaised - protocolFee - ancestorFees;
    console.log("Remaining after fees:", ethers.formatEther(remaining), "ETH");
    
    const treasuryEth = remaining * 5000n / 10000n; // 50%
    const devBuyAmount = remaining - treasuryEth;
    console.log("Treasury ETH:", ethers.formatEther(treasuryEth), "ETH");
    console.log("Dev buy amount:", ethers.formatEther(devBuyAmount), "ETH");
    
    console.log("\nTotal needed:", ethers.formatEther(protocolFee + ancestorFees + devBuyAmount), "ETH");
    console.log("TBA has:", ethers.formatEther(balance), "ETH");
    console.log("Sufficient:", balance >= (protocolFee + ancestorFees + devBuyAmount));
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
