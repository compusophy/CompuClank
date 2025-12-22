"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { formatEther, parseEther, erc20Abi } from "viem"
import { toast } from "sonner"
import { ExternalLink, Users, Coins, Vote, Settings, History, TrendingUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { TokenAmount } from "@/components/TokenAmount"
import { TradeModal } from "@/components/TradeModal"
import { StakeModal } from "@/components/StakeModal"
import { CABAL_ABI, CabalInfo, CabalPhase } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"

function showTransactionToast(hash: string, message: string) {
  toast.success(message, {
    action: {
      label: "View",
      onClick: () => window.open(`https://basescan.org/tx/${hash}`, "_blank"),
    },
    duration: 5000,
  })
}

function formatPercent(value: number): string {
  if (value === 0) return "0.00%"
  if (value < 0.01) return "<0.01%"
  return `${value.toFixed(2)}%`
}

// PRESALE COMPONENTS

function ContributeSection({
  cabalId,
  onSuccess,
  userAddress,
}: {
  cabalId: bigint
  onSuccess: () => void
  userAddress: string
}) {
  const [amount, setAmount] = useState("0.00001")
  const { writeContract, data: hash, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: contribution, refetch: refetchContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getContribution",
    args: [cabalId, userAddress as `0x${string}`],
  })

  useEffect(() => {
    if (isSuccess && hash) {
      showTransactionToast(hash, `Contributed ${amount} ETH`)
      onSuccess()
      refetchContribution()
      reset()
      setAmount("0.00001")
    }
  }, [isSuccess, hash, amount, onSuccess, reset, refetchContribution])

  const handleContribute = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    writeContract(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "contribute",
        args: [cabalId],
        value: parseEther(amount),
      },
      {
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const contributionAmount = contribution as bigint | undefined

  return (
    <div className="space-y-4">
      {!!contributionAmount && contributionAmount > 0n && (
        <div className="p-3 bg-muted rounded-lg flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Your Contribution</span>
          <TokenAmount amount={contributionAmount} symbol="ETH" className="font-mono font-semibold" />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="number"
          step="0.001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="ETH amount"
          className="font-mono"
        />
        <Button onClick={handleContribute} disabled={isPending || isConfirming}>
          {isPending || isConfirming ? "Confirming..." : "Contribute"}
        </Button>
      </div>
    </div>
  )
}

function LaunchSection({
  cabalId,
  cabal,
  userAddress,
  onSuccess,
}: {
  cabalId: bigint
  cabal: CabalInfo
  userAddress: string
  onSuccess: () => void
}) {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const isCreator = cabal.creator.toLowerCase() === userAddress.toLowerCase()

  useEffect(() => {
    if (isSuccess && hash) {
      showTransactionToast(hash, "Token deployed!")
      onSuccess()
    }
  }, [isSuccess, hash, onSuccess])

  const handleFinalize = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    writeContract(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "finalizeCabal",
        args: [cabalId],
      },
      {
        onError: (e) => toast.error(e.message),
      }
    )
  }

  if (!isCreator) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the creator can launch. Creator: <span className="font-mono text-xs">{cabal.creator.slice(0, 8)}...</span>
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm space-y-2 p-3 bg-muted rounded-lg">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Treasury (10%)</span>
          <TokenAmount amount={cabal.totalRaised / 10n} symbol="ETH" className="font-mono font-medium" />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">DevBuy (90%)</span>
          <TokenAmount amount={(cabal.totalRaised * 9n) / 10n} symbol="ETH" className="font-mono font-medium" />
        </div>
      </div>
      <Button
        onClick={handleFinalize}
        disabled={isPending || isConfirming || cabal.totalRaised === 0n}
        className="w-full"
        size="lg"
      >
        {isPending || isConfirming ? "Deploying..." : "Launch Token"}
      </Button>
    </div>
  )
}

// ACTIVE SECTION - Combined Position & Governance

