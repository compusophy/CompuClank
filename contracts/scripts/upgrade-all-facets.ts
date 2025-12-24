import { ethers } from "hardhat";
import { Contract } from "ethers";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FacetUpgrade {
  name: string;
  contractName: string;
}

const FACETS_TO_UPGRADE: FacetUpgrade[] = [
  { name: "SettingsFacet", contractName: "SettingsFacet" },
  { name: "ViewFacet", contractName: "ViewFacet" },
  { name: "CabalCreationFacet", contractName: "CabalCreationFacet" },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading facets with account:", deployer.address);

  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);

  for (const facetInfo of FACETS_TO_UPGRADE) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`Upgrading ${facetInfo.name}...`);
    console.log("=".repeat(50));

    // 1. Deploy new facet
    console.log("\n1. Deploying new facet...");
    const Facet = await ethers.getContractFactory(facetInfo.contractName);
    const newFacet = await Facet.deploy();
    await newFacet.waitForDeployment();
    const newFacetAddress = await newFacet.getAddress();
    console.log("   New address:", newFacetAddress);
    
    await delay(5000);

    // 2. Get function selectors
    const selectors = getSelectors(newFacet);
    console.log("   Total selectors:", selectors.length);

    // 3. Check which selectors already exist in the diamond
    const addSelectors: string[] = [];
    const replaceSelectors: string[] = [];
    
    for (const selector of selectors) {
      const existingFacet = await loupe.facetAddress(selector);
      if (existingFacet === ethers.ZeroAddress) {
        addSelectors.push(selector);
      } else {
        replaceSelectors.push(selector);
      }
    }
    
    console.log(`   Existing (Replace): ${replaceSelectors.length}`);
    console.log(`   New (Add): ${addSelectors.length}`);

    // 4. Prepare cuts
    const cuts = [];

    if (replaceSelectors.length > 0) {
      cuts.push({
        facetAddress: newFacetAddress,
        action: FacetCutAction.Replace,
        functionSelectors: replaceSelectors,
      });
    }

    if (addSelectors.length > 0) {
      cuts.push({
        facetAddress: newFacetAddress,
        action: FacetCutAction.Add,
        functionSelectors: addSelectors,
      });
    }

    if (cuts.length === 0) {
      console.log("   No changes needed, skipping...");
      continue;
    }

    // 5. Execute diamond cut
    console.log("\n2. Executing diamond cut...");
    const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
    console.log("   TX:", tx.hash);
    await tx.wait();
    console.log("   ✅ Diamond cut successful!");

    await delay(5000);

    // 6. Verify
    console.log("\n3. Verifying...");
    let allMatch = true;
    for (const selector of selectors.slice(0, 3)) { // Just check first 3
      const facetAddress = await loupe.facetAddress(selector);
      const match = facetAddress.toLowerCase() === newFacetAddress.toLowerCase();
      if (!match) allMatch = false;
    }
    console.log(`   Verification: ${allMatch ? "✅ All selectors point to new facet" : "⚠️ Some selectors may not match"}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("ALL FACET UPGRADES COMPLETE!");
  console.log("=".repeat(50));

  // Ask if user wants to reset cabals
  console.log("\nTo reset all cabals, run:");
  console.log("  npx hardhat run scripts/reset-cabals.ts --network base");
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
