"use client"

import { useState, useMemo, useCallback } from "react"
import { useBalance, useReadContract, useWatchContractEvent, useAccount } from "wagmi"
import { erc20Abi } from "viem"
import { WalletButton } from "@/components/wallet/WalletButton"
import { SettingsModal } from "@/components/SettingsModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CABAL_ABI, CabalInfo, CabalPhase } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"
import { TokenAmount } from "@/components/TokenAmount"
import { Plus, Users, Coins, TrendingUp, Wallet, Check, Search, X } from "lucide-react"
import { CabalDetailsContent } from "@/components/CabalDetailsContent"
import { Ticker } from "@/components/Ticker"
import { Footer } from "@/components/layout/Footer"
import { PrimaryCTA } from "@/components/layout/PrimaryCTA"
import { CreateModal } from "@/components/CreateModal"
import { TradeModal } from "@/components/TradeModal"
import { haptics } from "@/lib/haptics"
import { useHierarchicalCabals } from "@/hooks/useHierarchicalCabals"
import { useUserCabalPositions } from "@/hooks/useUserCabalPositions"
import { useLaunchingCabals } from "@/hooks/useLaunchingCabals"
import { ActivityModal } from "@/components/ActivityModal"
import { GraphExplorer } from "@/components/GraphExplorer"

type PhaseFilter = "all" | "active" | "launching" | "presale"
type SortOrder = "newest" | "oldest"
type ViewTab = "graph" | "search"

function formatPercent(value: number): string {
  if (value === 0) return "0.00%"
  if (value < 0.01) return "<0.01%"
  return `${value.toFixed(2)}%`
}

// Filter pill button component with golden ratio haptics
function FilterPill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  count?: number
}) {
  const handleClick = useCallback(() => {
    haptics.selection() // Sacred geometry selection haptic
    onClick()
  }, [onClick])

  return (
    <button
      onClick={handleClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
      {count !== undefined && <span className={`ml-1.5 text-xs ${active ? "opacity-70" : "opacity-50"}`}>{count}</span>}
    </button>
  )
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
  )
}

function CabalCard({
  cabal,
  cabalId,
  onClick,
  isLaunching,
}: {
  cabal: CabalInfo
  cabalId: bigint
  onClick: (id: bigint) => void
  isLaunching?: boolean
}) {
  const { data: totalSupply } = useReadContract({
    address: cabal.tokenAddress,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: {
      enabled: cabal.phase === CabalPhase.Active,
    },
  })

  const { data: treasuryBalance } = useBalance({
    address: cabal.tbaAddress,
    query: {
      enabled: cabal.phase === CabalPhase.Active,
    },
  })

  // Determine phase label and styles - Launching takes precedence over Presale
  const getPhaseDisplay = () => {
    if (isLaunching) {
      return {
        label: "Launching",
        styles: "bg-primary/10 text-primary border-primary/30"
      }
    }
    const labels = ["Presale", "Active", "Paused"]
    const styles = {
      [CabalPhase.Presale]: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
      [CabalPhase.Active]: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
      [CabalPhase.Paused]: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    }
    return {
      label: labels[cabal.phase] || "Unknown",
      styles: styles[cabal.phase] || "bg-gray-500/10 text-gray-600 border-gray-500/30"
    }
  }
  
  const { label: phaseLabel, styles: phaseStyles } = getPhaseDisplay()

  const stakedPercentage =
    cabal.phase === CabalPhase.Active && totalSupply && totalSupply > 0n
      ? Number((cabal.totalStaked * 10000n) / totalSupply) / 100
      : 0

  const handleClick = useCallback(() => {
    haptics.cardTap() // Golden ratio card haptic
    onClick(cabalId)
  }, [onClick, cabalId])

  return (
    <div onClick={handleClick} role="button" tabIndex={0} className="block h-full hover-sacred">
      <Card className="overflow-hidden h-full group relative card-sacred">
        <CardContent className="p-3.5 space-y-3.5">
          <div className="flex justify-between items-center">
            <h3 className="group-hover:text-primary transition-colors">
              <Ticker symbol={cabal.symbol} size="lg" />
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
                  <p className="text-lg font-bold tracking-tight">{cabal.contributorCount.toString()}</p>
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
                  <p className="text-lg font-mono font-bold tracking-tight">
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
    </div>
  )
}

