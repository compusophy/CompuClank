const { ethers } = require("hardhat");

const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
const UNIVERSAL_ROUTER = "0x4F63E5e685126e7f307f0Ae108F6Bd374f061219";

async function main() {
  console.log("Checking Universal Router being called...\n");
  
  // Check what Universal Router the SwapFacet constants point to
  // We need to check if the SwapFacet actually got upgraded
  
  const swapFacetCode = await ethers.provider.getCode(DIAMOND);
  console.log(`Diamond has code: ${swapFacetCode.length} bytes`);
  
  // Get the facet address for buyTokens
  const loupeABI = [
    "function facetAddress(bytes4 selector) view returns (address)"
  ];
  const loupe = new ethers.Contract(DIAMOND, loupeABI, ethers.provider);
  
  // buyTokens selector: 0x7975ce28
  const buyTokensSelector = "0x7975ce28";
  const facetAddress = await loupe.facetAddress(buyTokensSelector);
  console.log(`buyTokens facet address: ${facetAddress}`);
  
  // Check the code at that facet to see if it has the new router address
  const facetCode = await ethers.provider.getCode(facetAddress);
  console.log(`Facet code length: ${facetCode.length} bytes`);
  
  // Check if the new router address is in the code
  const newRouterHex = UNIVERSAL_ROUTER.toLowerCase().replace("0x", "");
  const oldRouterHex = "198EF79F1F515F02dFE9e3115eD9fC07183f02fC".toLowerCase();
  
  if (facetCode.toLowerCase().includes(newRouterHex)) {
    console.log(`✅ New router address (${UNIVERSAL_ROUTER}) FOUND in facet code`);
  } else {
    console.log(`❌ New router address NOT found in facet code`);
  }
  
  if (facetCode.toLowerCase().includes(oldRouterHex)) {
    console.log(`⚠️ OLD router address STILL in facet code!`);
  } else {
    console.log(`✅ Old router address not in facet code`);
  }
  
  // Let's also check for the action constants
  // SETTLE_ALL should be 0x0C = 12
  // TAKE_ALL should be 0x0F = 15
  // Old values were 0x0b = 11 and 0x0e = 14
  
  console.log("\n--- Checking latest deployed SwapFacet ---");
  const latestFacet = "0x265F5282D96641783144bAB248d616959Ba69FB1"; // From upgrade output
  const latestCode = await ethers.provider.getCode(latestFacet);
  console.log(`Latest facet (${latestFacet}) code length: ${latestCode.length} bytes`);
  
  if (latestCode.toLowerCase().includes(newRouterHex)) {
    console.log(`✅ New router in latest facet`);
  } else {
    console.log(`❌ New router NOT in latest facet`);
  }
  
  console.log(`\nDiamond points to facet: ${facetAddress}`);
  console.log(`Latest deployed facet: ${latestFacet}`);
  console.log(`Are they the same? ${facetAddress.toLowerCase() === latestFacet.toLowerCase()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
