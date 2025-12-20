import { ethers } from "hardhat";
import { Contract } from "ethers";

// Known addresses on Base mainnet
const CLANKER_FACTORY = "0x2a787b2362021cc3cee5d6e15f80e7ee89800788";
const CLANKER_FEE_LOCKER = "0x0000000000000000000000000000000000000000"; // TODO: Get actual address
const ERC6551_REGISTRY = "0x000000006551c19487814612e58FE06813775758"; // Official ERC6551 Registry
const WETH = "0x4200000000000000000000000000000000000006"; // Base WETH

// Helper to wait between transactions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying CABAL contracts with account:", deployer.address);

  // 1. Deploy DiamondCutFacet
  console.log("\n1. Deploying DiamondCutFacet...");
  const DiamondCutFacet = await ethers.getContractFactory("DiamondCutFacet");
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  console.log("   DiamondCutFacet:", await diamondCutFacet.getAddress());
  await delay(3000);

  // 2. Deploy Diamond
  console.log("\n2. Deploying Diamond...");
  const Diamond = await ethers.getContractFactory("Diamond");
  const diamond = await Diamond.deploy(deployer.address, await diamondCutFacet.getAddress());
  await diamond.waitForDeployment();
  const diamondAddress = await diamond.getAddress();
  console.log("   Diamond:", diamondAddress);
  await delay(3000);

  // 3. Deploy CabalNFT (owned by Diamond)
  console.log("\n3. Deploying CabalNFT...");
  const CabalNFT = await ethers.getContractFactory("CabalNFT");
  const cabalNFT = await CabalNFT.deploy(diamondAddress);
  await cabalNFT.waitForDeployment();
  console.log("   CabalNFT:", await cabalNFT.getAddress());
  await delay(3000);

  // 4. Deploy CabalTBA implementation
  console.log("\n4. Deploying CabalTBA implementation...");
  const CabalTBA = await ethers.getContractFactory("CabalTBA");
  const cabalTBA = await CabalTBA.deploy();
  await cabalTBA.waitForDeployment();
  console.log("   CabalTBA:", await cabalTBA.getAddress());
  await delay(3000);

  // 5. Deploy all facets
  console.log("\n5. Deploying facets...");
  
  const facetNames = [
    "DiamondLoupeFacet",
    "OwnershipFacet",
    "CabalCreationFacet",
    "StakingFacet",
    "DelegationFacet",
    "GovernanceFacet",
    "TreasuryFacet",
    "SettingsFacet",
    "ViewFacet",
  ];

  const facets: { name: string; address: string; contract: Contract }[] = [];

  for (const name of facetNames) {
    const Facet = await ethers.getContractFactory(name);
    const facet = await Facet.deploy();
    await facet.waitForDeployment();
    const address = await facet.getAddress();
    facets.push({ name, address, contract: facet });
    console.log(`   ${name}: ${address}`);
    await delay(2000);
  }

  // 6. Add facets to Diamond
  console.log("\n6. Adding facets to Diamond...");
  
  const diamondCut = await ethers.getContractAt("IDiamondCut", diamondAddress);
  
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  
  const cuts = [];
  
  for (const facet of facets) {
    const selectors = getSelectors(facet.contract);
    cuts.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: selectors,
    });
    console.log(`   Adding ${facet.name} with ${selectors.length} functions`);
  }

  const tx = await diamondCut.diamondCut(cuts, ethers.ZeroAddress, "0x");
  await tx.wait();
  console.log("   Facets added successfully!");
  await delay(5000);

  // 7. Initialize addresses
  console.log("\n7. Initializing contract addresses...");
  const settingsFacet = await ethers.getContractAt("SettingsFacet", diamondAddress);
  
  const initTx = await settingsFacet.initializeAddresses(
    await cabalNFT.getAddress(),
    await cabalTBA.getAddress(),
    ERC6551_REGISTRY,
    CLANKER_FACTORY,
    CLANKER_FEE_LOCKER,
    WETH
  );
  await initTx.wait();
  console.log("   Addresses initialized!");

  // 8. Summary
  console.log("\n========================================");
  console.log("CABAL Deployment Complete!");
  console.log("========================================");
  console.log("\nContract Addresses:");
  console.log(`  Diamond (main):     ${diamondAddress}`);
  console.log(`  CabalNFT:           ${await cabalNFT.getAddress()}`);
  console.log(`  CabalTBA (impl):    ${await cabalTBA.getAddress()}`);
  console.log("\nFacets:");
  for (const facet of facets) {
    console.log(`  ${facet.name}: ${facet.address}`);
  }
  console.log("\nExternal Addresses:");
  console.log(`  ERC6551 Registry:   ${ERC6551_REGISTRY}`);
  console.log(`  Clanker Factory:    ${CLANKER_FACTORY}`);
  console.log(`  WETH:               ${WETH}`);
  console.log("\n========================================");
  console.log("\nAdd to .env.local:");
  console.log(`CABAL_DIAMOND_ADDRESS=${diamondAddress}`);
}

// Helper to get function selectors from contract
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
