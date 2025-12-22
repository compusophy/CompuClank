const { ethers } = require("hardhat");

const TOKEN_ADDRESS = "0xb47a90E00149249eeb05D2a29659c7494de63275";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  console.log("Checking Token:", TOKEN_ADDRESS);
  
  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, ethers.provider);
  
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    const decimals = await token.decimals();
    
    console.log("\nToken Info:");
    console.log("  Name:", name);
    console.log("  Symbol:", symbol);
    console.log("  Decimals:", decimals);
    console.log("  Total Supply:", ethers.formatUnits(totalSupply, decimals));
    
    if (totalSupply === 0n) {
      console.log("\n⚠️ Token has zero supply - likely not launched!");
    } else {
      console.log("\n✅ Token has supply");
    }
  } catch (e: any) {
    console.log("\n❌ Error reading token:", e.message);
    console.log("Token might not be deployed!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
