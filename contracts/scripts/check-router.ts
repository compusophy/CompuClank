const { ethers } = require("hardhat");

async function main() {
  const ROUTER_V1 = "0x6fF5693b99212Da76ad316178A184AB56D299b43";
  const ROUTER_V2 = "0x198EF79F1F515F02dFE9e3115eD9fC07183f02fC";
  
  console.log("Checking Routers...\n");
  
  const code1 = await ethers.provider.getCode(ROUTER_V1);
  console.log(`Router V1 (${ROUTER_V1}): ${code1.length} bytes`);
  
  const code2 = await ethers.provider.getCode(ROUTER_V2);
  console.log(`Router V2 (${ROUTER_V2}): ${code2.length} bytes`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
