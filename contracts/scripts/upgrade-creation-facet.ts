import { ethers } from "hardhat";
import { Contract } from "ethers";

const DIAMOND_ADDRESS = process.env.CABAL_DIAMOND_ADDRESS || "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading Creation Facets (Creation + Genesis) with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // --- 1. Upgrade CabalCreationFacet ---
  console.log("\n--- Upgrading CabalCreationFacet ---");
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const newCreationFacet = await CabalCreationFacet.deploy();
  await newCreationFacet.waitForDeployment();
  const newCreationFacetAddress = await newCreationFacet.getAddress();
  console.log("   New CabalCreationFacet:", newCreationFacetAddress);
  await delay(5000);

  await upgradeFacet(newCreationFacet, newCreationFacetAddress);

  // --- 2. Upgrade GenesisFacet ---
  console.log("\n--- Upgrading GenesisFacet ---");
  const GenesisFacet = await ethers.getContractFactory("GenesisFacet");
  const newGenesisFacet = await GenesisFacet.deploy();
  await newGenesisFacet.waitForDeployment();
  const newGenesisFacetAddress = await newGenesisFacet.getAddress();
  console.log("   New GenesisFacet:", newGenesisFacetAddress);
  await delay(5000);

  await upgradeFacet(newGenesisFacet, newGenesisFacetAddress);

  console.log("\n========================================");
  console.log("Creation Facets Upgrade Complete!");
  console.log("========================================");
}

async function upgradeFacet(contract: Contract, facetAddress: string) {
  const allSelectors = getSelectors(contract);
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);

  const selectorsToReplace: string[] = [];
  const selectorsToAdd: string[] = [];

  for (const selector of allSelectors) {
    const existingFacet = await loupe.facetAddress(selector);
    if (existingFacet === ethers.ZeroAddress) {
      selectorsToAdd.push(selector);
    } else {
      selectorsToReplace.push(selector);
    }
  }

  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const cut = [];

  if (selectorsToReplace.length > 0) {
    cut.push({
      facetAddress: facetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: selectorsToReplace,
    });
  }
  
  if (selectorsToAdd.length > 0) {
    cut.push({
      facetAddress: facetAddress,
      action: FacetCutAction.Add,
      functionSelectors: selectorsToAdd,
    });
  }

  if (cut.length === 0) {
    console.log("   No changes needed!");
    return;
  }

  console.log(`   Executing cut: Replace ${selectorsToReplace.length}, Add ${selectorsToAdd.length}`);
  const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("   ✅ Cut successful!");
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
