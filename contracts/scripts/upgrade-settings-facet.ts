import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// Facet cut action
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Upgrading SettingsFacet with account:", signer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // Deploy new SettingsFacet
  console.log("\n--- Deploying new SettingsFacet ---");
  const SettingsFacet = await ethers.getContractFactory("SettingsFacet");
  const settingsFacet = await SettingsFacet.deploy();
  const deployTx = settingsFacet.deploymentTransaction();
  if (deployTx) {
    console.log("   Deploy TX:", deployTx.hash);
    await deployTx.wait(2); // Wait for 2 confirmations
  }
  const settingsFacetAddress = await settingsFacet.getAddress();
  console.log("   New SettingsFacet:", settingsFacetAddress);
  
  // Verify contract has code
  const code = await ethers.provider.getCode(settingsFacetAddress);
  console.log("   Contract code length:", code.length);
  if (code === "0x") {
    throw new Error("Contract has no code!");
  }

  // Get selectors
  const settingsSelectors = Object.keys(settingsFacet.interface.fragments)
    .filter((key) => settingsFacet.interface.fragments[parseInt(key)].type === "function")
    .map((key) => settingsFacet.interface.getFunction(settingsFacet.interface.fragments[parseInt(key)].name)?.selector)
    .filter(Boolean) as string[];

  console.log("   Selectors:", settingsSelectors.length);

  // Get diamond cut facet
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);

  // Check which selectors already exist
  const diamondLoupe = await ethers.getContractAt("IDiamondLoupe", DIAMOND_ADDRESS);
  const existingFacets = await diamondLoupe.facets();
  const existingSelectors = new Set<string>();
  for (const facet of existingFacets) {
    for (const sel of facet.functionSelectors) {
      existingSelectors.add(sel);
    }
  }

  // Separate into replace and add
  const replaceSelectors: string[] = [];
  const addSelectors: string[] = [];
  for (const sel of settingsSelectors) {
    if (existingSelectors.has(sel)) {
      replaceSelectors.push(sel);
    } else {
      addSelectors.push(sel);
    }
  }

  console.log("   Replace:", replaceSelectors.length, "Add:", addSelectors.length);

  // Build cuts
  const cuts = [];
  if (replaceSelectors.length > 0) {
    cuts.push({
      facetAddress: settingsFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: replaceSelectors,
    });
  }
  if (addSelectors.length > 0) {
    cuts.push({
      facetAddress: settingsFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: addSelectors,
    });
  }

  // Execute cut
  console.log("   Executing diamond cut...");
  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  console.log("   TX:", tx.hash);
  await tx.wait();
  console.log("   ✅ SettingsFacet upgraded!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
