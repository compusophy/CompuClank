import { ethers } from "hardhat";
import * as fs from "fs";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";

async function main() {
  // Get on-chain bytecode
  const onChainCode = await ethers.provider.getCode(DIAMOND_ADDRESS);
  console.log("On-chain bytecode length:", onChainCode.length, "chars (", (onChainCode.length - 2) / 2, "bytes)");
  
  // Get artifact bytecode
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/cabal/diamond/Diamond.sol/Diamond.json", "utf8"));
  console.log("Artifact deployedBytecode length:", artifact.deployedBytecode.length, "chars");
  
  // Compare
  console.log("\nOn-chain bytecode:");
  console.log(onChainCode);
  
  console.log("\nArtifact deployed bytecode (first 600 chars):");
  console.log(artifact.deployedBytecode.slice(0, 600));
  
  // Check if they match
  if (onChainCode === artifact.deployedBytecode) {
    console.log("\n✅ Bytecodes MATCH");
  } else {
    console.log("\n❌ Bytecodes DO NOT match");
    console.log("On-chain is:", (onChainCode.length - 2) / 2, "bytes");
    console.log("Artifact is:", (artifact.deployedBytecode.length - 2) / 2, "bytes");
    
    // Find first difference
    for (let i = 0; i < Math.min(onChainCode.length, artifact.deployedBytecode.length); i++) {
      if (onChainCode[i] !== artifact.deployedBytecode[i]) {
        console.log("First difference at position", i);
        console.log("On-chain:", onChainCode.slice(Math.max(0, i - 10), i + 20));
        console.log("Artifact:", artifact.deployedBytecode.slice(Math.max(0, i - 10), i + 20));
        break;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
