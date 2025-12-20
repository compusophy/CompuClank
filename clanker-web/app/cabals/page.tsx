'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CABAL_ABI, CabalInfo, CabalPhase } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';

function CabalCard({ cabalId }: { cabalId: bigint }) {
  const { data: cabal } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getCabal',
    args: [cabalId],
  }) as { data: CabalInfo | undefined };

  if (!cabal) return null;

  const phaseLabel = ['Presale', 'Active', 'Paused'][cabal.phase] || 'Unknown';
  const phaseColor = {
    [CabalPhase.Presale]: 'bg-yellow-500',
    [CabalPhase.Active]: 'bg-green-500',
    [CabalPhase.Paused]: 'bg-red-500',
  }[cabal.phase] || 'bg-gray-500';

  return (
    <Link href={`/cabals/${cabalId.toString()}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">{cabal.name}</CardTitle>
              <CardDescription className="font-mono">${cabal.symbol}</CardDescription>
            </div>
            <span className={`px-2 py-1 text-xs rounded-full text-white ${phaseColor}`}>
              {phaseLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Raised</span>
              <span className="font-mono">{formatEther(cabal.totalRaised)} ETH</span>
            </div>
            {cabal.phase === CabalPhase.Presale && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contributors</span>
                <span>{cabal.contributorCount.toString()}</span>
              </div>
            )}
            {cabal.phase === CabalPhase.Active && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staked</span>
                <span className="font-mono">{formatEther(cabal.totalStaked)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CabalsPage() {
  const { data: cabalIds, isLoading } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getAllCabals',
  });

  if (!CABAL_DIAMOND_ADDRESS) {
    return (
      <div className="container mx-auto py-10 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">CABAL</h1>
            <p className="text-muted-foreground">Composable DAO Framework</p>
          </div>
          <ConnectButton />
        </div>
        <Card className="p-8 text-center">
          <CardTitle className="mb-4">Contract Not Deployed</CardTitle>
          <CardDescription>
            The CABAL Diamond contract has not been deployed yet.
            <br />
            Deploy it using: <code className="bg-muted px-2 py-1 rounded">npm run deploy</code> in the contracts folder.
          </CardDescription>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">CABAL</h1>
          <p className="text-muted-foreground">Composable DAO Framework</p>
        </div>
        <div className="flex gap-4">
          <Link href="/cabals/create">
            <Button>Create Cabal</Button>
          </Link>
          <ConnectButton />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Loading Cabals...</p>
        </div>
      ) : !cabalIds || cabalIds.length === 0 ? (
        <Card className="p-8 text-center">
          <CardTitle className="mb-4">No Cabals Yet</CardTitle>
          <CardDescription className="mb-6">
            Be the first to create a Cabal and start a decentralized group wallet.
          </CardDescription>
          <Link href="/cabals/create">
            <Button>Create First Cabal</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cabalIds.map((id) => (
            <CabalCard key={id.toString()} cabalId={id} />
          ))}
        </div>
      )}
    </div>
  );
}
