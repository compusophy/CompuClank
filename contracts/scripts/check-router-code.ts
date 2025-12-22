const { ethers } = require("hardhat");

async function main() {
  const routers = [
    { name: "New Router (in SwapFacet)", addr: "0x4F63E5e685126e7f307f0Ae108F6Bd374f061219" },
    { name: "Old Router", addr: "0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC" },
    { name: "Original Uniswap V4 Router", addr: "0x6fF5693b99212Da76ad316178A184AB56D299b43" },
  ];
  
  for (const r of routers) {
    const code = await ethers.provider.getCode(r.addr);
    console.log(`${r.name}: ${code.length} bytes at ${r.addr}`);
    if (code.length < 100) {
      console.log(`  Code: ${code}`);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
