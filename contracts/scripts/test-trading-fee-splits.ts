import { ethers } from "hardhat";
import { Contract, FunctionFragment } from "ethers";

// Diamond addresses
const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// Diamond facet action types
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

async function getSelectors(contract: Contract): Promise<string[]> {
  const selectors: string[] = [];
  contract.interface.forEachFunction((fn: FunctionFragment) => {
    selectors.push(fn.selector);
  });
  return selectors;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing trading fee splits with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);
  
  // Get diamond contract
  const diamond = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  const cabalDiamond = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  
  // Step 1: Deploy the updated CabalCreationFacet
  console.log("\n=== Step 1: Deploy updated CabalCreationFacet ===");
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const cabalCreationFacet = await CabalCreationFacet.deploy();
  await cabalCreationFacet.waitForDeployment();
  const cabalCreationAddress = await cabalCreationFacet.getAddress();
  console.log("CabalCreationFacet deployed to:", cabalCreationAddress);
  
  // Step 2: Get selectors for the facet
  const selectors = await getSelectors(cabalCreationFacet);
  console.log(`Found ${selectors.length} selectors`);
  
  // Step 3: Perform diamond cut to replace the facet
  console.log("\n=== Step 2: Perform diamond cut ===");
  const cut = [{
    facetAddress: cabalCreationAddress,
    action: FacetCutAction.Replace,
    functionSelectors: selectors
  }];
  
  const tx = await diamond.diamondCut(cut, ethers.ZeroAddress, "0x");
  console.log("Diamond cut tx:", tx.hash);
  await tx.wait();
  console.log("Diamond cut complete!");
  
  // Step 4: Get current cabal count to understand state
  console.log("\n=== Step 3: Check current state ===");
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  
  try {
    const cabalCount = await viewFacet.cabalCount();
    console.log("Current cabal count:", cabalCount.toString());
    
    // Get root cabal info
    const rootId = await viewFacet.getRootCabalId();
    console.log("Root cabal ID:", rootId.toString());
    
    const rootCabal = await viewFacet.getCabal(rootId);
    console.log("Root cabal symbol:", rootCabal.symbol);
    console.log("Root cabal TBA:", rootCabal.tbaAddress);
  } catch (e) {
    console.log("Could not fetch state:", e);
  }
  
  console.log("\n=== CabalCreationFacet Upgrade Complete ===");
  console.log("The updated CabalCreationFacet is now deployed with:");
  console.log("");
  console.log("1. TRADING FEE SPLITS (locker rewards):");
  console.log("   - 1% protocol fee to root (C0)");
  console.log("   - 1% per ancestor (including root)");
  console.log("   - So root gets 2% total from all descendants");
  console.log("");
  console.log("2. LAUNCH FEE SPLITS (presale ETH):");
  console.log("   - 1% protocol fee to root (C0)");
  console.log("   - 1% per ancestor (including root)");
  console.log("   - 50% treasury ETH (was 33%)");
  console.log("   - 50% dev buy -> stakers (was 67%)");
  console.log("");
  console.log("To test, create a new child cabal and verify:");
  console.log("  - Locker config has multiple reward recipients");
  console.log("  - Launch fees are split correctly");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
