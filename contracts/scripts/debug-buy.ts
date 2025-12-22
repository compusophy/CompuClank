const { ethers } = require("hardhat");

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const CABAL_ID = 1;
const BUY_AMOUNT = ethers.parseEther("0.0001"); // Small amount

async function main() {
  console.log("Debugging buyTokens...");

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Get Contract
  const swapFacet = await ethers.getContractAt("SwapFacet", DIAMOND_ADDRESS);

  // Check if Cabal 1 exists and is active
  try {
    const active = await swapFacet.hasActivePool(CABAL_ID);
    console.log(`Cabal ${CABAL_ID} has active pool: ${active}`);
    
    if (!active) {
      console.error("Cabal pool not active!");
      return;
    }

    const poolKey = await swapFacet.getPoolKey(CABAL_ID);
    console.log("Pool Key:", poolKey);

  } catch (e) {
    console.error("Error checking pool status:", e.message);
  }

  // Simulate buy
  console.log(`Attempting to buy tokens with ${ethers.formatEther(BUY_AMOUNT)} ETH...`);
  
  try {
    // We use callStatic to simulate return value, or just sendTransaction to test revert
    // Since we are on a live network (or fork), sending might cost real gas if not careful with --network.
    // But failures will show revert reason.
    
    const tx = await swapFacet.connect(signer).buyTokens(CABAL_ID, 0, { value: BUY_AMOUNT });
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction success! Gas used:", receipt.gasUsed.toString());
    
    // Check logs?
  } catch (e) {
    console.error("\n--- TRANSACTION FAILED ---");
    // Decode error
    if (e.data) {
        console.error("Error Data:", e.data);
        // Try to decode known errors
        const iface = swapFacet.interface;
        try {
            const parsed = iface.parseError(e.data);
            console.error("Revert Reason:", parsed.name, parsed.args);
        } catch (parseErr) {
            console.error("Could not parse error data (might be system error or string)");
        }
    } else if (e.reason) {
        console.error("Revert Reason String:", e.reason);
    } else {
        console.error("Full Error:", e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
