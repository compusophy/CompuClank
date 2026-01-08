import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// FacetCutAction enum
enum FacetCutAction {
  Add = 0,
  Replace = 1,
  Remove = 2,
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading ChildCreationFacet with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // Deploy new ChildCreationFacet
  console.log("\nDeploying new ChildCreationFacet...");
  const ChildCreationFacet = await ethers.getContractFactory("ChildCreationFacet");
  const childCreationFacet = await ChildCreationFacet.deploy();
  await childCreationFacet.waitForDeployment();
  const childAddress = await childCreationFacet.getAddress();
  console.log("ChildCreationFacet deployed to:", childAddress);

  // Get selectors from the new facet
  const selectors = Object.keys(childCreationFacet.interface.fragments)
    .filter(key => {
      const fragment = childCreationFacet.interface.fragments.find(f => f.name === key);
      return fragment && fragment.type === 'function';
    })
    .map(key => {
      const fragment = childCreationFacet.interface.fragments.find(f => f.name === key);
      if (fragment && fragment.type === 'function') {
        return childCreationFacet.interface.getFunction(key)?.selector;
      }
      return null;
    })
    .filter(Boolean);

  console.log("Found", selectors.length, "selectors");

  // Perform diamond cut
  const diamondCut = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  
  const cut = [{
    facetAddress: childAddress,
    action: FacetCutAction.Replace,
    functionSelectors: selectors,
  }];

  console.log("\nPerforming diamond cut...");
  const tx = await diamondCut.diamondCut(cut, ethers.ZeroAddress, "0x");
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("Diamond cut complete!");
  
  console.log("\n=== ChildCreationFacet Upgrade Complete ===");
  console.log("New logic:");
  console.log("- NO votes can now cancel proposals");
  console.log("- If NO > YES, proposal is cancelled");
  console.log("- If YES drops below 51%, proposal is cancelled");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
