"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { formatEther, parseEther, erc20Abi } from "viem"
import { toast } from "sonner"
import { ExternalLink, Coins, Vote, Settings, History, Rocket, Loader2 } from "lucide-react"

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
import { Ticker } from "@/components/Ticker"
import { TradeModal } from "@/components/TradeModal"
import { StakeModal } from "@/components/StakeModal"
import { ContributeCTA } from "@/components/layout/ContributeCTA"
import { CABAL_ABI, CabalInfo, CabalPhase, ProposalState } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"
import { Network, GitBranch, Lock } from "lucide-react"

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
  const queryClient = useQueryClient()
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  
  // Read launch vote status
  const { data: voteStatus, refetch: refetchVoteStatus } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVoteStatus",
    args: [cabalId],
  })
  
  // Get user's current vote direction: 0 = not voted, 1 = YES, 2 = NO
  const { data: userVote, refetch: refetchUserVote } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVote",
    args: [cabalId, userAddress as `0x${string}`],
  })
  
  // Check user contribution
  const { data: userContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getContribution",
    args: [cabalId, userAddress as `0x${string}`],
  })

  // Vote transaction - auto-launches when thresholds met
  const { writeContract: voteWrite, data: voteHash, isPending: isVoting } = useWriteContract()
  const { isLoading: isVoteConfirming, isSuccess: voteSuccess } = useWaitForTransactionReceipt({ hash: voteHash })

  // Finalize (launch) transaction
  const { writeContract: finalizeWrite, data: finalizeHash, isPending: isFinalizing } = useWriteContract()
  const { isLoading: isFinalizeConfirming, isSuccess: finalizeSuccess } = useWaitForTransactionReceipt({ hash: finalizeHash })

  useEffect(() => {
    if (voteSuccess && voteHash) {
      showTransactionToast(voteHash, "Vote cast!")
      refetchVoteStatus()
      refetchUserVote()
      queryClient.invalidateQueries()
      // Check if the vote triggered auto-launch (phase will change)
      onSuccess()
      setShowLaunchConfirm(false)
    }
  }, [voteSuccess, voteHash, refetchVoteStatus, refetchUserVote, queryClient, onSuccess])

  useEffect(() => {
    if (finalizeSuccess && finalizeHash) {
      showTransactionToast(finalizeHash, "Cabal launched! 🚀")
      queryClient.invalidateQueries()
      onSuccess()
    }
  }, [finalizeSuccess, finalizeHash, queryClient, onSuccess])

  const handleFinalize = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    finalizeWrite(
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

  const executeVote = (support: boolean) => {
    if (!CABAL_DIAMOND_ADDRESS) return
    voteWrite(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "voteLaunch",
        args: [cabalId, support],
      },
      {
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const votesFor = voteStatus?.[0] ?? 0n
  const votesAgainst = voteStatus?.[1] ?? 0n
  const totalRaised = voteStatus?.[2] ?? 0n
  const majorityRequired = voteStatus?.[3] ?? 0n
  const launchApprovedAt = voteStatus?.[5] ?? 0n
  const launchableAt = voteStatus?.[6] ?? 0n
  const hasContributed = !!userContribution && userContribution > 0n
  const contributionAmount = userContribution ?? 0n
  
  // Vote direction: 0 = not voted, 1 = voted YES, 2 = voted NO
  const currentVote = userVote ?? 0n
  const userVotedYes = currentVote === 1n
  const userVotedNo = currentVote === 2n
  
  // Launch timer status
  const isLaunchApproved = launchApprovedAt > 0n
  const isLaunchable = launchableAt > 0n && BigInt(Math.floor(Date.now() / 1000)) >= launchableAt

  // Vote percentages (of total raised)
  const yesPercent = totalRaised > 0n ? Number((votesFor * 10000n) / totalRaised) / 100 : 0
  const noPercent = totalRaised > 0n ? Number((votesAgainst * 10000n) / totalRaised) / 100 : 0

  // Check if a YES vote would trigger launch (push over 51%)
  const wouldTriggerLaunch = !isLaunchApproved && !userVotedYes && 
    (votesFor + contributionAmount) >= majorityRequired

  const handleVote = (support: boolean) => {
    // If YES vote would trigger launch, show confirmation dialog
    if (support && wouldTriggerLaunch) {
      setShowLaunchConfirm(true)
      return
    }
    executeVote(support)
  }

  const isVoteLoading = isVoting || isVoteConfirming

  const getVoteButtonText = (isYes: boolean) => {
    const isThisVote = isYes ? userVotedYes : userVotedNo
    if (isThisVote) return isYes ? "✓ Yes" : "✓ No"
    if (isVoting) return "Confirm..."
    if (isVoteConfirming) return "Voting..."
    return isYes ? "Vote Yes" : "Vote No"
  }

  return (
    <div className="space-y-4">
      {/* Launch Approved Status */}
      {isLaunchApproved && (
        <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg text-center space-y-3">
          <div className="space-y-1">
            <p className="text-base font-medium">
              🚀 Launch Approved!
            </p>
            {isLaunchable ? (
              <p className="text-sm text-muted-foreground">Ready to launch</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Launching {new Date(Number(launchableAt) * 1000).toLocaleString()}
              </p>
            )}
          </div>
          {isLaunchable && (
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing || isFinalizeConfirming}
              className="w-full h-12 text-base gap-2"
              size="lg"
            >
              {(isFinalizing || isFinalizeConfirming) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isFinalizing || isFinalizeConfirming ? "Launching..." : "Launch Now"}
            </Button>
          )}
        </div>
      )}

      {/* Vote Visualization */}
      {!isLaunchApproved && (
        <div className="space-y-2">
          {/* Progress bar - Yes from left, No from right */}
          <div className="h-2 bg-muted rounded-full overflow-hidden relative">
            {/* 51% threshold marker */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10" 
              style={{ left: "51%" }} 
            />
            {/* Yes votes - grows from left */}
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-500 bg-primary rounded-l-full"
              style={{ width: `${yesPercent}%` }}
            />
            {/* No votes - grows from right */}
            <div
              className="absolute right-0 top-0 bottom-0 transition-all duration-500 bg-muted-foreground/50 rounded-r-full"
              style={{ width: `${noPercent}%` }}
            />
          </div>
          {/* Labels */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{yesPercent.toFixed(0)}% yes</span>
            <span className="opacity-50">51%</span>
            <span>{noPercent.toFixed(0)}% no</span>
          </div>
        </div>
      )}

      {/* Vote Buttons */}
      {!hasContributed ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Contribute to vote on launch
        </p>
      ) : !isLaunchApproved ? (
        <div className="flex gap-3">
          <Button
            onClick={() => handleVote(true)}
            disabled={isVoteLoading || userVotedYes}
            variant={userVotedYes ? "default" : "outline"}
            className="flex-1 h-12 text-base gap-2"
            size="lg"
          >
            {isVoteLoading && !userVotedYes && <Loader2 className="h-4 w-4 animate-spin" />}
            {getVoteButtonText(true)}
          </Button>
          <Button
            onClick={() => handleVote(false)}
            disabled={isVoteLoading || userVotedNo}
            variant={userVotedNo ? "default" : "outline"}
            className="flex-1 h-12 text-base gap-2"
            size="lg"
          >
            {isVoteLoading && !userVotedNo && <Loader2 className="h-4 w-4 animate-spin" />}
            {getVoteButtonText(false)}
          </Button>
        </div>
      ) : null}

      {/* Launch Confirmation Dialog */}
      <Dialog open={showLaunchConfirm} onOpenChange={setShowLaunchConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Start Launch Countdown?
            </DialogTitle>
            <DialogDescription>
              Your vote will trigger the 24-hour launch countdown. After this, the token will be deployed and trading will begin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowLaunchConfirm(false)}
              disabled={isVoteLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => executeVote(true)}
              disabled={isVoteLoading}
              className="gap-2"
            >
              {isVoteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isVoteLoading ? "Confirming..." : "Launch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// HIERARCHY SECTION - Parent/Child relationships

function HierarchySection({
  cabalId,
  onSelectCabal,
}: {
  cabalId: bigint
  onSelectCabal?: (id: bigint) => void
}) {
  // Fetch hierarchy data
  const { data: hierarchy } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabalHierarchy",
    args: [cabalId],
  }) as { data: { parentId: bigint; childIds: readonly bigint[]; phase: number; symbol: string } | undefined }

  // Get parent cabal info if exists
  const { data: parentCabal } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabal",
    args: hierarchy?.parentId ? [hierarchy.parentId] : undefined,
    query: { enabled: !!hierarchy?.parentId && hierarchy.parentId !== 0n },
  }) as { data: CabalInfo | undefined }

  // Get child cabals info
  const { data: childCabals } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabals",
    args: hierarchy?.childIds ? [hierarchy.childIds] : undefined,
    query: { enabled: !!hierarchy?.childIds && hierarchy.childIds.length > 0 },
  }) as { data: readonly CabalInfo[] | undefined }

  const hasParent = hierarchy?.parentId && hierarchy.parentId !== 0n && parentCabal
  const hasChildren = hierarchy?.childIds && hierarchy.childIds.length > 0 && childCabals

  if (!hasParent && !hasChildren) {
    return null
  }

  return (
    <Card>
      <CardHeader className="p-3.5 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-muted-foreground" />
          Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3.5 pt-0 space-y-3">
        {/* Parent */}
        {hasParent && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Parent</p>
            <button
              onClick={() => onSelectCabal?.(parentCabal.id)}
              className="w-full p-2 bg-muted rounded-lg hover:bg-muted/70 transition-colors text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold font-mono">${parentCabal.symbol}</span>
                <span className="text-xs text-muted-foreground">
                  {["Presale", "Active", "Paused", "Closed"][parentCabal.phase]}
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Children */}
        {hasChildren && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Children ({hierarchy!.childIds.length})
            </p>
            <div className="space-y-1.5">
              {childCabals.map((child) => (
                <button
                  key={child.id.toString()}
                  onClick={() => onSelectCabal?.(child.id)}
                  className="w-full p-2 bg-muted rounded-lg hover:bg-muted/70 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold font-mono">${child.symbol}</span>
                    <span className="text-xs text-muted-foreground">
                      {["Presale", "Active", "Paused", "Closed"][child.phase]}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// PROPOSAL SECTION - Minimal governance voting

function ProposalSection({
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
  const queryClient = useQueryClient()

  // Get next proposal ID to know if there are any proposals
  const { data: nextProposalId } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getNextProposalId",
    args: [cabalId],
  })

  // Current proposal is nextProposalId - 1 (if exists)
  const currentProposalId = nextProposalId && nextProposalId > 0n ? nextProposalId - 1n : null

  // Fetch current proposal
  const { data: proposal, refetch: refetchProposal } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getProposal",
    args: currentProposalId !== null ? [cabalId, currentProposalId] : undefined,
    query: { enabled: currentProposalId !== null },
  })

  // Fetch proposal state
  const { data: proposalState, refetch: refetchState } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getProposalState",
    args: currentProposalId !== null ? [cabalId, currentProposalId] : undefined,
    query: { enabled: currentProposalId !== null },
  })

  // Check if user has voted
  const { data: hasVoted, refetch: refetchHasVoted } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "hasVoted",
    args: currentProposalId !== null ? [cabalId, currentProposalId, userAddress as `0x${string}`] : undefined,
    query: { enabled: currentProposalId !== null },
  })

  // Vote transaction
  const { writeContract: voteWrite, data: voteHash, isPending: isVoting } = useWriteContract()
  const { isLoading: isVoteConfirming, isSuccess: voteSuccess } = useWaitForTransactionReceipt({ hash: voteHash })

  // Execute transaction
  const { writeContract: executeWrite, data: executeHash, isPending: isExecuting } = useWriteContract()
  const { isLoading: isExecuteConfirming, isSuccess: executeSuccess } = useWaitForTransactionReceipt({ hash: executeHash })

  useEffect(() => {
    if (voteSuccess && voteHash) {
      showTransactionToast(voteHash, "Vote cast!")
      refetchProposal()
      refetchState()
      refetchHasVoted()
      queryClient.invalidateQueries()
      onSuccess()
    }
  }, [voteSuccess, voteHash, refetchProposal, refetchState, refetchHasVoted, queryClient, onSuccess])

  useEffect(() => {
    if (executeSuccess && executeHash) {
      showTransactionToast(executeHash, "Proposal executed!")
      refetchProposal()
      refetchState()
      queryClient.invalidateQueries()
      onSuccess()
    }
  }, [executeSuccess, executeHash, refetchProposal, refetchState, queryClient, onSuccess])

  const handleVote = (support: boolean) => {
    if (!CABAL_DIAMOND_ADDRESS || currentProposalId === null) return
    voteWrite(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "vote",
        args: [cabalId, currentProposalId, support],
      },
      {
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const handleExecute = () => {
    if (!CABAL_DIAMOND_ADDRESS || currentProposalId === null) return
    executeWrite(
      {
        address: CABAL_DIAMOND_ADDRESS,
        abi: CABAL_ABI,
        functionName: "executeProposal",
        args: [cabalId, currentProposalId],
      },
      {
        onError: (e) => toast.error(e.message),
      }
    )
  }

  // No proposals yet
  if (!currentProposalId || currentProposalId < 0n || !proposal) {
    return (
      <div className="text-center py-6 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground">No proposals yet</p>
      </div>
    )
  }

  const [, , forVotes, againstVotes, , , executed, cancelled, description] = proposal as [
    bigint, string, bigint, bigint, bigint, bigint, boolean, boolean, string
  ]

  const state = proposalState as ProposalState | undefined
  const totalVotes = forVotes + againstVotes
  const forPercent = totalVotes > 0n ? Number((forVotes * 10000n) / totalVotes) / 100 : 0
  const againstPercent = totalVotes > 0n ? Number((againstVotes * 10000n) / totalVotes) / 100 : 0

  const isActive = state === ProposalState.Active
  const isSucceeded = state === ProposalState.Succeeded
  const isDefeated = state === ProposalState.Defeated
  const isExecuted = state === ProposalState.Executed || executed
  const isCancelled = state === ProposalState.Cancelled || cancelled
  const userHasVoted = hasVoted as boolean
  const isVoteLoading = isVoting || isVoteConfirming
  const isExecuteLoading = isExecuting || isExecuteConfirming

  // Get state label
  const getStateLabel = () => {
    if (isExecuted) return "Executed"
    if (isCancelled) return "Cancelled"
    if (isSucceeded) return "Passed"
    if (isDefeated) return "Defeated"
    if (isActive) return "Voting"
    return "Pending"
  }

  return (
    <div className="space-y-4">
      {/* Proposal Description */}
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm font-medium">{description || "No description"}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Status: {getStateLabel()}
        </p>
      </div>

      {/* Vote Progress */}
      {!isExecuted && !isCancelled && (
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden relative">
            {/* For votes - grows from left */}
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-500 bg-primary rounded-l-full"
              style={{ width: `${forPercent}%` }}
            />
            {/* Against votes - grows from right */}
            <div
              className="absolute right-0 top-0 bottom-0 transition-all duration-500 bg-muted-foreground/50 rounded-r-full"
              style={{ width: `${againstPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{forPercent.toFixed(0)}% for</span>
            <span>{againstPercent.toFixed(0)}% against</span>
          </div>
        </div>
      )}

      {/* Vote Buttons */}
      {isActive && !userHasVoted && (
        <div className="flex gap-3">
          <Button
            onClick={() => handleVote(true)}
            disabled={isVoteLoading}
            variant="outline"
            className="flex-1 h-12 text-base gap-2"
            size="lg"
          >
            {isVoteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Vote For
          </Button>
          <Button
            onClick={() => handleVote(false)}
            disabled={isVoteLoading}
            variant="outline"
            className="flex-1 h-12 text-base gap-2"
            size="lg"
          >
            {isVoteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Vote Against
          </Button>
        </div>
      )}

      {/* Already voted */}
      {isActive && userHasVoted && (
        <p className="text-sm text-muted-foreground text-center py-2">
          ✓ You have voted
        </p>
      )}

      {/* Execute button */}
      {isSucceeded && (
        <Button
          onClick={handleExecute}
          disabled={isExecuteLoading}
          className="w-full h-12 text-base gap-2"
          size="lg"
        >
          {isExecuteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isExecuteLoading ? "Executing..." : "Execute Proposal"}
        </Button>
      )}
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

  // Show card only if user contributed AND hasn't claimed yet
  const showClaimCard = !!contributionAmount && contributionAmount > 0n && totalClaimAmount > 0n && !hasClaimedStatus

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
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Your Contribution</span>
                <span className="font-mono font-semibold">
                  <TokenAmount amount={contributionAmount} symbol="ETH" />
                </span>
              </div>
              {hasClaimedStatus && totalClaimAmount > 0n && (
                <div className="flex justify-between items-center pt-2 border-t border-primary/10">
                  <span className="text-sm text-muted-foreground">Claimed from presale</span>
                  <span className="font-mono font-semibold">
                    <TokenAmount amount={totalClaimAmount} symbol={cabal.symbol} />
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proposals */}
      <Card>
        <CardHeader className="p-3.5 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Vote className="h-5 w-5 text-muted-foreground" />
            Proposal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3.5 pt-0">
          <ProposalSection
            cabalId={cabalId}
            cabal={cabal}
            userAddress={userAddress}
            onSuccess={onSuccess}
          />
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

  // Fetch cabal data - always enabled to allow refetching
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
    },
  }) as { data: CabalInfo | undefined; isLoading: boolean; refetch: () => void }
  
  // Check if user has voted (for ContributeCTA warning)
  const { data: userVoteStatus } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVote",
    args: address ? [cabalId, address] : undefined,
    query: { enabled: !!address && cabal?.phase === CabalPhase.Presale },
  })
  const userHasVoted = (userVoteStatus ?? 0n) !== 0n

  // Watch for CabalFinalized events to update UI when presale -> active
  // Only watch during presale phase, poll every 30 seconds to reduce RPC calls
  useWatchContractEvent({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    eventName: "CabalFinalized",
    enabled: cabal?.phase === CabalPhase.Presale,
    pollingInterval: 30_000,
    onLogs(logs) {
      // Check if any log is for the current cabal
      const relevantLog = logs.find((log) => {
        const args = log.args as { cabalId?: bigint }
        return args.cabalId === cabalId
      })
      if (relevantLog) {
        // Refetch cabal data when it gets finalized
        refetch()
        refetchEthBalance()
        queryClient.invalidateQueries()
      }
    },
  })

  // Watch for contribution events to update stats
  // Only watch during presale phase, poll every 30 seconds
  useWatchContractEvent({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    eventName: "Contributed",
    enabled: cabal?.phase === CabalPhase.Presale,
    pollingInterval: 30_000,
    onLogs(logs) {
      const relevantLog = logs.find((log) => {
        const args = log.args as { cabalId?: bigint }
        return args.cabalId === cabalId
      })
      if (relevantLog) {
        refetch()
      }
    },
  })

  // Watch for trade events to keep balances in sync
  // Only watch when active (trading enabled), poll every 30 seconds
  useWatchContractEvent({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    eventName: "TokensBought",
    enabled: cabal?.phase === CabalPhase.Active,
    pollingInterval: 30_000,
    onLogs(logs) {
      const relevantLog = logs.find((log) => {
        const args = log.args as { cabalId?: bigint }
        return args.cabalId === cabalId
      })
      if (relevantLog) {
        queryClient.invalidateQueries()
      }
    },
  })

  useWatchContractEvent({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    eventName: "TokensSold",
    enabled: cabal?.phase === CabalPhase.Active,
    pollingInterval: 30_000,
    onLogs(logs) {
      const relevantLog = logs.find((log) => {
        const args = log.args as { cabalId?: bigint }
        return args.cabalId === cabalId
      })
      if (relevantLog) {
        queryClient.invalidateQueries()
      }
    },
  })

  const { data: ethBalance, refetch: refetchEthBalance } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getTreasuryETHBalance",
    args: [cabalId],
  })

  // Read user contribution for presale display
  const { data: userContribution, refetch: refetchContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getContribution",
    args: address ? [cabalId, address] : undefined,
    query: { enabled: !!address },
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
    refetchContribution()
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

  const phaseLabel = ["Presale", "Active", "Paused", "Closed"][cabal.phase] || "Unknown"
  const isClosed = cabal.phase === 3 // CabalPhase.Closed
  const phaseColor =
    cabal.phase === CabalPhase.Presale
      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
      : cabal.phase === CabalPhase.Active
        ? "bg-green-500/10 text-green-500 border-green-500/30"
        : isClosed
          ? "bg-gray-500/10 text-gray-500 border-gray-500/30"
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
              <Ticker symbol={cabal.symbol} size="xl" />
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

      {/* Hierarchy Section - always show if there's a parent or children */}
      <HierarchySection cabalId={cabalId} />

      {/* Closed State Banner */}
      {isClosed && (
        <Card className="border-gray-500/30 bg-gray-500/5">
          <CardContent className="py-6 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-gray-500" />
            <div>
              <p className="font-semibold text-gray-400">This Cabal Has Been Dissolved</p>
              <p className="text-sm text-muted-foreground mt-1">
                Treasury assets have been distributed to stakers. No further actions are possible.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connect prompt */}
      {!isConnected && !isClosed && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center space-y-3.5">
            <p className="text-muted-foreground">Connect your wallet to interact with this cabal</p>
            {/* Wallet button would typically be in header, but here as a prompt */}
            <p className="text-xs text-muted-foreground">Use the wallet button in the top right to connect</p>
          </CardContent>
        </Card>
      )}

      {/* Presale Content */}
      {isConnected && address && cabal.phase === CabalPhase.Presale && !isClosed && (
        <div className="space-y-3.5">
          {/* Contribution Card (if user has contributed) */}
          {!!userContribution && (userContribution as bigint) > 0n && (
            <Card className="bg-muted/50">
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Your Contribution</p>
                    <p className="text-lg font-mono font-bold">
                      <TokenAmount amount={userContribution as bigint} symbol="ETH" />
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Ownership</p>
                    <p className="text-lg font-mono font-bold">
                      {formatPercent(Number(((userContribution as bigint) * 10000n) / (cabal.totalRaised > 0n ? cabal.totalRaised : 1n)) / 100)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="p-3.5 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-muted-foreground" />
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

      {/* Contribute CTA (Fixed Bottom) */}
      {cabal.phase === CabalPhase.Presale && (
        <ContributeCTA cabalId={cabalId} userHasVoted={userHasVoted} onSuccess={handleSuccess} />
      )}
    </div>
  )
}
