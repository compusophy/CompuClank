const { ethers } = require("hardhat");

async function main() {
  const errorData = "0xd81b2f2e0000000000000000000000000000000000000000000000000000000000000000";
  const selector = errorData.slice(0, 10);
  
  console.log(`Error selector: ${selector}`);
  
  // Common Uniswap V4 errors
  const errors: Record<string, string> = {
    "0xd81b2f2e": "InvalidMsgValue()", // From Uniswap Universal Router
    "0x815e1d64": "InvalidAction(bytes4)",
    "0x7dc2f4e1": "CommandFailed(uint256,bytes)",
    "0x0a06c51c": "ExecutionFailed(uint256,bytes)",
    "0x08c379a0": "Error(string)",
    "0x4e487b71": "Panic(uint256)",
  };
  
  if (errors[selector]) {
    console.log(`Error: ${errors[selector]}`);
  } else {
    console.log("Unknown error selector");
  }
  
  // InvalidMsgValue means the ETH value sent doesn't match what's expected
  console.log("\nThis error typically means:");
  console.log("  - The msg.value doesn't match the wrapped amount");
  console.log("  - Or the WRAP_ETH command amount doesn't match what was sent");
  
  // Let me check the SwapFacet encoding
  console.log("\n=== Checking SwapFacet implementation ===");
  
  // The issue might be that when Diamond calls the router,
  // it needs to forward msg.value correctly
  console.log("The SwapFacet calls: IUniversalRouter(ROUTER).execute{value: amountIn}(...)");
  console.log("Where amountIn = msg.value");
  console.log("And WRAP_ETH input has (ROUTER, uint256(amountIn))");
  console.log("\nThe problem might be that we're sending ETH but expecting different behavior");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
