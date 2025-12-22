'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useReadContract, useReadContracts, useBalance } from 'wagmi';
import { erc20Abi } from 'viem';
import { WalletButton } from '@/components/wallet/WalletButton';
import { SettingsModal } from '@/components/SettingsModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CABAL_ABI, CabalInfo, CabalPhase } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { TokenAmount } from '@/components/TokenAmount';
import { Plus, Users, Coins, TrendingUp, Wallet, ArrowUpDown } from 'lucide-react';

type PhaseFilter = 'all' | 'active' | 'presale';
type SortOrder = 'newest' | 'oldest';

function formatPercent(value: number): string {
  if (value === 0) return '0.00%';
  if (value < 0.01) return '<0.01%';
  return `${value.toFixed(2)}%`;
}

// Filter pill button component
function FilterPill({ 
  active, 
  onClick, 
  children,
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className={`ml-1.5 text-xs ${active ? 'opacity-70' : 'opacity-50'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function CabalCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3.5 space-y-3.5">
        <div className="flex justify-between items-center">
          <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
            <div className="h-5 w-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex justify-between items-center">
            <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            <div className="h-5 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CabalCard({ cabal, cabalId }: { cabal: CabalInfo; cabalId: bigint }) {
  const { data: totalSupply } = useReadContract({
    address: cabal.tokenAddress,
    abi: erc20Abi,
    functionName: 'totalSupply',
    query: {
      enabled: cabal.phase === CabalPhase.Active,
    },
  });

  const { data: treasuryBalance } = useBalance({
    address: cabal.tbaAddress,
    query: {
      enabled: cabal.phase === CabalPhase.Active,
    },
  });

  const phaseLabel = ['Presale', 'Active', 'Paused'][cabal.phase] || 'Unknown';
  const phaseStyles = {
    [CabalPhase.Presale]: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
    [CabalPhase.Active]: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
    [CabalPhase.Paused]: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  }[cabal.phase] || 'bg-gray-500/10 text-gray-600 border-gray-500/30';

  const stakedPercentage = (cabal.phase === CabalPhase.Active && totalSupply && totalSupply > 0n)
    ? Number((cabal.totalStaked * 10000n) / totalSupply) / 100
    : 0;

  return (
    <Link href={`/${cabalId.toString()}`}>
      <Card className="overflow-hidden hover:border-foreground/20 hover:shadow-lg transition-all duration-200 cursor-pointer h-full group">
        <CardContent className="p-3.5 space-y-3.5">
          <div className="flex justify-between items-center">
            <h3 className="font-mono font-bold text-lg tracking-tight group-hover:text-primary transition-colors">
              ${cabal.symbol}
            </h3>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${phaseStyles}`}>
              {phaseLabel}
            </span>
          </div>

          <div className="space-y-2">
            {cabal.phase === CabalPhase.Presale && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs">Contributors</span>
                  </div>
                  <p className="text-lg font-bold tracking-tight">
                    {cabal.contributorCount.toString()}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Coins className="h-3.5 w-3.5" />
                    <span className="text-xs">Raised</span>
                  </div>
                  <p className="text-lg font-mono font-bold tracking-tight">
                    <TokenAmount amount={cabal.totalRaised} symbol="ETH" decimals={5} />
                  </p>
                </div>
              </>
            )}
            {cabal.phase === CabalPhase.Active && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-xs">Staked</span>
                  </div>
                  <p className="text-lg font-mono font-bold tracking-tight text-green-600 dark:text-green-400">
                    {formatPercent(stakedPercentage)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    <span className="text-xs">Treasury</span>
                  </div>
                  <p className="text-lg font-mono font-bold tracking-tight">
                    <TokenAmount amount={treasuryBalance?.value} symbol="ETH" decimals={6} />
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function HomePage() {
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // Get all cabal IDs
  const { data: cabalIds, isLoading: isLoadingIds } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getAllCabals',
  });

  // Fetch all cabal data in parallel
  const { data: cabalResults, isLoading: isLoadingCabals } = useReadContracts({
    contracts: cabalIds?.map((id) => ({
      address: CABAL_DIAMOND_ADDRESS!,
      abi: CABAL_ABI,
      functionName: 'getCabal',
      args: [id],
    })) ?? [],
    query: {
      enabled: !!cabalIds && cabalIds.length > 0,
    },
  });

  // Process and filter cabals
  const { filteredCabals, counts } = useMemo(() => {
    if (!cabalIds || !cabalResults) {
      return { filteredCabals: [], counts: { all: 0, active: 0, presale: 0 } };
    }

    // Pair IDs with cabal data
    const cabalsWithIds = cabalIds.map((id, index) => ({
      id,
      cabal: cabalResults[index]?.result as CabalInfo | undefined,
    })).filter((item) => item.cabal !== undefined);

    // Count by phase
    const counts = {
      all: cabalsWithIds.length,
      active: cabalsWithIds.filter(c => c.cabal?.phase === CabalPhase.Active).length,
      presale: cabalsWithIds.filter(c => c.cabal?.phase === CabalPhase.Presale).length,
    };

    // Filter by phase
    let filtered = cabalsWithIds;
    if (phaseFilter === 'active') {
      filtered = cabalsWithIds.filter(c => c.cabal?.phase === CabalPhase.Active);
    } else if (phaseFilter === 'presale') {
      filtered = cabalsWithIds.filter(c => c.cabal?.phase === CabalPhase.Presale);
    }

    // Sort by ID (which correlates with creation order)
    filtered.sort((a, b) => {
      if (sortOrder === 'newest') {
        return Number(b.id - a.id);
      } else {
        return Number(a.id - b.id);
      }
    });

    return { filteredCabals: filtered, counts };
  }, [cabalIds, cabalResults, phaseFilter, sortOrder]);

  const isLoading = isLoadingIds || isLoadingCabals;

  if (!CABAL_DIAMOND_ADDRESS) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
          <div className="page-container">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="text-xl font-bold tracking-tight">CABAL</Link>
              <div className="flex items-center gap-3">
                <WalletButton />
                <SettingsModal />
              </div>
            </div>
          </div>
        </header>
        <main className="page-container py-3.5">
          <Card className="p-3.5 text-center max-w-lg mx-auto border-dashed">
            <div className="space-y-3.5">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Coins className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-base">Contract Not Deployed</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deploy using: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">npm run deploy</code>
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="page-container">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="text-xl font-bold tracking-tight">CABAL</Link>
            <div className="flex items-center gap-3">
              <Link href="/create">
                <Button size="sm" className="gap-1.5 shadow-sm">
                  <Plus className="h-4 w-4" />
                  <span>Create</span>
                </Button>
              </Link>
              <WalletButton />
              <SettingsModal />
            </div>
          </div>
        </div>
      </header>

      <main className="page-container py-3.5">
        {isLoading ? (
          <div className="space-y-3.5">
            {/* Skeleton filter bar */}
            <div className="flex items-center justify-between">
              <div className="h-9 w-48 bg-muted animate-pulse rounded-full" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
            <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <CabalCardSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : !cabalIds || cabalIds.length === 0 ? (
          <Card className="p-3.5 text-center max-w-lg mx-auto border-dashed">
            <div className="space-y-3.5 py-3.5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-3.5">
                <div>
                  <p className="font-semibold text-base">No CABALs Yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create the first CABAL to get started.
                  </p>
                </div>
                <Link href="/create">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create CABAL
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-3.5">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
              {/* Phase Filter */}
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-full w-fit">
                <FilterPill 
                  active={phaseFilter === 'all'} 
                  onClick={() => setPhaseFilter('all')}
                  count={counts.all}
                >
                  All
                </FilterPill>
                <FilterPill 
                  active={phaseFilter === 'active'} 
                  onClick={() => setPhaseFilter('active')}
                  count={counts.active}
                >
                  Active
                </FilterPill>
                <FilterPill 
                  active={phaseFilter === 'presale'} 
                  onClick={() => setPhaseFilter('presale')}
                  count={counts.presale}
                >
                  Presale
                </FilterPill>
              </div>

              {/* Sort Toggle */}
              <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-full w-fit">
                <FilterPill 
                  active={sortOrder === 'newest'} 
                  onClick={() => setSortOrder('newest')}
                >
                  Newest
                </FilterPill>
                <FilterPill 
                  active={sortOrder === 'oldest'} 
                  onClick={() => setSortOrder('oldest')}
                >
                  Oldest
                </FilterPill>
              </div>
            </div>

            {/* Grid */}
            {filteredCabals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No {phaseFilter} cabals found</p>
              </div>
            ) : (
              <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCabals.map(({ id, cabal }) => (
                  <CabalCard key={id.toString()} cabalId={id} cabal={cabal!} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
