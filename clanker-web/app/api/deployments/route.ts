import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { CLANKER_INDEX_ABI } from '@/lib/clanker-index-abi';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const indexAddress = process.env.CLANKER_INDEX_ADDRESS;
    
    if (!indexAddress) {
      return NextResponse.json({ 
        error: 'ClankerIndex contract not deployed yet. Deploy it first with: cd contracts && npm install && npm run deploy',
        deployments: [] 
      }, { status: 200 });
    }

    if (!process.env.PRIVATE_KEY) {
      return NextResponse.json({ error: 'PRIVATE_KEY not configured' }, { status: 500 });
    }

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const client = createPublicClient({ 
      chain: base, 
      transport: http(process.env.RPC_URL || 'https://mainnet.base.org') 
    });

    // Simple contract read - NO LOG SCANNING
    const deployments = await client.readContract({
      address: indexAddress as `0x${string}`,
      abi: CLANKER_INDEX_ABI,
      functionName: 'getUserDeployments',
      args: [account.address],
    });

    // Map to response format
    const formattedDeployments = deployments.map((d: any) => ({
      id: d.tokenAddress,
      address: d.tokenAddress,
      name: d.name,
      symbol: d.symbol,
      image: d.image,
      timestamp: Number(d.timestamp) * 1000,
    }));

    // Sort by timestamp descending (newest first)
    formattedDeployments.sort((a: any, b: any) => b.timestamp - a.timestamp);

    return NextResponse.json({ deployments: formattedDeployments });
  } catch (error: any) {
    console.error('Failed to fetch deployments:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch deployments' }, { status: 500 });
  }
}
