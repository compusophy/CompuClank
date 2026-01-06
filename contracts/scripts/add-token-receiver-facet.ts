import { ethers } from "hardhat";
import { Contract } from "ethers";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding TokenReceiverFacet with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // 1. Deploy TokenReceiverFacet
  console.log("\n1. Deploying TokenReceiverFacet...");
  const TokenReceiverFacet = await ethers.getContractFactory("TokenReceiverFacet");
  const facet = await TokenReceiverFacet.deploy();
  await facet.waitForDeployment();
  const facetAddress = await facet.getAddress();
  console.log("   TokenReceiverFacet:", facetAddress);

  // 2. Get function selectors
  console.log("\n2. Getting function selectors...");
  const selectors = getSelectors(facet);
  console.log("   Selectors:", selectors);

  // 3. Check which selectors already exist
  console.log("\n3. Checking existing selectors...");
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  
  const selectorsToAdd: string[] = [];
  const selectorsToReplace: string[] = [];
  
  for (const selector of selectors) {
    const existing = await loupe.facetAddress(selector);
    if (existing === ethers.ZeroAddress) {
      selectorsToAdd.push(selector);
      console.log(`   ${selector}: ADD (new)`);
    } else {
      selectorsToReplace.push(selector);
      console.log(`   ${selector}: REPLACE (exists at ${existing})`);
    }
  }

  // 4. Prepare diamond cut
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const cuts = [];

  if (selectorsToAdd.length > 0) {
    cuts.push({
      facetAddress: facetAddress,
      action: FacetCutAction.Add,
      functionSelectors: selectorsToAdd,
    });
  }

  if (selectorsToReplace.length > 0) {
    cuts.push({
      facetAddress: facetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: selectorsToReplace,
    });
  }

  if (cuts.length === 0) {
    console.log("\n   No changes needed!");
    return;
  }

  // 5. Execute diamond cut
  console.log("\n4. Executing diamond cut...");
  console.log(`   Adding ${selectorsToAdd.length}, Replacing ${selectorsToReplace.length}`);
  
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("   ✅ Success!");

  // 6. Verify
  console.log("\n5. Verifying...");
  const onERC721Received = await loupe.facetAddress("0x150b7a02");
  console.log("   onERC721Received facet:", onERC721Received);
  
  if (onERC721Received.toLowerCase() === facetAddress.toLowerCase()) {
    console.log("   ✅ TokenReceiverFacet correctly registered!");
  } else {
    console.log("   ❌ Something went wrong!");
  }

  console.log("\n========================================");
  console.log("TokenReceiverFacet Added!");
  console.log("initializeGenesis should now work!");
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
