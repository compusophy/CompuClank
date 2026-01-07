import { ethers } from "hardhat";

const DIAMOND_ADDRESS = process.env.CABAL_DIAMOND_ADDRESS || "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// Diamond facet cut action
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading facets with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // Deploy new ChildCreationFacet
  console.log("\nDeploying new ChildCreationFacet...");
  const ChildCreationFacet = await ethers.getContractFactory("ChildCreationFacet");
  const childCreationFacet = await ChildCreationFacet.deploy();
  await childCreationFacet.waitForDeployment();
  const childCreationFacetAddress = await childCreationFacet.getAddress();
  console.log("ChildCreationFacet deployed to:", childCreationFacetAddress);

  // Deploy new StakingFacet
  console.log("\nDeploying new StakingFacet...");
  const StakingFacet = await ethers.getContractFactory("StakingFacet");
  const stakingFacet = await StakingFacet.deploy();
  await stakingFacet.waitForDeployment();
  const stakingFacetAddress = await stakingFacet.getAddress();
  console.log("StakingFacet deployed to:", stakingFacetAddress);

  // Deploy new CabalCreationFacet
  console.log("\nDeploying new CabalCreationFacet...");
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const cabalCreationFacet = await CabalCreationFacet.deploy();
  await cabalCreationFacet.waitForDeployment();
  const cabalCreationFacetAddress = await cabalCreationFacet.getAddress();
  console.log("CabalCreationFacet deployed to:", cabalCreationFacetAddress);

  // Get function selectors for ChildCreationFacet - all functions to REPLACE
  const childCreationSelectors = [
    childCreationFacet.interface.getFunction("voteCreateChild")!.selector,
    childCreationFacet.interface.getFunction("finalizeChildCreation")!.selector,
    childCreationFacet.interface.getFunction("getChildCreationVoteStatus")!.selector,
    childCreationFacet.interface.getFunction("hasVotedChildCreation")!.selector,
    childCreationFacet.interface.getFunction("getChildCreationVote")!.selector,
    childCreationFacet.interface.getFunction("adminResetChildCreationVoting")!.selector,
  ];

  // Get function selectors for StakingFacet
  const stakingSelectors = [
    stakingFacet.interface.getFunction("stake")!.selector,
    stakingFacet.interface.getFunction("stakeWithPermit")!.selector,
    stakingFacet.interface.getFunction("unstake")!.selector,
    stakingFacet.interface.getFunction("getStakedBalance")!.selector,
    stakingFacet.interface.getFunction("getVotingPower")!.selector,
    stakingFacet.interface.getFunction("getTotalStaked")!.selector,
    stakingFacet.interface.getFunction("getUserStakedCabals")!.selector,
  ];

  // Get function selectors for CabalCreationFacet - all functions to REPLACE
  const cabalCreationSelectors = [
    cabalCreationFacet.interface.getFunction("createChildCabal")!.selector,
    cabalCreationFacet.interface.getFunction("contribute")!.selector,
    cabalCreationFacet.interface.getFunction("voteLaunch")!.selector,
    cabalCreationFacet.interface.getFunction("finalizeCabal")!.selector,
    cabalCreationFacet.interface.getFunction("claimTokens")!.selector,
    cabalCreationFacet.interface.getFunction("adminResetLaunchVoting")!.selector,
    cabalCreationFacet.interface.getFunction("getClaimable")!.selector,
    cabalCreationFacet.interface.getFunction("getContributors")!.selector,
    cabalCreationFacet.interface.getFunction("getLaunchVoteStatus")!.selector,
    cabalCreationFacet.interface.getFunction("hasVotedLaunch")!.selector,
    cabalCreationFacet.interface.getFunction("getLaunchVote")!.selector,
  ];

  console.log("\nChildCreationFacet selectors:", childCreationSelectors);
  console.log("StakingFacet selectors:", stakingSelectors);
  console.log("CabalCreationFacet selectors:", cabalCreationSelectors);

  // Prepare diamond cut - all Replace since functions already exist
  const diamondCut = [
    {
      facetAddress: childCreationFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: childCreationSelectors,
    },
    {
      facetAddress: stakingFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: stakingSelectors,
    },
    {
      facetAddress: cabalCreationFacetAddress,
      action: FacetCutAction.Replace,
      functionSelectors: cabalCreationSelectors,
    },
  ];

  // Get diamond contract
  const diamond = await ethers.getContractAt(
    ["function diamondCut((address facetAddress, uint8 action, bytes4[] functionSelectors)[] calldata _diamondCut, address _init, bytes calldata _calldata) external"],
    DIAMOND_ADDRESS
  );

  console.log("\nExecuting diamond cut to replace ChildCreationFacet and StakingFacet...");
  const tx = await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x");
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Diamond cut complete!");

  console.log("\n=== Upgrade Summary ===");
  console.log("ChildCreationFacet:", childCreationFacetAddress);
  console.log("StakingFacet:", stakingFacetAddress);
  console.log("CabalCreationFacet:", cabalCreationFacetAddress);
  console.log("Diamond:", DIAMOND_ADDRESS);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
