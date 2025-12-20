import { NextRequest, NextResponse } from 'next/server';
import { Clanker } from 'clanker-sdk/v4';
import { ClankerTokenV4, POOL_POSITIONS, FEE_CONFIGS } from 'clanker-sdk';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { CLANKER_INDEX_ABI } from '@/lib/clanker-index-abi';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      name, 
      symbol, 
      description, 
      image, 
      website, 
      twitter, 
      telegram,
      devBuyAmount,
      vaultPercentage,
      vaultLockupDuration,
      vaultVestingDuration
    } = body;

    if (!process.env.PRIVATE_KEY) {
      return NextResponse.json({ error: 'Server misconfiguration: PRIVATE_KEY not found' }, { status: 500 });
    }

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    
    // Initialize viem clients
    const client = createPublicClient({ 
      chain: base, 
      transport: http(process.env.RPC_URL || 'https://mainnet.base.org') 
    });
    
    const wallet = createWalletClient({ 
      account, 
      chain: base, 
      transport: http(process.env.RPC_URL || 'https://mainnet.base.org') 
    });

    const clanker = new Clanker({ 
      publicClient: client as any, 
      wallet: wallet as any 
    });

    // Construct social links array
    const socialMediaUrls: string[] = [];
    if (website) socialMediaUrls.push(website);
    if (twitter) socialMediaUrls.push(twitter);
    if (telegram) socialMediaUrls.push(telegram);

    const tokenConfig: any = {
      name,
      symbol,
      tokenAdmin: account.address,
      image: image || '',
      metadata: {
        description: description || '',
        socialMediaUrls,
        auditUrls: [],
      },
      context: {
        interface: 'Clanker Web SDK',
      },
      pool: {
        positions: POOL_POSITIONS.Project,
      },
      fees: FEE_CONFIGS.DynamicBasic,
      vanity: true,
    };

    // Add optional configurations
    if (vaultPercentage && vaultPercentage > 0) {
      tokenConfig.vault = {
        percentage: Number(vaultPercentage),
        lockupDuration: Number(vaultLockupDuration) || 2592000, // Default 30 days
        vestingDuration: Number(vaultVestingDuration) || 0,
        recipient: account.address // Default to admin for now
      };
    }

    if (devBuyAmount && Number(devBuyAmount) > 0) {
      tokenConfig.devBuy = {
        ethAmount: Number(devBuyAmount)
      };
    }

    console.log('Deploying with config:', JSON.stringify(tokenConfig, null, 2));

    const { waitForTransaction, error } = await clanker.deploy(tokenConfig);

    if (error) {
      console.error('Clanker deploy error:', error);
      return NextResponse.json({ error: error.message || 'Deployment failed' }, { status: 400 });
    }

    // Wait for transaction - in a real app might want to return txHash immediately and poll status
    const result = await waitForTransaction();
    
    if (!result || !('address' in result)) {
       return NextResponse.json({ error: 'Transaction failed or returned no address' }, { status: 500 });
    }

    // Index the deployment
    if (process.env.CLANKER_INDEX_ADDRESS) {
      try {
        console.log('Indexing deployment at:', process.env.CLANKER_INDEX_ADDRESS);

        // Retry logic for nonce issues
        let retries = 5;
        while (retries > 0) {
          try {
            const { request } = await client.simulateContract({
              address: process.env.CLANKER_INDEX_ADDRESS as `0x${string}`,
              abi: CLANKER_INDEX_ABI,
              functionName: 'addDeployment',
              args: [
                 result.address as `0x${string}`, 
                 name, 
                 symbol, 
                 image || '', 
                 account.address
              ],
              account
            });
            const hash = await wallet.writeContract(request);
            console.log('Indexing tx:', hash);
            break; // Success
          } catch (e: any) {
            console.error(`Indexing attempt failed (${retries} retries left):`, e.message);
            
            // If nonce is too low or other transient error, wait and retry
            if (e.message?.includes("nonce") || e.message?.includes("replacement transaction underpriced")) {
               await new Promise(r => setTimeout(r, 2000));
               retries--;
               continue;
            }
            throw e; // Non-recoverable error
          }
        }
      } catch (e) {
        console.error("Failed to index deployment:", e);
        // Don't fail the request, just log it
      }
    }

    return NextResponse.json({ 
      success: true, 
      address: result.address,
      explorerUrl: `https://clanker.world/clanker/${result.address}`
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}