function ActiveSection({
  cabalId,
  cabal,
  userAddress,
  onSuccess,
  onOpenTradeModal,
}: {
  cabalId: bigint
  cabal: CabalInfo
  userAddress: string
  onSuccess: () => void
  onOpenTradeModal?: () => void
}) {
  const { address } = useAccount()
  const queryClient = useQueryClient()
  const [unstakeAmount, setUnstakeAmount] = useState("")
  const [delegatee, setDelegatee] = useState("")
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false)
  const [isDelegateModalOpen, setIsDelegateModalOpen] = useState(false)
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false)
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false)
  const [tradeModalTab, setTradeModalTab] = useState<"buy" | "sell">("buy")

  const openTradeModal = (tab: "buy" | "sell") => {
    setTradeModalTab(tab)
    setIsTradeModalOpen(true)
  }

  const openStakeModal = () => {
    setIsStakeModalOpen(true)
  }

  // Read data
  const { refetch: refetchClaimable } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getClaimable",
    args: [cabalId, userAddress as `0x${string}`],
  })
  const { data: contribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getContribution",
    args: [cabalId, userAddress as `0x${string}`],
  })
  const { data: hasClaimed, refetch: refetchHasClaimed } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "hasClaimed",
    args: [cabalId, userAddress as `0x${string}`],
  })
  const { data: stakedBalance, refetch: refetchStaked } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getStakedBalance",
    args: address ? [cabalId, address] : undefined,
  })
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: cabal.tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  })

  // Write contracts
  const { writeContract: claimWrite, data: claimHash, isPending: isClaiming } = useWriteContract()
  const { isSuccess: claimSuccess, isLoading: claimConfirming } = useWaitForTransactionReceipt({ hash: claimHash })
  const { writeContract: unstakeWrite, data: unstakeHash, isPending: isUnstaking } = useWriteContract()
  const { isSuccess: unstakeSuccess, isLoading: unstakeConfirming } = useWaitForTransactionReceipt({ hash: unstakeHash })
  const { writeContract: delegate, isPending: isDelegating } = useWriteContract()
  const { writeContract: undelegate, isPending: isUndelegating } = useWriteContract()
  const { writeContract: claimFees, isPending: isFeesClaiming } = useWriteContract()

  useEffect(() => {
    if (claimSuccess && claimHash) {
      showTransactionToast(claimHash, "Tokens claimed!")
      refetchClaimable()
      refetchHasClaimed()
      onSuccess()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimSuccess, claimHash])

  useEffect(() => {
    if (unstakeSuccess && unstakeHash) {
      showTransactionToast(unstakeHash, "Unstaked!")
      refetchStaked()
      refetchTokenBalance()
      queryClient.invalidateQueries()
      onSuccess()
      setIsUnstakeModalOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unstakeSuccess, unstakeHash])

  const handleClaim = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    claimWrite(
      { address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: "claimTokens", args: [cabalId] },
      {
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const handleUnstake = () => {
    if (!CABAL_DIAMOND_ADDRESS || !unstakeAmount) return
    unstakeWrite(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "unstake",
        args: [cabalId, parseEther(unstakeAmount)],
      },
      {
        onError: (e) => toast.error(e.message),
        onSuccess: () => setUnstakeAmount(""),
      }
    )
  }

  const handleDelegate = () => {
    if (!CABAL_DIAMOND_ADDRESS || !delegatee) return
    delegate(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "delegate",
        args: [cabalId, delegatee as `0x${string}`],
      },
      {
        onSuccess: () => {
          toast.success("Delegated!")
          setDelegatee("")
          setIsDelegateModalOpen(false)
          onSuccess()
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const handleUndelegate = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    undelegate(
      { address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: "undelegate", args: [cabalId] },
      {
        onSuccess: () => {
          toast.success("Undelegated!")
          onSuccess()
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const handleClaimFees = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    claimFees(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "claimLPFees",
        args: [cabalId, "0x4200000000000000000000000000000000000006"],
      },
      {
        onSuccess: () => {
          toast.success("LP fees claimed!")
          onSuccess()
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const contributionAmount = contribution as bigint | undefined
  const hasClaimedStatus = hasClaimed as boolean | undefined

  // Calculate total claim amount (what they can claim OR have already claimed)
  // We calculate this manually because getClaimable returns 0 after claiming
  const totalClaimAmount =
    contributionAmount && cabal.totalRaised > 0n
      ? (contributionAmount * cabal.totalTokensReceived) / cabal.totalRaised
      : 0n

  // Show card if user contributed, regardless of claim status
  const showClaimCard = !!contributionAmount && contributionAmount > 0n && totalClaimAmount > 0n

  // Calculate voting power percentage (user staked / total staked)
  const userStaked = stakedBalance as bigint | undefined
  const votingPowerPercent =
    userStaked && cabal.totalStaked > 0n ? Number((userStaked * 10000n) / cabal.totalStaked) / 100 : 0

  return (
    <div className="space-y-3.5">
      {/* Claim Banner - prominent if available */}
      {showClaimCard && (
        <Card className={`${hasClaimedStatus ? "bg-muted/50" : "bg-green-500/5 border-green-500/50"}`}>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Your Contribution</p>
                  <p className="text-lg font-mono font-bold">
                    <TokenAmount amount={contributionAmount} symbol="ETH" />
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {hasClaimedStatus ? "Claimed from presale" : "Claimable from presale"}
                  </p>
                  <p className="text-xl font-mono font-bold">
                    <TokenAmount amount={totalClaimAmount} symbol={cabal.symbol} />
                  </p>
                </div>
              </div>
              <Button
                onClick={handleClaim}
                disabled={hasClaimedStatus || isClaiming || claimConfirming}
                className={hasClaimedStatus ? "" : "bg-green-600 hover:bg-green-700"}
                variant={hasClaimedStatus ? "secondary" : "default"}
              >
                {hasClaimedStatus ? "Already Claimed" : isClaiming || claimConfirming ? "Claiming..." : "Claim Tokens"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Position Card */}
        <Card>
          <CardHeader className="pt-5 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Coins className="h-5 w-5 text-muted-foreground" />
              Your Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Balance & Staked - Vertical Stack */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Wallet Balance</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-medium mt-0.5"
                    onClick={() => openStakeModal()}
                    disabled={!tokenBalance || (tokenBalance as bigint) === 0n}
                  >
                    Stake →
                  </Button>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight">
                  <TokenAmount amount={tokenBalance as bigint} decimals={2} />
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Staked</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-medium mt-0.5"
                    onClick={() => setIsUnstakeModalOpen(true)}
                    disabled={!stakedBalance || (stakedBalance as bigint) === 0n}
                  >
                    Unstake →
                  </Button>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight">
                  <TokenAmount amount={stakedBalance as bigint} decimals={2} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Governance Card */}
        <Card>
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Vote className="h-5 w-5 text-muted-foreground" />
              Governance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0 space-y-3.5">
            {/* Voting Power & Quorum - Vertical Stack */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Voting Power</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs font-medium mt-0.5"
                    onClick={() => setIsDelegateModalOpen(true)}
                  >
                    Delegate →
                  </Button>
                </div>
                <p className="text-2xl font-mono font-bold tracking-tight">{formatPercent(votingPowerPercent)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Quorum Required</p>
                <p className="text-2xl font-mono font-bold tracking-tight">
                  {Number(cabal.settings.quorumBps) / 100}%
                </p>
              </div>
            </div>

            {/* Treasury Actions */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Treasury Address</p>
                  <a
                    href={`https://basescan.org/address/${cabal.tbaAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {cabal.tbaAddress.slice(0, 8)}...{cabal.tbaAddress.slice(-6)}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button variant="outline" size="sm" onClick={handleClaimFees} disabled={isFeesClaiming}>
                  {isFeesClaiming ? "Claiming..." : "Claim LP Fees"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Presale History Card */}
      <Card>
        <CardHeader className="p-3.5 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Presale History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Total Raised</p>
              <p className="text-lg font-mono font-bold">
                <TokenAmount amount={cabal.totalRaised} symbol="ETH" />
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Contributors</p>
              <p className="text-lg font-bold">{cabal.contributorCount.toString()}</p>
            </div>
          </div>
          {!!contributionAmount && contributionAmount > 0n && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Your Contribution</span>
                <span className="font-mono font-semibold">
                  <TokenAmount amount={contributionAmount} symbol="ETH" />
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proposals */}
      <Card>
        <CardHeader className="p-3.5 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Proposals
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <div className="text-center py-6 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No active proposals</p>
            <p className="text-xs text-muted-foreground mt-1">Proposals will appear here when created</p>
          </div>
        </CardContent>
      </Card>

      {/* Unstake Modal */}
      <Dialog open={isUnstakeModalOpen} onOpenChange={setIsUnstakeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unstake ${cabal.symbol}</DialogTitle>
            <DialogDescription>Unstaking will reduce your voting power.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount to Unstake</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => stakedBalance && setUnstakeAmount(formatEther(stakedBalance as bigint))}
                >
                  Max
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Staked: <TokenAmount amount={stakedBalance as bigint} symbol={cabal.symbol} />
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUnstake}
              disabled={isUnstaking || unstakeConfirming || !unstakeAmount}
              className="w-full"
              variant="outline"
            >
              {isUnstaking || unstakeConfirming ? "Unstaking..." : "Unstake Tokens"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delegate Modal */}
      <Dialog open={isDelegateModalOpen} onOpenChange={setIsDelegateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delegate Voting Power</DialogTitle>
            <DialogDescription>
              Delegate your votes to another address, or undelegate to vote yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Your Voting Power</span>
                <span className="font-mono font-semibold">{formatPercent(votingPowerPercent)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Delegatee Address</Label>
              <Input
                placeholder="0x..."
                value={delegatee}
                onChange={(e) => setDelegatee(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDelegate} disabled={isDelegating || !delegatee} className="flex-1">
                {isDelegating ? "Delegating..." : "Delegate"}
              </Button>
              <Button onClick={handleUndelegate} disabled={isUndelegating} variant="outline" className="flex-1">
                {isUndelegating ? "Undelegating..." : "Undelegate"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Trade Modal */}
      <TradeModal
        isOpen={isTradeModalOpen}
        onOpenChange={setIsTradeModalOpen}
        cabalId={cabalId}
        cabal={cabal}
        onSuccess={() => {
          refetchStaked()
          refetchTokenBalance()
          onSuccess()
        }}
        initialTab={tradeModalTab}
      />

      {/* Stake Modal */}
      <StakeModal
        isOpen={isStakeModalOpen}
        onOpenChange={setIsStakeModalOpen}
        cabalId={cabalId}
        cabal={cabal}
        onSuccess={() => {
          refetchStaked()
          refetchTokenBalance()
          onSuccess()
        }}
      />
    </div>
  )
}

// MAIN COMPONENT

interface CabalDetailsContentProps {
  cabalId: bigint;
  initialCabal?: CabalInfo;
  onOpenTradeModal?: () => void;
}

export function CabalDetailsContent({ cabalId, initialCabal, onOpenTradeModal }: CabalDetailsContentProps) {
  const { address, isConnected } = useAccount()
  const queryClient = useQueryClient()

  // Use initialCabal if provided, otherwise fetch
  const {
    data: cabal,
    isLoading,
    refetch,
  } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabal",
    args: [cabalId],
    query: {
      initialData: initialCabal,
      enabled: !initialCabal,
    },
  }) as { data: CabalInfo | undefined; isLoading: boolean; refetch: () => void }

  const { data: ethBalance, refetch: refetchEthBalance } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getTreasuryETHBalance",
    args: [cabalId],
  })

  // Get total supply for staked percentage calculation
  const { data: totalSupply } = useReadContract({
    address: cabal?.tokenAddress,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!cabal?.tokenAddress && cabal.phase === CabalPhase.Active },
  })

  const handleSuccess = () => {
    refetch()
    refetchEthBalance()
    queryClient.invalidateQueries()
  }

  if (isLoading || !cabal) {
    return (
      <div className="space-y-3.5">
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
        <div className="h-60 bg-muted animate-pulse rounded-xl" />
      </div>
    )
  }

  const phaseLabel = ["Presale", "Active", "Paused"][cabal.phase] || "Unknown"
  const phaseColor =
    cabal.phase === CabalPhase.Presale
      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
      : cabal.phase === CabalPhase.Active
        ? "bg-green-500/10 text-green-500 border-green-500/30"
        : "bg-red-500/10 text-red-500 border-red-500/30"

  // Calculate staked percentage
  const stakedPercent =
    totalSupply && (totalSupply as bigint) > 0n && cabal.totalStaked > 0n
      ? Number((cabal.totalStaked * 10000n) / (totalSupply as bigint)) / 100
      : 0

  return (
    <div className="space-y-3.5">
      {/* Hero Card - Key Stats */}
      <Card className="overflow-hidden">
        <div className="p-3.5">
          <div className="flex justify-between items-start gap-3.5 mb-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono font-bold text-xl">${cabal.symbol}</span>
              {cabal.phase === CabalPhase.Active && (
                <a
                  href={`https://basescan.org/address/${cabal.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {cabal.tokenAddress.slice(0, 6)}...{cabal.tokenAddress.slice(-4)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${phaseColor} shrink-0`}>
              {phaseLabel}
            </span>
          </div>

          {/* Main Stats */}
          {cabal.phase === CabalPhase.Active ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Staked</p>
                <p className="text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                  {formatPercent(stakedPercent)}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Treasury ETH</p>
                <p className="text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                  <TokenAmount amount={ethBalance as bigint} decimals={6} />
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">ETH Raised</p>
                <p className="text-3xl sm:text-4xl font-mono font-bold tracking-tight">
                  <TokenAmount amount={cabal.totalRaised} decimals={6} />
                </p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground uppercase tracking-wider">Contributors</p>
                <p className="text-3xl sm:text-4xl font-bold tracking-tight">{cabal.contributorCount.toString()}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Connect prompt */}
      {!isConnected && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center space-y-3.5">
            <p className="text-muted-foreground">Connect your wallet to interact with this cabal</p>
            {/* Wallet button would typically be in header, but here as a prompt */}
            <p className="text-xs text-muted-foreground">Use the wallet button in the top right to connect</p>
          </CardContent>
        </Card>
      )}

      {/* Presale Content */}
      {isConnected && address && cabal.phase === CabalPhase.Presale && (
        <div className="grid gap-3.5 md:grid-cols-2">
          <Card>
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-5 w-5 text-muted-foreground" />
                Contribute
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <ContributeSection cabalId={cabalId} onSuccess={handleSuccess} userAddress={address} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                Launch
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <LaunchSection cabalId={cabalId} cabal={cabal} userAddress={address} onSuccess={handleSuccess} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Content */}
      {isConnected && address && cabal.phase === CabalPhase.Active && (
        <ActiveSection cabalId={cabalId} cabal={cabal} userAddress={address} onSuccess={handleSuccess} onOpenTradeModal={onOpenTradeModal} />
      )}
    </div>
  )
}
