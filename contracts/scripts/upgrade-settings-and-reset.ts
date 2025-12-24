import { ethers } from "hardhat";
import { Contract } from "ethers";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading SettingsFacet with account:", deployer.address);

  // 1. Deploy new SettingsFacet
  console.log("\n1. Deploying new SettingsFacet...");
  const SettingsFacet = await ethers.getContractFactory("SettingsFacet");
  const newFacet = await SettingsFacet.deploy();
  await newFacet.waitForDeployment();
  const newFacetAddress = await newFacet.getAddress();
  console.log("   New SettingsFacet:", newFacetAddress);
  
  // Wait for transaction to be fully confirmed
  console.log("   Waiting for confirmation...");
  await delay(10000);

  // 2. Get the function selectors
  console.log("\n2. Getting function selectors...");
  const selectors = getSelectors(newFacet);
  console.log("   Total selectors:", selectors.length);

  // 3. Get the resetAllCabals selector (this is the NEW function)
  const resetSelector = newFacet.interface.getFunction("resetAllCabals")?.selector;
  console.log("   resetAllCabals selector:", resetSelector);

  // 4. Prepare the diamond cut
  console.log("\n3. Preparing diamond cut...");
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
  // Separate new and existing selectors
  const existingSelectors = selectors.filter(s => s !== resetSelector);
  
  const cuts = [];
  
  // Replace existing functions
  if (existingSelectors.length > 0) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: existingSelectors,
    });
    console.log("   Replacing", existingSelectors.length, "selectors");
  }
  
  // Add new function
  if (resetSelector) {
    cuts.push({
      facetAddress: newFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: [resetSelector],
    });
    console.log("   Adding resetAllCabals selector");
  }

  // 5. Execute the diamond cut
  console.log("\n4. Executing diamond cut...");
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("   ✅ Diamond cut successful!");

  await delay(5000);

  // 6. Call resetAllCabals
  console.log("\n5. Calling resetAllCabals...");
  const settings = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const resetTx = await settings.resetAllCabals();
  console.log("   TX:", resetTx.hash);
  const receipt = await resetTx.wait();
  console.log("   ✅ All cabals reset!");

  // Parse the event
  const event = receipt?.logs.find((log: any) => {
    try {
      return settings.interface.parseLog(log)?.name === "AllCabalsReset";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = settings.interface.parseLog(event as any);
    console.log("   Previous cabal count:", parsed?.args.previousCount.toString());
  }

  // 7. Verify
  console.log("\n6. Verifying...");
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  const facetForReset = await loupe.facetAddress(resetSelector!);
  console.log(`   resetAllCabals facet: ${facetForReset}`);

  // Check that cabals are now empty
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const allCabals = await viewFacet.getAllCabals();
  console.log("   Current cabal count:", allCabals.length);

  console.log("\n========================================");
  console.log("SettingsFacet Upgrade + Reset Complete!");
  console.log("New facet address:", newFacetAddress);
  console.log("All cabals have been cleared!");
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
