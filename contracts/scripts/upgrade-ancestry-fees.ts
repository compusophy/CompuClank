import { ethers } from "hardhat";

const DIAMOND_ADDRESS = process.env.CABAL_DIAMOND_ADDRESS || "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

// Diamond facet cut action
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading facets for ancestry fees with account:", deployer.address);
  console.log("Target Diamond:", DIAMOND_ADDRESS);

  // Deploy all updated facets
  console.log("\n=== Deploying New Facets ===\n");
  
  const CabalCreationFacet = await ethers.getContractFactory("CabalCreationFacet");
  const cabalCreationFacet = await CabalCreationFacet.deploy();
  await cabalCreationFacet.waitForDeployment();
  console.log("CabalCreationFacet deployed to:", await cabalCreationFacet.getAddress());

  const ChildCreationFacet = await ethers.getContractFactory("ChildCreationFacet");
  const childCreationFacet = await ChildCreationFacet.deploy();
  await childCreationFacet.waitForDeployment();
  console.log("ChildCreationFacet deployed to:", await childCreationFacet.getAddress());

  const StakingFacet = await ethers.getContractFactory("StakingFacet");
  const stakingFacet = await StakingFacet.deploy();
  await stakingFacet.waitForDeployment();
  console.log("StakingFacet deployed to:", await stakingFacet.getAddress());

  const GovernanceFacet = await ethers.getContractFactory("GovernanceFacet");
  const governanceFacet = await GovernanceFacet.deploy();
  await governanceFacet.waitForDeployment();
  console.log("GovernanceFacet deployed to:", await governanceFacet.getAddress());

  const ViewFacet = await ethers.getContractFactory("ViewFacet");
  const viewFacet = await ViewFacet.deploy();
  await viewFacet.waitForDeployment();
  console.log("ViewFacet deployed to:", await viewFacet.getAddress());

  const DelegationFacet = await ethers.getContractFactory("DelegationFacet");
  const delegationFacet = await DelegationFacet.deploy();
  await delegationFacet.waitForDeployment();
  console.log("DelegationFacet deployed to:", await delegationFacet.getAddress());

  // Get function selectors for each facet
  // CabalCreationFacet - removed claimTokens and getClaimable
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

  const childCreationSelectors = [
    childCreationFacet.interface.getFunction("voteCreateChild")!.selector,
    childCreationFacet.interface.getFunction("finalizeChildCreation")!.selector,
    childCreationFacet.interface.getFunction("getChildCreationVoteStatus")!.selector,
    childCreationFacet.interface.getFunction("hasVotedChildCreation")!.selector,
    childCreationFacet.interface.getFunction("getChildCreationVote")!.selector,
    childCreationFacet.interface.getFunction("adminResetChildCreationVoting")!.selector,
  ];

  const stakingSelectors = [
    stakingFacet.interface.getFunction("stake")!.selector,
    stakingFacet.interface.getFunction("stakeWithPermit")!.selector,
    stakingFacet.interface.getFunction("unstake")!.selector,
    stakingFacet.interface.getFunction("getStakedBalance")!.selector,
    stakingFacet.interface.getFunction("getVotingPower")!.selector,
    stakingFacet.interface.getFunction("getTotalStaked")!.selector,
    stakingFacet.interface.getFunction("getUserStakedCabals")!.selector,
  ];

  // Get all governance selectors by listing functions
  const governanceSelectors: string[] = [];
  governanceFacet.interface.forEachFunction((fn) => {
    governanceSelectors.push(fn.selector);
  });

  // Get all view selectors - note getUserPositions signature changed (no more claimed return)
  const viewSelectors: string[] = [];
  viewFacet.interface.forEachFunction((fn) => {
    viewSelectors.push(fn.selector);
  });

  // Get all delegation selectors
  const delegationSelectors: string[] = [];
  delegationFacet.interface.forEachFunction((fn) => {
    delegationSelectors.push(fn.selector);
  });

  console.log("\n=== Function Selectors ===");
  console.log("CabalCreationFacet:", cabalCreationSelectors.length, "functions");
  console.log("ChildCreationFacet:", childCreationSelectors.length, "functions");
  console.log("StakingFacet:", stakingSelectors.length, "functions");
  console.log("GovernanceFacet:", governanceSelectors.length, "functions");
  console.log("ViewFacet:", viewSelectors.length, "functions");
  console.log("DelegationFacet:", delegationSelectors.length, "functions");

  // Prepare diamond cut - Replace existing functions
  const diamondCut = [
    {
      facetAddress: await cabalCreationFacet.getAddress(),
      action: FacetCutAction.Replace,
      functionSelectors: cabalCreationSelectors,
    },
    {
      facetAddress: await childCreationFacet.getAddress(),
      action: FacetCutAction.Replace,
      functionSelectors: childCreationSelectors,
    },
    {
      facetAddress: await stakingFacet.getAddress(),
      action: FacetCutAction.Replace,
      functionSelectors: stakingSelectors,
    },
    {
      facetAddress: await governanceFacet.getAddress(),
      action: FacetCutAction.Replace,
      functionSelectors: governanceSelectors,
    },
    {
      facetAddress: await viewFacet.getAddress(),
      action: FacetCutAction.Replace,
      functionSelectors: viewSelectors,
    },
    {
      facetAddress: await delegationFacet.getAddress(),
      action: FacetCutAction.Replace,
      functionSelectors: delegationSelectors,
    },
  ];

  // Get diamond contract
  const diamond = await ethers.getContractAt(
    ["function diamondCut((address facetAddress, uint8 action, bytes4[] functionSelectors)[] calldata _diamondCut, address _init, bytes calldata _calldata) external"],
    DIAMOND_ADDRESS
  );

  console.log("\n=== Executing Diamond Cut ===\n");
  const tx = await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x");
  console.log("Transaction hash:", tx.hash);
  await tx.wait();
  console.log("Diamond cut complete!");

  console.log("\n=== Upgrade Summary ===");
  console.log("CabalCreationFacet:", await cabalCreationFacet.getAddress());
  console.log("ChildCreationFacet:", await childCreationFacet.getAddress());
  console.log("StakingFacet:", await stakingFacet.getAddress());
  console.log("GovernanceFacet:", await governanceFacet.getAddress());
  console.log("ViewFacet:", await viewFacet.getAddress());
  console.log("DelegationFacet:", await delegationFacet.getAddress());
  console.log("Diamond:", DIAMOND_ADDRESS);
  
  console.log("\n=== Changes Applied ===");
  console.log("1. maxLpFee reduced from 10% to 1%");
  console.log("2. Ancestry fees: 1% to each ancestor at launch");
  console.log("3. Trading fees: 1% to each ancestor via locker config");
  console.log("4. Auto-staking: contributor tokens now auto-staked at launch");
  console.log("5. Removed: claimTokens() - use unstake() instead");
  console.log("6. Removed: hasClaimed() - no longer needed");
  console.log("7. Added: governanceStartsAt field for 10 min delay after launch");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
