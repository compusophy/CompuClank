import { ethers } from "hardhat";
import { Contract } from "ethers";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading StakingFacet with account:", deployer.address);

  // 1. Deploy new StakingFacet
  console.log("\n1. Deploying new StakingFacet...");
  const StakingFacet = await ethers.getContractFactory("StakingFacet");
  const newFacet = await StakingFacet.deploy();
  await newFacet.waitForDeployment();
  const newFacetAddress = await newFacet.getAddress();
  console.log("   New StakingFacet:", newFacetAddress);
  
  // Wait for transaction to be fully confirmed
  console.log("   Waiting for confirmation...");
  await delay(10000);

  // 2. Get the function selectors
  console.log("\n2. Getting function selectors...");
  const selectors = getSelectors(newFacet);
  console.log("   Selectors:", selectors);

  // 3. Prepare the diamond cut
  // We use Replace for existing functions + Add for new stakeWithPermit
  console.log("\n3. Preparing diamond cut...");
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
  // Get the stakeWithPermit selector
  const stakeWithPermitSelector = newFacet.interface.getFunction("stakeWithPermit")?.selector;
  console.log("   stakeWithPermit selector:", stakeWithPermitSelector);
  
  // Separate new and existing selectors
  const existingSelectors = selectors.filter(s => s !== stakeWithPermitSelector);
  
  const cuts = [];
  
  // Replace existing functions
  if (existingSelectors.length > 0) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: existingSelectors,
    });
    console.log("   Replacing selectors:", existingSelectors);
  }
  
  // Add new function
  if (stakeWithPermitSelector) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: [stakeWithPermitSelector],
    });
    console.log("   Adding selector:", stakeWithPermitSelector);
  }

  // 4. Execute the diamond cut
  console.log("\n4. Executing diamond cut...");
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("   ✅ Diamond cut successful!");

  // 5. Verify
  console.log("\n5. Verifying...");
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  
  for (const selector of selectors) {
    const facetAddress = await loupe.facetAddress(selector);
    const match = facetAddress.toLowerCase() === newFacetAddress.toLowerCase();
    console.log(`   ${selector}: ${match ? "✅" : "❌"} ${facetAddress}`);
  }

  console.log("\n========================================");
  console.log("StakingFacet Upgrade Complete!");
  console.log("New facet address:", newFacetAddress);
  console.log("stakeWithPermit is now available!");
  console.log("========================================");
}

function getSelectors(contract: Contract): string[] {
  const selectors = new Set<string>();
  
  for (const fragment of contract.interface.fragments) {
    if (fragment.type === "function") {
      const func = contract.interface.getFunction(fragment.name);
      if (func) {
        selectors.add(func.selector);
      }
    }
  }
  
  return Array.from(selectors);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
