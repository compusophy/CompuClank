import { ethers } from "hardhat";

async function main() {
  const DIAMOND = "0x2c37109E089a274fD3e7029a4F379558d44937e3";
  
  // Correct Clanker V4 addresses from init-clanker-v4.ts
  const CORRECT = {
    hook: "0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC",
    locker: "0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0",
    mevModule: "0xE143f9872A33c955F23cF442BB4B1EFB3A7402A2",
    devBuyExtension: "0x1331f0788F9c08C8F38D52c7a1152250A9dE00be",
  };

  console.log("Fixing Clanker V4 addresses in Diamond at:", DIAMOND);
  
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const settingsFacet = await ethers.getContractAt("SettingsFacet", DIAMOND);
  
  // Check current state
  console.log("\nCurrent Clanker V4 addresses:");
  const [hook, locker, mevModule, devBuyExtension] = await settingsFacet.getClankerAddresses();
  console.log("  Hook:", hook);
  console.log("  Locker:", locker);
  console.log("  MevModule:", mevModule);
  console.log("  DevBuyExtension:", devBuyExtension);

  console.log("\nCorrect addresses:");
  console.log("  Hook:", CORRECT.hook);
  console.log("  Locker:", CORRECT.locker);
  console.log("  MevModule:", CORRECT.mevModule);
  console.log("  DevBuyExtension:", CORRECT.devBuyExtension);

  // Fix each address that's wrong
  const fixes: { name: string; current: string; correct: string }[] = [];
  
  if (hook.toLowerCase() !== CORRECT.hook.toLowerCase()) {
    fixes.push({ name: "clankerHook", current: hook, correct: CORRECT.hook });
  }
  if (locker.toLowerCase() !== CORRECT.locker.toLowerCase()) {
    fixes.push({ name: "clankerLocker", current: locker, correct: CORRECT.locker });
  }
  if (mevModule.toLowerCase() !== CORRECT.mevModule.toLowerCase()) {
    fixes.push({ name: "clankerMevModule", current: mevModule, correct: CORRECT.mevModule });
  }
  if (devBuyExtension.toLowerCase() !== CORRECT.devBuyExtension.toLowerCase()) {
    fixes.push({ name: "clankerDevBuyExtension", current: devBuyExtension, correct: CORRECT.devBuyExtension });
  }

  if (fixes.length === 0) {
    console.log("\n✅ All addresses are already correct!");
    return;
  }

  console.log(`\n⚠️  ${fixes.length} addresses need to be fixed:`);
  for (const fix of fixes) {
    console.log(`  ${fix.name}: ${fix.current} → ${fix.correct}`);
  }

  console.log("\nUpdating addresses...");
  for (const fix of fixes) {
    console.log(`  Updating ${fix.name}...`);
    try {
      const tx = await settingsFacet.updateContractAddress(fix.name, fix.correct);
      console.log(`    Submitted: ${tx.hash}`);
      await tx.wait();
      console.log(`    ✅ Confirmed!`);
      // Wait a bit between transactions to avoid nonce issues
      await new Promise(r => setTimeout(r, 3000));
    } catch (e: any) {
      if (e.message?.includes("underpriced") || e.message?.includes("nonce")) {
        console.log(`    ⚠️ Nonce issue, waiting and retrying...`);
        await new Promise(r => setTimeout(r, 5000));
        const tx = await settingsFacet.updateContractAddress(fix.name, fix.correct);
        await tx.wait();
        console.log(`    ✅ Done on retry!`);
      } else {
        throw e;
      }
    }
  }

  // Verify
  console.log("\nVerifying...");
  const [newHook, newLocker, newMev, newDevBuy] = await settingsFacet.getClankerAddresses();
  console.log("New addresses:");
  console.log("  Hook:", newHook, newHook.toLowerCase() === CORRECT.hook.toLowerCase() ? "✅" : "❌");
  console.log("  Locker:", newLocker, newLocker.toLowerCase() === CORRECT.locker.toLowerCase() ? "✅" : "❌");
  console.log("  MevModule:", newMev, newMev.toLowerCase() === CORRECT.mevModule.toLowerCase() ? "✅" : "❌");
  console.log("  DevBuyExtension:", newDevBuy, newDevBuy.toLowerCase() === CORRECT.devBuyExtension.toLowerCase() ? "✅" : "❌");

  console.log("\n✅ All addresses updated!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
