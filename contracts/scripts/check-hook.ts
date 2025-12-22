const { ethers } = require("hardhat");

async function main() {
  const HOOK_ADDRESS = "0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC";
  
  console.log(`Checking hook address: ${HOOK_ADDRESS}\n`);
  
  // Check if it's a contract
  const code = await ethers.provider.getCode(HOOK_ADDRESS);
  
  if (code === "0x") {
    console.log("❌ This is NOT a contract - it's an EOA or empty address!");
  } else {
    console.log(`✅ This is a contract with ${code.length} bytes of code`);
  }
  
  // Check the official Clanker hooks
  const OFFICIAL_HOOKS = [
    { name: "ClankerHookDynamicFee", address: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC" },
    { name: "ClankerHookStaticFee", address: "0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC" },
  ];
  
  console.log("\nOfficial Clanker hooks:");
  for (const hook of OFFICIAL_HOOKS) {
    const hookCode = await ethers.provider.getCode(hook.address);
    console.log(`  ${hook.name} (${hook.address}): ${hookCode === "0x" ? "NOT DEPLOYED" : "Deployed"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
