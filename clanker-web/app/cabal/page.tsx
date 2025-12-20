'use client';

import Link from 'next/link';
import { useReadContract, useBalance } from 'wagmi';
import { erc20Abi } from 'viem';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CABAL_ABI, CabalInfo, CabalPhase } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { TokenAmount } from '@/components/TokenAmount';
import { Plus } from 'lucide-react';

function CabalCard({ cabalId }: { cabalId: bigint }) {
  const { data: cabal } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getCabal',
    args: [cabalId],
  }) as { data: CabalInfo | undefined };

  const { data: totalSupply } = useReadContract({
    address: cabal?.tokenAddress,
    abi: erc20Abi,
    functionName: 'totalSupply',
    query: {
      enabled: !!cabal && cabal.phase === CabalPhase.Active,
    },
  });

  const { data: treasuryBalance } = useBalance({
    address: cabal?.tbaAddress,
    query: {
      enabled: !!cabal && cabal.phase === CabalPhase.Active,
    },
  });

  if (!cabal) return null;

  const phaseLabel = ['Presale', 'Active', 'Paused'][cabal.phase] || 'Unknown';
  const phaseColor = {
    [CabalPhase.Presale]: 'bg-yellow-500',
    [CabalPhase.Active]: 'bg-green-500',
    [CabalPhase.Paused]: 'bg-red-500',
  }[cabal.phase] || 'bg-gray-500';

  const stakedPercentage = (cabal.phase === CabalPhase.Active && totalSupply && totalSupply > 0n)
    ? Number((cabal.totalStaked * 10000n) / totalSupply) / 100
    : 0;

  return (
    <Link href={`/cabal/${cabalId.toString()}`}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full py-0">
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono font-bold text-lg">${cabal.symbol}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full text-white ${phaseColor}`}>
              {phaseLabel}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            {cabal.phase === CabalPhase.Presale && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contributors</span>
                  <span>{cabal.contributorCount.toString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raised</span>
                  <TokenAmount amount={cabal.totalRaised} symbol="ETH" className="font-mono" />
                </div>
              </>
            )}
            {cabal.phase === CabalPhase.Active && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Staked</span>
                  <span className="font-mono font-bold text-green-600">
                    {stakedPercentage.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Treasury</span>
                  <TokenAmount amount={treasuryBalance?.value} symbol="ETH" className="font-mono" />
                </div>
              </>
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
      <div className="min-h-screen">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
          <div className="page-container">
            <div className="flex items-center justify-between h-12">
              <Link href="/" className="text-xl font-bold tracking-tight">CABAL</Link>
              <WalletButton />
            </div>
          </div>
        </header>
        <main className="page-container section-gap">
          <Card className="p-8 text-center">
            <p className="font-medium mb-2">Contract Not Deployed</p>
            <p className="text-sm text-muted-foreground">
              Deploy using: <code className="bg-muted px-2 py-1 rounded text-xs">npm run deploy</code>
            </p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="page-container">
          <div className="flex items-center justify-between h-12">
            <Link href="/" className="text-xl font-bold tracking-tight">CABAL</Link>
            <div className="flex items-center gap-2">
              <Link href="/cabal/create">
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </Link>
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="page-container section-gap">
        {isLoading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : !cabalIds || cabalIds.length === 0 ? (
          <Card className="p-6 text-center max-w-md mx-auto">
            <p className="font-medium mb-2">No CABALs Yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create the first CABAL to get started.
            </p>
            <Link href="/cabal/create">
              <Button>Create CABAL</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {cabalIds.map((id) => (
              <CabalCard key={id.toString()} cabalId={id} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
