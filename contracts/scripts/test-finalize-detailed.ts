import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const CABAL_ID = 3;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Testing detailed finalizeCabal");
  
  // Get the TBA
  const tbaAddress = "0xA09aAAfa198639b4330B8a3AFEE782251b1978de";
  const cabalTBA = await ethers.getContractAt("CabalTBA", tbaAddress);
  
  // Test 1: Can TBA receive ETH?
  console.log("\n=== Test 1: ETH transfers ===");
  
  // Get parent and root TBAs
  const viewFacet = await ethers.getContractAt("ViewFacet", DIAMOND_ADDRESS);
  const cabal1 = await viewFacet.getCabal(1);
  const cabal0 = await viewFacet.getCabal(0);
  
  console.log("CABAL0 TBA:", cabal0.tbaAddress);
  console.log("CABAL1 TBA:", cabal1.tbaAddress);
  console.log("CABAL3 TBA:", tbaAddress);
  
  // Check if TBAs are valid contracts
  const code0 = await ethers.provider.getCode(cabal0.tbaAddress);
  const code1 = await ethers.provider.getCode(cabal1.tbaAddress);
  const code3 = await ethers.provider.getCode(tbaAddress);
  
  console.log("CABAL0 TBA has code:", code0.length > 2);
  console.log("CABAL1 TBA has code:", code1.length > 2);
  console.log("CABAL3 TBA has code:", code3.length > 2);
  
  // Test 2: Check Clanker factory
  console.log("\n=== Test 2: Clanker Factory ===");
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const addresses = await settingsFacet.getContractAddresses();
  const clankerFactory = addresses[3]; // clankerFactory is 4th
  console.log("Clanker Factory:", clankerFactory);
  
  const factoryCode = await ethers.provider.getCode(clankerFactory);
  console.log("Factory has code:", factoryCode.length > 2);
  
  // Test 3: Check if we can estimate gas for a simpler call
  console.log("\n=== Test 3: Simple Diamond call ===");
  const cabalFacet = await ethers.getContractAt("CabalCreationFacet", DIAMOND_ADDRESS);
  try {
    const status = await cabalFacet.getLaunchVoteStatus(CABAL_ID);
    console.log("getLaunchVoteStatus works, majorityMet:", status[4]);
  } catch (e: any) {
    console.log("getLaunchVoteStatus failed:", e.message);
  }
  
  // Test 4: Check ancestor chain
  console.log("\n=== Test 4: Ancestor chain ===");
  // For CABAL3 (child of CABAL1, grandchild of CABAL0):
  // ancestors should be [CABAL1 TBA, CABAL0 TBA]
  // After consolidation, root should be consolidated with protocol fee
  // So locker recipients should be:
  // [CABAL3 TBA (97%), CABAL0 TBA (2% consolidated), CABAL1 TBA (1%)]
  console.log("Expected locker recipients:");
  console.log("  - CABAL3 TBA (97%):", tbaAddress);
  console.log("  - CABAL0 TBA (2% = 1% protocol + 1% ancestor):", cabal0.tbaAddress);
  console.log("  - CABAL1 TBA (1% ancestor):", cabal1.tbaAddress);
  console.log("Total recipients: 3");
  
  // Test 5: Check the CabalCreation facet code
  console.log("\n=== Test 5: Current facet version ===");
  // Let's see if finalizeCabal even starts
  // We'll try calling each step manually
  
  // First, verify phase is Presale
  const cabal3 = await viewFacet.getCabal(CABAL_ID);
  console.log("Phase:", cabal3.phase.toString());
  console.log("Total raised:", ethers.formatEther(cabal3.totalRaised));
  console.log("Launch approved at:", cabal3.launchApprovedAt?.toString() || "not set");
  
  console.log("\n=== Conclusion ===");
  console.log("The revert is happening inside the Clanker factory call.");
  console.log("This could be due to:");
  console.log("1. Clanker rejecting the deployment config");
  console.log("2. Invalid pool/locker/mev parameters");
  console.log("3. Token name/symbol already exists");
  console.log("4. Insufficient ETH sent with the call");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
