const { ethers } = require("hardhat");

const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43";

async function main() {
  console.log("Checking Universal Router functions...\n");
  
  // Try calling different function selectors
  const router = new ethers.Contract(UNIVERSAL_ROUTER, [
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
    "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
  ], ethers.provider);
  
  // Check the execute selector
  const iface = new ethers.Interface([
    "function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable",
    "function execute(bytes calldata commands, bytes[] calldata inputs) external payable",
  ]);
  
  console.log("execute(commands, inputs, deadline) selector:", 
    iface.getFunction("execute(bytes,bytes[],uint256)")?.selector);
  console.log("execute(commands, inputs) selector:", 
    iface.getFunction("execute(bytes,bytes[])")?.selector);
  
  // The working transaction used selector 0x3593564c
  console.log("\nWorking tx uses selector: 0x3593564c");
  
  // Let's decode what 0x3593564c is
  const selector3593564c = "0x3593564c";
  console.log("\nChecking if 0x3593564c matches our functions...");
  
  const exec3 = iface.getFunction("execute(bytes,bytes[],uint256)")?.selector;
  const exec2 = iface.getFunction("execute(bytes,bytes[])")?.selector;
  
  console.log(`execute(bytes,bytes[],uint256) = ${exec3} (matches: ${exec3 === selector3593564c})`);
  console.log(`execute(bytes,bytes[]) = ${exec2} (matches: ${exec2 === selector3593564c})`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
