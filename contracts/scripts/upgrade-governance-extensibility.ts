import { ethers } from "hardhat";

const DIAMOND_ADDRESS = process.env.CABAL_DIAMOND_ADDRESS || "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// Diamond facet cut action
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading facets with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // Deploy new CabalCreationFacet
  console.log("\nDeploying new CabalCreationFacet...");
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const cabalCreationFacet = await CabalCreationFacet.deploy();
  await cabalCreationFacet.waitForDeployment();
  const cabalCreationFacetAddress = await cabalCreationFacet.getAddress();
  console.log("CabalCreationFacet deployed to:", cabalCreationFacetAddress);

  // Deploy new ChildCreationFacet
  console.log("\nDeploying new ChildCreationFacet...");
  const ChildCreationFacet = await ethers.getContractFactory("ChildCreationFacet");
  const childCreationFacet = await ChildCreationFacet.deploy();
  await childCreationFacet.waitForDeployment();
  const childCreationFacetAddress = await childCreationFacet.getAddress();
  console.log("ChildCreationFacet deployed to:", childCreationFacetAddress);

  // Deploy new GovernanceFacet
  console.log("\nDeploying new GovernanceFacet...");
  const GovernanceFacet = await ethers.getContractFactory("GovernanceFacet");
  const governanceFacet = await GovernanceFacet.deploy();
  await governanceFacet.waitForDeployment();
  const governanceFacetAddress = await governanceFacet.getAddress();
  console.log("GovernanceFacet deployed to:", governanceFacetAddress);

  // Get function selectors for CabalCreationFacet
  // Note: claimTokens and getClaimable were removed - not included
  const cabalCreationSelectors = [
    cabalCreationFacet.interface.getFunction("createChildCabal")!.selector,
    cabalCreationFacet.interface.getFunction("contribute")!.selector,
    cabalCreationFacet.interface.getFunction("voteLaunch")!.selector,
    cabalCreationFacet.interface.getFunction("finalizeCabal")!.selector,
    cabalCreationFacet.interface.getFunction("adminResetLaunchVoting")!.selector,
    cabalCreationFacet.interface.getFunction("getContributors")!.selector,
    cabalCreationFacet.interface.getFunction("getLaunchVoteStatus")!.selector,
    cabalCreationFacet.interface.getFunction("hasVotedLaunch")!.selector,
    cabalCreationFacet.interface.getFunction("getLaunchVote")!.selector,
  ];

  // Get function selectors for ChildCreationFacet
  const childCreationSelectors = [
    childCreationFacet.interface.getFunction("voteCreateChild")!.selector,
    childCreationFacet.interface.getFunction("finalizeChildCreation")!.selector,
    childCreationFacet.interface.getFunction("getChildCreationVoteStatus")!.selector,
    childCreationFacet.interface.getFunction("hasVotedChildCreation")!.selector,
    childCreationFacet.interface.getFunction("getChildCreationVote")!.selector,
    childCreationFacet.interface.getFunction("adminResetChildCreationVoting")!.selector,
  ];

  // Get function selectors for GovernanceFacet - includes NEW functions
  // Iterate over all functions in the interface
  const governanceSelectors: string[] = [];
  governanceFacet.interface.forEachFunction((fn) => {
    governanceSelectors.push(fn.selector);
  });

  console.log("\nCabalCreationFacet selectors:", cabalCreationSelectors.length, "functions");
  console.log("ChildCreationFacet selectors:", childCreationSelectors.length, "functions");
  console.log("GovernanceFacet selectors:", governanceSelectors.length, "functions");

  // Split governance selectors into Replace and Add
  // New functions: proposeSellTokens, proposeStake, proposeUnstake, proposeVote, proposeDelegate
  const newGovernanceFunctions = [
    "proposeSellTokens",
    "proposeStake",
    "proposeUnstake",
    "proposeVote",
    "proposeDelegate",
  ];
  
  const newGovernanceSelectors = newGovernanceFunctions.map(fn => 
    governanceFacet.interface.getFunction(fn)!.selector
  );
  
  const existingGovernanceSelectors = governanceSelectors.filter(
    sel => !newGovernanceSelectors.includes(sel)
  );

  console.log("New governance selectors to ADD:", newGovernanceSelectors.length);
  console.log("Existing governance selectors to REPLACE:", existingGovernanceSelectors.length);

  // Prepare diamond cut
  const diamondCut = [
    {
      facetAddress: cabalCreationFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: cabalCreationSelectors,
    },
    {
      facetAddress: childCreationFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: childCreationSelectors,
    },
    {
      facetAddress: governanceFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: existingGovernanceSelectors,
    },
    {
      facetAddress: governanceFacetAddress,
      action: FacetCutAction.Add,
      functionSelectors: newGovernanceSelectors,
    },
  ];

  // Get diamond contract
  const diamond = await ethers.getContractAt(
    ["function diamondCut((address facetAddress, uint8 action, bytes4[] functionSelectors)[] calldata _diamondCut, address _init, bytes calldata _calldata) external"],
    DIAMOND_ADDRESS
  );

  // Execute diamond cut
  console.log("\nExecuting diamond cut...");
  const tx = await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x");
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("Diamond cut executed successfully!");

  console.log("\n=== Summary ===");
  console.log("CabalCreationFacet:", cabalCreationFacetAddress);
  console.log("ChildCreationFacet:", childCreationFacetAddress);
  console.log("GovernanceFacet:", governanceFacetAddress);
  console.log("Changes:");
  console.log("  - Added MAX_CHILDREN=8 limit to child creation");
  console.log("  - Added hierarchical naming for new-scheme parents");
  console.log("  - Added proposeSellTokens preset");
  console.log("  - Added proposeStake preset");
  console.log("  - Added proposeUnstake preset");
  console.log("  - Added proposeVote preset");
  console.log("  - Added proposeDelegate preset");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
