import { ethers } from "hardhat";

const OLD_DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Upgrading old diamond:", OLD_DIAMOND);
  console.log("Deployer:", signer.address);
  
  // Get the diamond cut facet
  const diamond = await ethers.getContractAt("IDiamondCut", OLD_DIAMOND);
  
  // Deploy new SettingsFacet
  console.log("\nDeploying new SettingsFacet...");
  const SettingsFacet = await ethers.getContractFactory("SettingsFacet");
  const settingsFacet = await SettingsFacet.deploy();
  const deployTx = settingsFacet.deploymentTransaction();
  if (deployTx) {
    console.log("  Deploy TX:", deployTx.hash);
    await deployTx.wait(2);
  }
  const settingsFacetAddress = await settingsFacet.getAddress();
  console.log("  New SettingsFacet:", settingsFacetAddress);
  
  // Get selectors for recover functions only
  const recoverETHSelector = settingsFacet.interface.getFunction("recoverETHFromCabal")!.selector;
  const recoverTokensSelector = settingsFacet.interface.getFunction("recoverTokensFromCabal")!.selector;
  
  console.log("\n  Adding recovery functions:");
  console.log("  - recoverETHFromCabal:", recoverETHSelector);
  console.log("  - recoverTokensFromCabal:", recoverTokensSelector);
  
  // Diamond cut - just ADD the new functions
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const cut = [{
    facetAddress: settingsFacetAddress,
    action: FacetCutAction.Add,
    functionSelectors: [recoverETHSelector, recoverTokensSelector]
  }];
  
  console.log("\n  Executing diamond cut...");
  const tx = await diamond.diamondCut(cut, ethers.ZeroAddress, "0x");
  console.log("  TX:", tx.hash);
  await tx.wait();
  console.log("  ✅ Diamond upgraded!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
