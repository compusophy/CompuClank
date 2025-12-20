import { ethers } from "hardhat";

async function main() {
  const CLANKER_FACTORY = "0x2a787b2362021cc3cee5d6e15f80e7ee89800788"; // Clanker V4 Factory

  console.log("Deploying ClankerIndex...");

  const ClankerIndex = await ethers.getContractFactory("ClankerIndex");
  const index = await ClankerIndex.deploy(CLANKER_FACTORY);
  await index.waitForDeployment();

  const address = await index.getAddress();
  console.log(`ClankerIndex deployed to: ${address}`);
  console.log(`\nAdd this to your .env.local:`);
  console.log(`CLANKER_INDEX_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
