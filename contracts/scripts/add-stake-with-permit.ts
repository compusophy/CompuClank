import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Adding stakeWithPermit with account:", deployer.address);

  // 1. First check current state
  console.log("\n1. Checking current state...");
  const loupe = await ethers.getContractAt("DiamondLoupeFacet", DIAMOND_ADDRESS);
  const StakingFacet = await ethers.getContractFactory("StakingFacet");
  const tempFacet = await StakingFacet.deploy();
  await tempFacet.waitForDeployment();
  
  const stakeWithPermitSelector = tempFacet.interface.getFunction("stakeWithPermit")?.selector;
  const stakeSelector = tempFacet.interface.getFunction("stake")?.selector;
  
  console.log("   stakeWithPermit selector:", stakeWithPermitSelector);
  console.log("   stake selector:", stakeSelector);
  
  const currentStakeWithPermitFacet = await loupe.facetAddress(stakeWithPermitSelector!);
  const currentStakeFacet = await loupe.facetAddress(stakeSelector!);
  
  console.log("   Current stakeWithPermit facet:", currentStakeWithPermitFacet);
  console.log("   Current stake facet:", currentStakeFacet);
  
  // 2. Get all facets and their functions
  console.log("\n2. Listing all facets...");
  const facets = await loupe.facets();
  for (const facet of facets) {
    console.log(`   Facet: ${facet.facetAddress}`);
    console.log(`   Selectors: ${facet.functionSelectors.length}`);
  }
  
  // 3. If stakeWithPermit is not registered, add it
  if (currentStakeWithPermitFacet === ethers.ZeroAddress) {
    console.log("\n3. stakeWithPermit not found, adding...");
    
    const newFacetAddress = await tempFacet.getAddress();
    console.log("   New StakingFacet address:", newFacetAddress);
    
    await delay(5000);
    
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    
    // Only add stakeWithPermit
    const cut = [{
      facetAddress: newFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: [stakeWithPermitSelector],
    }];
    
    console.log("   Executing diamond cut to add stakeWithPermit...");
    const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
    const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
    console.log("   TX:", tx.hash);
    await tx.wait();
    console.log("   ✅ Done!");
    
    // Also replace stake function to use _stakeInternal
    console.log("\n4. Replacing stake function with new version...");
    const stakeCut = [{
      facetAddress: newFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: [stakeSelector],
    }];
    
    const tx2 = await diamondCut.diamondCut(stakeCut, ethers.ZeroAddress, "0x");
    console.log("   TX:", tx2.hash);
    await tx2.wait();
    console.log("   ✅ Done!");
    
  } else {
    console.log("\n3. stakeWithPermit already registered at:", currentStakeWithPermitFacet);
  }
  
  // 4. Verify final state
  console.log("\n5. Verifying final state...");
  await delay(3000);
  
  const finalStakeWithPermitFacet = await loupe.facetAddress(stakeWithPermitSelector!);
  const finalStakeFacet = await loupe.facetAddress(stakeSelector!);
  
  console.log("   stakeWithPermit facet:", finalStakeWithPermitFacet);
  console.log("   stake facet:", finalStakeFacet);
  
  if (finalStakeWithPermitFacet !== ethers.ZeroAddress) {
    console.log("\n========================================");
    console.log("✅ stakeWithPermit is now available!");
    console.log("========================================");
  } else {
    console.log("\n❌ stakeWithPermit still not registered. Something went wrong.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
