// ESM module to use clanker-sdk
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Dynamic import for clanker-sdk
const { Clanker } = await import('clanker-sdk/v4');

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';

async function main() {
  console.log("Testing Clanker SDK...\n");
  
  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log("Account:", account.address);
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  
  const clanker = new Clanker({
    publicClient,
    wallet: walletClient,
  });
  
  // Get the deployment transaction to see what config is generated
  try {
    const deployTx = await clanker.getDeployTransaction({
      name: "Test Token",
      symbol: "TEST",
      tokenAdmin: account.address,
    });
    
    console.log("Deploy transaction config:");
    console.log(JSON.stringify(deployTx, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
