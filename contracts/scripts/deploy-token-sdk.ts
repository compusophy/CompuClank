import { Clanker } from 'clanker-sdk/v4';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from clanker-web
dotenv.config({ path: path.resolve(__dirname, '../../clanker-web/.env.local') });

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable not set in .env file");
  }
  
  const account = privateKeyToAccount(privateKey);
  
  console.log("Deploying test token using Clanker SDK...");
  console.log("Account:", account.address);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  });
  
  // Initialize the SDK
  const clanker = new Clanker({
    publicClient,
    wallet: walletClient,
  });
  
  // Deploy a simple test token with devBuy
  console.log("\nDeploying token with devBuy...");
  
  const { txHash, waitForTransaction, error } = await clanker.deploy({
    name: "Cabal Working Token",
    symbol: "CWT",
    tokenAdmin: account.address,
    // Add Dev Buy to ensure pool is working and we get tokens
    devBuy: {
      ethAmount: 0.000001, // Small buy
    },
  });
  
  if (error) {
    console.error("Deployment error:", error);
    throw error;
  }
  
  console.log("Transaction hash:", txHash);
  console.log("Waiting for confirmation...");
  
  const result = await waitForTransaction();
  
  if (result.error) {
    console.error("Transaction error:", result.error);
    throw result.error;
  }
  
  console.log("\n✅ Token deployed successfully!");
  console.log("Token address:", result.address);
  console.log(`View on Clanker World: https://clanker.world/clanker/${result.address}`);
  console.log(`View on Basescan: https://basescan.org/token/${result.address}`);
  
  // Now let's verify the pool exists
  console.log("\nTo test SwapFacet, you'll need to:");
  console.log(`1. Create a new Cabal with this token address: ${result.address}`);
  console.log("2. Or update an existing Cabal's tokenAddress to this one");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
