import { ethers } from "hardhat";

async function main() {
  const errorSelector = "0x23bba199";
  
  // Known error selectors
  const errors = [
    // CabalCreationFacet errors
    { name: "CabalNotInPresale", sig: "error CabalNotInPresale()" },
    { name: "CabalNotActive", sig: "error CabalNotActive()" },
    { name: "AlreadyClaimed", sig: "error AlreadyClaimed()" },
    { name: "NoContribution", sig: "error NoContribution()" },
    { name: "InsufficientCreationFee", sig: "error InsufficientCreationFee()" },
    { name: "InsufficientContribution", sig: "error InsufficientContribution()" },
    { name: "VoteUnchanged", sig: "error VoteUnchanged()" },
    { name: "LaunchMajorityNotMet", sig: "error LaunchMajorityNotMet()" },
    { name: "LaunchTimerNotElapsed", sig: "error LaunchTimerNotElapsed()" },
    { name: "TransferFailed", sig: "error TransferFailed()" },
    { name: "DeploymentFailed", sig: "error DeploymentFailed()" },
    { name: "GenesisNotInitialized", sig: "error GenesisNotInitialized()" },
    { name: "NotCalledViaDiamond", sig: "error NotCalledViaDiamond()" },
    { name: "InvalidParentCabal", sig: "error InvalidParentCabal()" },
    { name: "CabalClosed", sig: "error CabalClosed()" },
    // Clanker errors
    { name: "InvalidHook", sig: "error InvalidHook()" },
    { name: "InvalidLocker", sig: "error InvalidLocker()" },
    { name: "InvalidToken", sig: "error InvalidToken()" },
    { name: "InvalidPool", sig: "error InvalidPool()" },
    { name: "InvalidSender", sig: "error InvalidSender()" },
    { name: "InvalidRecipient", sig: "error InvalidRecipient()" },
    { name: "NotAuthorized", sig: "error NotAuthorized()" },
    { name: "AlreadyInitialized", sig: "error AlreadyInitialized()" },
  ];

  console.log("Looking for error selector:", errorSelector);
  
  for (const err of errors) {
    const iface = new ethers.Interface([err.sig]);
    const selector = iface.getError(err.name)?.selector;
    if (selector === errorSelector) {
      console.log("FOUND:", err.name);
      return;
    }
    console.log(`  ${err.name}: ${selector}`);
  }
  
  console.log("\nError selector not found in known errors.");
  console.log("This might be an error from the Clanker factory or other external contract.");
  
  // Try to look up common Clanker factory errors
  console.log("\nChecking Clanker factory interface...");
  const IClankerFactory = await ethers.getContractFactory("CabalCreationFacet");
  
  // Log all error selectors from the contract
  for (const fragment of IClankerFactory.interface.fragments) {
    if (fragment.type === "error") {
      const selector = IClankerFactory.interface.getError(fragment.name)?.selector;
      console.log(`  ${fragment.name}: ${selector}`);
      if (selector === errorSelector) {
        console.log("  ^^^ MATCH!");
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
