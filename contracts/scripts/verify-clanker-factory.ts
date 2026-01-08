import { ethers } from "hardhat";

const DIAMOND_ADDRESS = "0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9";
const EXPECTED_CLANKER_FACTORY = "0xE85A59c628F7d27878ACeB4bf3b35733630083a9";

async function main() {
  console.log("Verifying Clanker factory...\n");
  
  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND_ADDRESS);
  const addresses = await settingsFacet.getContractAddresses();
  
  const clankerFactory = addresses[3];
  console.log("Clanker Factory from Diamond:", clankerFactory);
  console.log("Expected:", EXPECTED_CLANKER_FACTORY);
  console.log("Match:", clankerFactory.toLowerCase() === EXPECTED_CLANKER_FACTORY.toLowerCase());
  
  // Check if factory has code
  const code = await ethers.provider.getCode(clankerFactory);
  console.log("\nFactory has code:", code.length > 2);
  console.log("Code length:", code.length);
  
  // Try to read factory's TOKEN_SUPPLY
  const factory = await ethers.getContractAt("IClankerFactory", clankerFactory);
  try {
    const supply = await factory.TOKEN_SUPPLY();
    console.log("TOKEN_SUPPLY:", ethers.formatEther(supply));
  } catch (e: any) {
    console.log("Could not read TOKEN_SUPPLY:", e.message?.slice(0, 100));
  }
  
  try {
    const bps = await factory.BPS();
    console.log("BPS:", bps.toString());
  } catch (e: any) {
    console.log("Could not read BPS:", e.message?.slice(0, 100));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
