import { ethers } from "hardhat";

// Diamond address on Base
const DIAMOND_ADDRESS = "0x2c37109E089a274fD3e7029a4F379558d44937e3";

// FacetCutAction enum
const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

// All selectors (all now exist, so we REPLACE them all)
const ALL_SELECTORS = [
  "buyTokens(uint256,uint256)",
  "sellTokens(uint256,uint256,uint256)",
  "quoteBuy(uint256,uint256)",
  "quoteSell(uint256,uint256)",
  "getPoolKey(uint256)",
  "hasActivePool(uint256)",
  "setCabalToken(uint256,address)",
  "buyTokensWithHookData(uint256,uint256,bytes)",
  "sellTokensWithHookData(uint256,uint256,uint256,bytes)",
];

async function main() {
  console.log("Deploying SwapFacet...");
  
  const SwapFacet = await ethers.getContractFactory("SwapFacet");
  const swapFacet = await SwapFacet.deploy();
  await swapFacet.waitForDeployment();
  
  const swapFacetAddress = await swapFacet.getAddress();
  console.log("SwapFacet deployed to:", swapFacetAddress);

  // Get all selectors to replace
  const allSelectors = ALL_SELECTORS.map(sig => 
    ethers.id(sig).slice(0, 10)
  );
  console.log("Selectors to REPLACE:", allSelectors);

  // Prepare diamond cut - Replace all functions
  const diamondCut = [
    {
      facetAddress: swapFacetAddress,
      action: FacetCutAction.Replace, 
      functionSelectors: allSelectors,
    },
  ];

  // Get Diamond contract
  const diamond = await ethers.getContractAt("IDiamondCut", DIAMOND_ADDRESS);
  
  console.log("Executing diamond cut...");
  const tx = await diamond.diamondCut(diamondCut, ethers.ZeroAddress, "0x");
  await tx.wait();
  
  console.log("Diamond cut complete! SwapFacet upgraded.");
  console.log("\nUpdated functions:");
  console.log("  - buyTokens(uint256 cabalId, uint256 minAmountOut) payable");
  console.log("  - sellTokens(uint256 cabalId, uint256 tokenAmount, uint256 minEthOut)");
  console.log("  - buyTokensWithHookData(...) [NEW]");
  console.log("  - sellTokensWithHookData(...) [NEW]");
}

function getSelectors(contractInterface: ethers.Interface): string[] {
  const selectors: string[] = [];
  
  // Get all function fragments
  contractInterface.forEachFunction((func) => {
    // Skip receive function
    if (func.name !== "receive") {
      selectors.push(func.selector);
    }
  });
  
  return selectors;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
