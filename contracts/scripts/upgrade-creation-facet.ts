import { ethers } from "hardhat";
import { Contract } from "ethers";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading CabalCreationFacet with account:", deployer.address);

  // 1. Deploy new CabalCreationFacet
  console.log("\n1. Deploying new CabalCreationFacet...");
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const newFacet = await CabalCreationFacet.deploy();
  await newFacet.waitForDeployment();
  const newFacetAddress = await newFacet.getAddress();
  console.log("   New CabalCreationFacet:", newFacetAddress);
  
  // Wait for transaction to be fully confirmed
  console.log("   Waiting for confirmation...");
  await delay(10000);

  // 2. Get the function selectors
  console.log("\n2. Getting function selectors...");
  const allSelectors = getSelectors(newFacet);
  console.log("   All selectors:", allSelectors);

  // 3. Check which selectors already exist (replace) vs new (add)
  console.log("\n3. Checking existing vs new selectors...");
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  
  const selectorsToReplace: string[] = [];
  const selectorsToAdd: string[] = [];
  
  for (const selector of allSelectors) {
    const existingFacet = await loupe.facetAddress(selector);
    if (existingFacet === ethers.ZeroAddress) {
      selectorsToAdd.push(selector);
      console.log(`   ${selector}: NEW (will add)`);
    } else {
      selectorsToReplace.push(selector);
      console.log(`   ${selector}: EXISTS (will replace)`);
    }
  }

  // 4. Prepare the diamond cut
  console.log("\n4. Preparing diamond cut...");
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
  const cut = [];
  
  if (selectorsToReplace.length > 0) {
    cut.push({
      facetAddress: newFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: selectorsToReplace,
    });
    console.log(`   Replacing ${selectorsToReplace.length} existing functions`);
  }
  
  if (selectorsToAdd.length > 0) {
    cut.push({
      facetAddress: newFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: selectorsToAdd,
    });
    console.log(`   Adding ${selectorsToAdd.length} new functions`);
  }

  if (cut.length === 0) {
    console.log("   No changes needed!");
    return;
  }

  // 5. Execute the diamond cut
  console.log("\n5. Executing diamond cut...");
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("   ✅ Diamond cut successful!");

  // 6. Verify
  console.log("\n6. Verifying...");
  
  for (const selector of allSelectors) {
    const facetAddress = await loupe.facetAddress(selector);
    const match = facetAddress.toLowerCase() === newFacetAddress.toLowerCase();
    console.log(`   ${selector}: ${match ? "✅" : "❌"} ${facetAddress}`);
  }

  console.log("\n========================================");
  console.log("CabalCreationFacet Upgrade Complete!");
  console.log("New facet address:", newFacetAddress);
  console.log(`Replaced: ${selectorsToReplace.length}, Added: ${selectorsToAdd.length}`);
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