export default function HomePage() {
  const { isConnected } = useAccount()
  const [viewTab, setViewTab] = useState<ViewTab>("graph")
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>("all")
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest")
  const [showOwned, setShowOwned] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCabalId, setSelectedCabalId] = useState<bigint | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false)

  // Hierarchical cabals only (CABAL0 and descendants, excludes legacy)
  const { 
    cabals, 
    isLoading, 
    refresh 
  } = useHierarchicalCabals()

  // Get user positions for filtering owned cabals
  const { ownedCabalIds } = useUserCabalPositions(cabals)

  // Detect launching cabals (presale with vote threshold met)
  const { launchingCabalIds } = useLaunchingCabals(cabals)

  // Watch for new cabals being created (polls every 30 seconds)
  useWatchContractEvent({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    eventName: "CabalCreated",
    pollingInterval: 30_000,
    onLogs() {
      refresh()
    },
  })

  // Watch for cabals being finalized (presale -> active)
  useWatchContractEvent({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    eventName: "CabalFinalized", 
    pollingInterval: 30_000,
    onLogs() {
      refresh()
    },
  })

  // Process and filter cabals (client-side on loaded items)
  const { filteredCabals, counts, cabalMap, ownedCount } = useMemo(() => {
    if (!cabals || cabals.length === 0) {
      return { filteredCabals: [], counts: { all: 0, active: 0, launching: 0, presale: 0 }, cabalMap: new Map(), ownedCount: 0 }
    }

    // Create a map for quick lookup
    const map = new Map<bigint, CabalInfo>()
    cabals.forEach((cabal) => {
      map.set(cabal.id, cabal)
    })

    // Helper to check if a cabal is launching (presale with vote threshold met)
    const isLaunching = (c: CabalInfo) => 
      c.phase === CabalPhase.Presale && launchingCabalIds.has(c.id.toString())

    // Count by phase (of loaded cabals)
    // "Launching" is a subset of presale, so presale count excludes launching
    const launchingCount = cabals.filter(isLaunching).length
    const counts = {
      all: cabals.length,
      active: cabals.filter((c) => c.phase === CabalPhase.Active).length,
      launching: launchingCount,
      presale: cabals.filter((c) => c.phase === CabalPhase.Presale && !launchingCabalIds.has(c.id.toString())).length,
    }

    // Count owned cabals
    const owned = ownedCabalIds.size

    // Filter by phase
    let filtered = [...cabals]
    if (phaseFilter === "active") {
      filtered = cabals.filter((c) => c.phase === CabalPhase.Active)
    } else if (phaseFilter === "launching") {
      filtered = cabals.filter(isLaunching)
    } else if (phaseFilter === "presale") {
      // Presale filter shows only non-launching presales
      filtered = cabals.filter((c) => c.phase === CabalPhase.Presale && !launchingCabalIds.has(c.id.toString()))
    }

    // Filter by ownership if enabled
    if (showOwned) {
      filtered = filtered.filter((c) => ownedCabalIds.has(c.id.toString()))
    }

    // Filter by search query (name or symbol)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((c) => 
        c.name.toLowerCase().includes(query) || 
        c.symbol.toLowerCase().includes(query)
      )
    }

    // Sort: "newest" keeps natural order (already newest-first from contract)
    // "oldest" reverses the loaded items
    if (sortOrder === "oldest") {
      filtered.reverse()
    }

    return { filteredCabals: filtered, counts, cabalMap: map, ownedCount: owned }
  }, [cabals, phaseFilter, sortOrder, showOwned, ownedCabalIds, launchingCabalIds, searchQuery])

  // Get selected cabal data
  const selectedCabal = selectedCabalId !== null ? cabalMap.get(selectedCabalId) : undefined
  const isViewingDetails = selectedCabalId !== null

  // Handle back navigation
  const handleBack = () => setSelectedCabalId(null)

  // Handle create success
  const handleCreateSuccess = async (newCabalId?: bigint) => {
    // Refresh to get the new cabal
    refresh();
    
    // If we have a specific ID from the creation event, use it
    if (newCabalId !== undefined) {
      setSelectedCabalId(newCabalId);
    }
  }

  if (!CABAL_DIAMOND_ADDRESS) {
    return (
      <div className="min-h-screen pb-[160px] bg-golden-radial">
        <header className="sticky top-0 z-50 glass-golden border-b border-primary/10">
          <div className="page-container">
            <div className="flex items-center justify-between h-14">
              <span className="text-xl font-bold tracking-tight text-golden-animated">CABAL</span>
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
        <Footer onActivityClick={() => setIsActivityModalOpen(true)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-[80px]">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-golden border-b border-primary/10">
        <div className="page-container">
          <div className="flex items-center justify-between h-14">
            <button 
              onClick={handleBack}
              className="text-xl font-bold tracking-tight text-golden-animated"
            >
              CABAL
            </button>
            <div className="flex items-center gap-3">
              <Button 
                size="sm" 
                className="gap-1.5 button-shimmer-effect active-press font-semibold" 
                onClick={() => setIsCreateModalOpen(true)}
                haptic="golden"
              >
                <Plus className="h-4 w-4" />
                <span>CREATE</span>
              </Button>
              <WalletButton />
              <SettingsModal />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {viewTab === "graph" && !isViewingDetails ? (
        /* Graph view - fixed position filling between header and footer */
        <div 
          className="fixed p-3.5"
          style={{ top: 56, bottom: 56, left: 0, right: 0 }}
        >
          <GraphExplorer
            onSelectCabal={setSelectedCabalId}
            onContribute={setSelectedCabalId}
          />
        </div>
      ) : (
        /* Normal scrollable content */
        <main className="page-container py-3.5">
          {isViewingDetails ? (
            <CabalDetailsContent 
              cabalId={selectedCabalId} 
              initialCabal={selectedCabal}
            />
          ) : (
            <>

            {/* Search/List View */}
            {viewTab === "search" && (
              <>
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
                ) : cabals.length === 0 && !isLoading ? (
                  <Card className="p-3.5 text-center max-w-lg mx-auto border-dashed">
                    <div className="space-y-3.5 py-3.5">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-3.5">
                        <div>
                          <p className="font-semibold text-base">No CABALs Yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Create the first CABAL to get started.</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-3.5">
                    {/* Filter Bar */}
                    <div className="space-y-3">
                      {/* Search Bar */}
                      <div className="relative max-w-md mx-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder=""
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full h-10 pl-9 pr-9 rounded-full border border-input bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Phase Filter - Centered */}
                      <div className="flex justify-center">
                        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-full">
                          <FilterPill active={phaseFilter === "all"} onClick={() => setPhaseFilter("all")} count={counts.all}>
                            All
                          </FilterPill>
                          <FilterPill
                            active={phaseFilter === "active"}
                            onClick={() => setPhaseFilter("active")}
                            count={counts.active}
                          >
                            Active
                          </FilterPill>
                          <FilterPill
                            active={phaseFilter === "launching"}
                            onClick={() => setPhaseFilter("launching")}
                            count={counts.launching}
                          >
                            Launching
                          </FilterPill>
                          <FilterPill
                            active={phaseFilter === "presale"}
                            onClick={() => setPhaseFilter("presale")}
                            count={counts.presale}
                          >
                            Presale
                          </FilterPill>
                        </div>
                      </div>

                      {/* Second Row - Sort left, Owned right */}
                      <div className="flex justify-between items-center">
                        {/* Sort Toggle - Left */}
                        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-full">
                          <FilterPill active={sortOrder === "newest"} onClick={() => setSortOrder("newest")}>
                            Newest
                          </FilterPill>
                          <FilterPill active={sortOrder === "oldest"} onClick={() => setSortOrder("oldest")}>
                            Oldest
                          </FilterPill>
                        </div>

                        {/* Show Owned Toggle - Right, only visible when connected */}
                        {isConnected && (
                          <button
                            onClick={() => {
                              haptics.selection()
                              setShowOwned(!showOwned)
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                              showOwned
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted bg-muted/50"
                            }`}
                          >
                            {showOwned && <Check className="h-3.5 w-3.5" />}
                            <span>Owned</span>
                            {ownedCount > 0 && (
                              <span className={`text-xs ${showOwned ? "opacity-70" : "opacity-50"}`}>{ownedCount}</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Grid */}
                    {filteredCabals.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          {showOwned 
                            ? "No cabals found. Contribute to a presale or buy tokens to see your cabals here."
                            : `No ${phaseFilter === "all" ? "" : phaseFilter} cabals found`}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 stagger-sacred">
                          {filteredCabals.map((cabal) => (
                            <div key={cabal.id.toString()} className="animate-sacred-in">
                              <CabalCard 
                                cabalId={cabal.id} 
                                cabal={cabal} 
                                onClick={setSelectedCabalId}
                                isLaunching={launchingCabalIds.has(cabal.id.toString())}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
          )}
        </main>
      )}

      {/* Trade button for active cabal details */}
      {isViewingDetails && selectedCabal?.phase === CabalPhase.Active && (
        <PrimaryCTA onClick={() => setIsTradeModalOpen(true)}>
          <TrendingUp className="h-5 w-5 mr-2" />
          Trade
        </PrimaryCTA>
      )}

      {/* Footer */}
      <Footer 
        onActivityClick={() => setIsActivityModalOpen(true)} 
        viewTab={viewTab}
        onViewTabChange={setViewTab}
      />

      {/* Create Modal (for header button when viewing details) */}
      <CreateModal 
        isOpen={isCreateModalOpen} 
        onOpenChange={setIsCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Trade Modal for Primary CTA */}
      {selectedCabal && (
        <TradeModal
          isOpen={isTradeModalOpen}
          onOpenChange={setIsTradeModalOpen}
          cabalId={selectedCabalId!}
          cabal={selectedCabal}
          onSuccess={refresh}
          initialTab="buy"
        />
      )}

      {/* Activity Modal */}
      <ActivityModal
        isOpen={isActivityModalOpen}
        onOpenChange={setIsActivityModalOpen}
      />
    </div>
  )
}
