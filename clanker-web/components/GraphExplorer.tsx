"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useAccount, useBalance, useSignTypedData, useChainId } from "wagmi"
import { parseEther, formatEther, erc20Abi, hexToSignature } from "viem"
import { readContract } from "@wagmi/core"
import { config as wagmiConfig } from "@/lib/wagmi-config"
import { CABAL_ABI, CabalPhase, CabalInfo as FullCabalInfo } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"
import { Loader2, Sparkles, TrendingUp, TrendingDown, Lock, Vote, Users, Send } from "lucide-react"
import { GovernanceActionModal, GovernanceActionType } from "@/components/GovernanceActionModal"
import { 
  buildAncestryMap, 
  getAncestorDistance, 
  getDescendantDistance, 
  areSiblings, 
  getChildren,
  CabalInfo 
} from "@/lib/graph-helpers"
import { PHI, PHI_INV, SACRED_COLORS, GENESIS_CONTRIBUTION, BRAND_GOLD, BRAND_BG } from "@/lib/graph-constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { WalletButton } from "@/components/wallet/WalletButton"
import { TokenAmount } from "@/components/TokenAmount"
import { Input } from "@/components/ui/input"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { haptics } from "@/lib/haptics"
import { formatCompact } from "@/lib/utils"
import { animateValue, ANIM_DURATION, easing } from "@/lib/animations"
import { forceCollide, forceManyBody } from "d3-force"

// Dynamically import force graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
})

interface GraphNode {
  id: string
  label: string
  phase: number
  isLaunching?: boolean
  x?: number
  y?: number
  fx?: number
  fy?: number
  // Node visual radius - children are smaller than parents
  nodeRadius?: number
  // Dynamic collision radius - expands when selected
  collisionRadius?: number
}

interface GraphLink {
  source: string
  target: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface RadialMenuState {
  isOpen: boolean
  cabalId: string
  phase: number
  screenX: number
  screenY: number
}


export function GraphExplorer({
  onSelectCabal,
}: {
  onSelectCabal?: (cabalId: bigint) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [radialMenu, setRadialMenu] = useState<RadialMenuState>({
    isOpen: false,
    cabalId: "",
    phase: 0,
    screenX: 0,
    screenY: 0,
  })
  // Animation state: 'entering' | 'entered' | 'exiting' | 'exited'
  const [menuAnimState, setMenuAnimState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>('exited')
  const menuAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Animated node radius for smooth transitions
  const [animatedRadius, setAnimatedRadius] = useState<number>(0)
  const animationFrameRef = useRef<number | null>(null)
  
  // Animated child distance for smooth transitions when parent expands/collapses
  const [animatedChildDistance, setAnimatedChildDistance] = useState<number | null>(null)
  const childAnimationFrameRef = useRef<number | null>(null)
  
  // Animated parent distance for smooth transitions when focused node's menu expands
  const [animatedParentDistance, setAnimatedParentDistance] = useState<number | null>(null)
  
  // Animated submenu ring radius for smooth expansion
  const [animatedSubmenuRingRadius, setAnimatedSubmenuRingRadius] = useState<number | null>(null)
  const submenuRingAnimationFrameRef = useRef<number | null>(null)
  
  // Entrance animation for nodes when they first appear
  const [nodeEntranceScale, setNodeEntranceScale] = useState<number>(0)
  const entranceAnimationFrameRef = useRef<number | null>(null)
  const hasTriggeredEntranceRef = useRef<boolean>(false)
  
  // Focused cabal - the node that is centered in the view
  // Clicking a child "zooms into" it, making it the focused node
  const [focusedCabalId, setFocusedCabalId] = useState<string>("0")
  
  // Animated focus transition (0 = old positions, 1 = new positions)
  const [focusTransitionProgress, setFocusTransitionProgress] = useState<number>(1)
  const focusAnimationFrameRef = useRef<number | null>(null)
  const previousFocusRef = useRef<string>("0")
  // Store previous node positions for smooth interpolation
  const previousNodePositionsRef = useRef<Map<string, { x: number; y: number; radius: number }>>(new Map())
  // Track cabal count to detect new cabals being added
  const previousCabalCountRef = useRef<number>(0)
  
  // Calculate UI scale based on container size - used for node and panel sizing
  // Use consistent padding with rest of app (3.5 = 14px / 4)
  const CONTAINER_PADDING = 3.5 * 4 // 14px - matches p-3.5 used throughout app
  const availableRadius = dimensions.width > 0 && dimensions.height > 0
    ? Math.min(dimensions.width, dimensions.height) / 2 - CONTAINER_PADDING
    : 175
  
  // Scale so expanded panels fit inside availableRadius
  // Panel outer edge = SMALL_NODE_RADIUS + PANEL_SIZE = SMALL_NODE_RADIUS × 4.236
  // SMALL_NODE_RADIUS = FULL_NODE_RADIUS × 0.618
  // So total extent = FULL_NODE_RADIUS × 0.618 × 4.236 = FULL_NODE_RADIUS × 2.618
  // Therefore: FULL_NODE_RADIUS = availableRadius / 2.618
  const FULL_NODE_RADIUS = availableRadius / 2.618
  // When expanded with panels, node shrinks to φ⁻¹ of its size
  const SMALL_NODE_RADIUS = FULL_NODE_RADIUS * 0.61803
  // Panels are φ (1.61803) × the shrunken center node
  const NODE_RADIUS = SMALL_NODE_RADIUS * 1.61803
  
  // Contribution input state
  const [contributionAmount, setContributionAmount] = useState("0.00001")
  
  // Launch confirmation dialog
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false)
  
  // Child creation confirmation dialog
  const [showChildCreateConfirm, setShowChildCreateConfirm] = useState(false)
  
  // Track which cabals are in "launching" state (presale + approved)
  // This persists across selection changes so nodes stay orange
  const [launchingCabalIds, setLaunchingCabalIds] = useState<Set<string>>(new Set())
  
  // Trading state for active cabals
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy')
  const [tradeAmount, setTradeAmount] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  
  // Staking state for active cabals
  const [stakeTab, setStakeTab] = useState<'stake' | 'unstake'>('stake')
  const [stakeAmount, setStakeAmount] = useState('')
  const [isSigning, setIsSigning] = useState(false)
  
  // Governance action modal state
  const [governanceAction, setGovernanceAction] = useState<{
    isOpen: boolean
    actionType: GovernanceActionType
  }>({ isOpen: false, actionType: 'contribute' })
  
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { signTypedDataAsync } = useSignTypedData()
  
  // Genesis initialization
  const { writeContract: initGenesis, data: genesisTxHash, isPending: isGenesisLoading } = useWriteContract()
  
  const { isLoading: isGenesisConfirming, isSuccess: isGenesisSuccess } = useWaitForTransactionReceipt({
    hash: genesisTxHash,
  })

  // Get hierarchical cabal IDs only (CABAL0 and descendants, excludes legacy)
  const { data: hierarchicalIds, isLoading: isLoadingIds, refetch: refetchHierarchicalIds } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getHierarchicalCabalIds",
  }) as { data: readonly bigint[] | undefined; isLoading: boolean; refetch: () => void }

  // Get info for hierarchical cabals only
  const { data: cabalsData, isLoading: isLoadingCabals, refetch: refetchCabalsData } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabals",
    args: hierarchicalIds ? [hierarchicalIds] : undefined,
    query: {
      enabled: !!hierarchicalIds && hierarchicalIds.length > 0,
    },
  }) as { data: readonly CabalInfo[] | undefined; isLoading: boolean; refetch: () => void }

  // Get presale cabal IDs to batch fetch their launch status
  const presaleCabalIds = useMemo(() => {
    if (!cabalsData) return []
    return cabalsData
      .filter(c => c.phase === CabalPhase.Presale)
      .map(c => c.id)
  }, [cabalsData])
  
  
  // Batch fetch launch status for ALL presale cabals on page load
  const launchStatusContracts = useMemo(() => {
    if (!CABAL_DIAMOND_ADDRESS || presaleCabalIds.length === 0) return []
    return presaleCabalIds.map(cabalId => ({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: "getLaunchVoteStatus" as const,
      args: [cabalId] as const,
    }))
  }, [presaleCabalIds])
  
  const { data: allLaunchStatuses } = useReadContracts({
    contracts: launchStatusContracts,
    query: { enabled: launchStatusContracts.length > 0 },
  })
  
  // Build set of launching cabal IDs from batch query results
  const launchingCabalIdsFromBatch = useMemo(() => {
    const launching = new Set<string>()
    if (!allLaunchStatuses || !presaleCabalIds) return launching
    
    allLaunchStatuses.forEach((result, index) => {
      if (result.status === 'success' && result.result) {
        const launchApprovedAt = (result.result as [bigint, bigint, bigint, bigint, bigint, bigint, bigint])[5]
        if (launchApprovedAt > 0n) {
          launching.add(presaleCabalIds[index].toString())
        }
      }
    })
    return launching
  }, [allLaunchStatuses, presaleCabalIds])

  // Check if genesis is initialized
  const { data: isGenesisInitialized, refetch: refetchGenesis } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "isGenesisInitialized",
  }) as { data: boolean | undefined; refetch: () => void }
  
  // Fetch full cabal info for selected node
  // Note: Use !== undefined check because 0n (CABAL0) is falsy but valid!
  const selectedCabalId = radialMenu.cabalId ? BigInt(radialMenu.cabalId) : undefined
  const hasSelectedCabal = selectedCabalId !== undefined
  
  const { data: selectedCabal, refetch: refetchSelectedCabal } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabal",
    args: hasSelectedCabal ? [selectedCabalId] : undefined,
    query: { enabled: hasSelectedCabal },
  }) as { data: FullCabalInfo | undefined; refetch: () => void }
  
  // Get user's contribution for the selected cabal
  const { data: userContribution, refetch: refetchUserContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getContribution",
    args: hasSelectedCabal && address ? [selectedCabalId, address] : undefined,
    query: { enabled: hasSelectedCabal && !!address },
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Get launch vote status
  const { data: voteStatus, refetch: refetchVoteStatus } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVoteStatus",
    args: hasSelectedCabal ? [selectedCabalId] : undefined,
    query: { enabled: hasSelectedCabal && radialMenu.phase === CabalPhase.Presale },
  })
  
  // Early extraction of launch status for graph node coloring
  const launchApprovedAtEarly = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[5] ?? 0n
  const launchableAtEarly = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[6] ?? 0n
  const isLaunchApproved = launchApprovedAtEarly > 0n
  
  // Current timestamp state - updates periodically to check eligibility for launch/child creation
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  
  const isLaunchable = launchableAtEarly > 0n && BigInt(now) >= launchableAtEarly
  
  // Track launching cabals - update when we detect one is launching
  useEffect(() => {
    if (radialMenu.cabalId && isLaunchApproved && radialMenu.phase === CabalPhase.Presale) {
      setLaunchingCabalIds(prev => {
        if (prev.has(radialMenu.cabalId)) return prev
        const next = new Set(prev)
        next.add(radialMenu.cabalId)
        return next
      })
    }
  }, [radialMenu.cabalId, isLaunchApproved, radialMenu.phase])
  
  // Clean up launching set when cabals become active
  useEffect(() => {
    if (!cabalsData) return
    const activeCabalIds = new Set(
      cabalsData.filter(c => c.phase === CabalPhase.Active).map(c => c.id.toString())
    )
    if (activeCabalIds.size > 0) {
      setLaunchingCabalIds(prev => {
        const toRemove = [...prev].filter(id => activeCabalIds.has(id))
        if (toRemove.length === 0) return prev
        const next = new Set(prev)
        toRemove.forEach(id => next.delete(id))
        return next
      })
    }
  }, [cabalsData])
  
  // Get user's vote direction
  const { data: userVote, refetch: refetchUserVote, isFetching: isUserVoteFetching } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVote",
    args: hasSelectedCabal && address ? [selectedCabalId, address] : undefined,
    query: { enabled: hasSelectedCabal && !!address && radialMenu.phase === CabalPhase.Presale },
  })
  
  // Contribute transaction
  const { writeContract: contributeWrite, data: contributeHash, isPending: isContributing, reset: resetContribute } = useWriteContract()
  const { isLoading: isContributeConfirming, isSuccess: contributeSuccess } = useWaitForTransactionReceipt({ hash: contributeHash })
  
  // Vote transaction
  const { writeContract: voteWrite, data: voteHash, isPending: isVoting, reset: resetVote } = useWriteContract()
  const { isLoading: isVoteConfirming, isSuccess: voteSuccess } = useWaitForTransactionReceipt({ hash: voteHash })
  
  // Finalize (launch) transaction
  const { writeContract: finalizeWrite, data: finalizeHash, isPending: isFinalizing, reset: resetFinalize } = useWriteContract()
  const { isLoading: isFinalizeConfirming, isSuccess: finalizeSuccess } = useWaitForTransactionReceipt({ hash: finalizeHash })
  
  // Trading hooks for active cabals
  const { writeContract: buyWrite, data: buyHash, isPending: isBuying, reset: resetBuy } = useWriteContract()
  const { isLoading: buyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({ hash: buyHash })
  
  const { writeContract: sellWrite, data: sellHash, isPending: isSelling, reset: resetSell } = useWriteContract()
  const { isLoading: sellConfirming, isSuccess: sellSuccess } = useWaitForTransactionReceipt({ hash: sellHash })
  
  const { writeContract: approveWrite, data: approveHash, isPending: approving } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  
  // ETH Balance for trading
  const { data: ethBalance } = useBalance({ address })
  
  // Treasury ETH Balance (direct TBA balance check)
  const { data: tbaEthBalance, refetch: refetchTbaBalance } = useBalance({ 
    address: selectedCabal?.tbaAddress as `0x${string}` | undefined,
    query: { enabled: !!selectedCabal?.tbaAddress }
  })
  
  // Treasury WETH Balance (LP fees are paid in WETH)
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const
  const { data: tbaWethBalance, refetch: refetchTbaWeth } = useReadContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: selectedCabal?.tbaAddress ? [selectedCabal.tbaAddress as `0x${string}`] : undefined,
    query: { enabled: !!selectedCabal?.tbaAddress }
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Treasury Token Balance (cabal's own token in treasury)
  const { data: tbaTokenBalance, refetch: refetchTbaToken } = useReadContract({
    address: selectedCabal?.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: selectedCabal?.tbaAddress ? [selectedCabal.tbaAddress as `0x${string}`] : undefined,
    query: { enabled: !!selectedCabal?.tokenAddress && !!selectedCabal?.tbaAddress && radialMenu.phase === CabalPhase.Active }
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Token balance for selling (only for active cabals)
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: selectedCabal?.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!selectedCabal?.tokenAddress && !!address && radialMenu.phase === CabalPhase.Active },
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Token allowance for selling
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: selectedCabal?.tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && CABAL_DIAMOND_ADDRESS ? [address, CABAL_DIAMOND_ADDRESS] : undefined,
    query: { enabled: !!selectedCabal?.tokenAddress && !!address && radialMenu.phase === CabalPhase.Active },
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Staked balance for staking panel
  const { data: stakedBalance, refetch: refetchStakedBalance } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getStakedBalance',
    args: hasSelectedCabal && address ? [selectedCabalId, address] : undefined,
    query: { enabled: hasSelectedCabal && !!address && radialMenu.phase === CabalPhase.Active },
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Stake write contract (uses permit)
  const { writeContract: stakeWrite, data: stakeHash, isPending: isStakePending, reset: resetStake } = useWriteContract()
  const { isLoading: stakeConfirming, isSuccess: stakeSuccess } = useWaitForTransactionReceipt({ hash: stakeHash })
  
  // Unstake write contract
  const { writeContract: unstakeWrite, data: unstakeHash, isPending: isUnstaking, reset: resetUnstake } = useWriteContract()
  const { isLoading: unstakeConfirming, isSuccess: unstakeSuccess } = useWaitForTransactionReceipt({ hash: unstakeHash })
  
  // Child creation voting (simple voting like launch voting)
  const { writeContract: voteChildWrite, data: voteChildHash, isPending: isVotingChild, reset: resetVoteChild } = useWriteContract()
  const { isLoading: voteChildConfirming, isSuccess: voteChildSuccess } = useWaitForTransactionReceipt({ hash: voteChildHash })
  
  const { writeContract: finalizeChildWrite, data: finalizeChildHash, isPending: isFinalizingChild, reset: resetFinalizeChild } = useWriteContract()
  const { isLoading: finalizeChildConfirming, isSuccess: finalizeChildSuccess } = useWaitForTransactionReceipt({ hash: finalizeChildHash })
  
  // Get child creation vote status
  const { data: childVoteStatus, refetch: refetchChildVoteStatus } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getChildCreationVoteStatus',
    args: hasSelectedCabal ? [selectedCabalId] : undefined,
    query: { enabled: hasSelectedCabal && radialMenu.phase === CabalPhase.Active },
  }) as { data: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint] | undefined; refetch: () => void }
  
  // Get user's child creation vote
  const { data: userChildVote, refetch: refetchUserChildVote, isFetching: isUserChildVoteFetching } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getChildCreationVote',
    args: hasSelectedCabal && address ? [selectedCabalId, address] : undefined,
    query: { enabled: hasSelectedCabal && !!address && radialMenu.phase === CabalPhase.Active },
  }) as { data: bigint | undefined; refetch: () => void; isFetching: boolean }
  
  // Extract child creation status for timer
  const childFinalizableAt = childVoteStatus?.[6] ?? 0n
  const childMajorityMet = childVoteStatus?.[4] ?? false
  
  // Timer effect - updates `now` every second for countdown displays
  useEffect(() => {
    // Start interval if we're in any countdown phase (launch OR child creation)
    const hasLaunchCountdown = isLaunchApproved && launchableAtEarly > 0n
    const hasChildCountdown = childMajorityMet && childFinalizableAt > 0n
    
    if (!hasLaunchCountdown && !hasChildCountdown) return
    
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000) // Update every second for countdown display
    
    return () => clearInterval(interval)
  }, [isLaunchApproved, launchableAtEarly, childMajorityMet, childFinalizableAt])
  
  // Handle genesis success
  useEffect(() => {
    if (isGenesisSuccess) {
      toast.success("Genesis initialized! CABAL0 has been created.")
      refetchGenesis()
      // Also refetch cabal data so the graph updates
      setTimeout(() => {
        refetchHierarchicalIds()
          // After IDs are fetched, refetch the cabal data
          setTimeout(() => refetchCabalsData(), 500)
      }, 1000) // Small delay to ensure blockchain state is updated
    }
  }, [isGenesisSuccess, refetchGenesis, refetchHierarchicalIds, refetchCabalsData])
  
  // Handle contribution success
  useEffect(() => {
    if (contributeSuccess && contributeHash) {
      haptics.sacredRhythm()
      toast.success(`Contributed ${contributionAmount} ETH!`)
      refetchSelectedCabal()
      refetchUserContribution()
      refetchVoteStatus()
      resetContribute()
      setContributionAmount("0.00001")
    }
  }, [contributeSuccess, contributeHash, contributionAmount, refetchSelectedCabal, refetchUserContribution, refetchVoteStatus, resetContribute])
  
  // Handle vote success
  useEffect(() => {
    if (voteSuccess && voteHash) {
      haptics.success()
      toast.success("Vote cast!")
      refetchVoteStatus()
      refetchUserVote()
      refetchSelectedCabal()
      resetVote()
    }
  }, [voteSuccess, voteHash, refetchVoteStatus, refetchUserVote, refetchSelectedCabal, resetVote])
  
  // Handle buy success
  useEffect(() => {
    if (buySuccess && buyHash) {
      haptics.success()
      toast.success("Bought tokens!")
      refetchTokenBalance()
      refetchSelectedCabal()
      refetchTbaBalance()
      setTradeAmount('')
      resetBuy()
    }
  }, [buySuccess, buyHash, refetchTokenBalance, refetchSelectedCabal, refetchTbaBalance, resetBuy])
  
  // Handle sell success
  useEffect(() => {
    if (sellSuccess && sellHash) {
      haptics.success()
      toast.success("Sold tokens!")
      refetchTokenBalance()
      refetchSelectedCabal()
      refetchTbaBalance()
      setTradeAmount('')
      resetSell()
    }
  }, [sellSuccess, sellHash, refetchTokenBalance, refetchSelectedCabal, refetchTbaBalance, resetSell])
  
  // Handle approve success - continue with sell
  const executeSell = useCallback(() => {
    if (!CABAL_DIAMOND_ADDRESS || !tradeAmount || !address) return
    
    const tokenAmount = parseEther(tradeAmount)
    const minEthOut = 0n // TODO: Add slippage
    
    sellWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'sellTokens',
      args: [BigInt(radialMenu.cabalId), tokenAmount, minEthOut],
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to sell"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 60))
        }
      },
    })
  }, [radialMenu.cabalId, tradeAmount, address, sellWrite])
  
  useEffect(() => {
    if (approveSuccess && approveHash) {
      toast.success("Approved! Selling...")
      refetchAllowance()
      setIsApproving(false)
      executeSell()
    }
  }, [approveSuccess, approveHash, refetchAllowance, executeSell])
  
  // Reset trade state when menu closes or changes
  useEffect(() => {
    if (!radialMenu.isOpen) {
      setTradeAmount('')
      setTradeTab('buy')
    }
  }, [radialMenu.isOpen])
  
  const handleBuy = useCallback((overrideAmount?: bigint) => {
    const amountToUse = overrideAmount ?? (tradeAmount ? parseEther(tradeAmount) : 0n)
    if (!CABAL_DIAMOND_ADDRESS || !address || amountToUse === 0n) return
    
    const ethAmount = amountToUse
    const minAmountOut = 0n // TODO: Add slippage
    
    buyWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'buyTokens',
      args: [BigInt(radialMenu.cabalId), minAmountOut],
      value: ethAmount,
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to buy"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 60))
        }
      },
    })
  }, [radialMenu.cabalId, tradeAmount, address, buyWrite])
  
  const handleSell = useCallback((overrideAmount?: bigint) => {
    const amountToUse = overrideAmount ?? (tradeAmount ? parseEther(tradeAmount) : 0n)
    if (!CABAL_DIAMOND_ADDRESS || !address || amountToUse === 0n || !selectedCabal?.tokenAddress) return
    
    const tokenAmount = amountToUse
    const currentAllowance = tokenAllowance ?? 0n
    
    // Check if we need approval
    if (currentAllowance < tokenAmount) {
      setIsApproving(true)
      toast.info("Approving tokens...")
      
      approveWrite({
        address: selectedCabal.tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [CABAL_DIAMOND_ADDRESS, tokenAmount],
      }, {
        onError: (e) => {
          haptics.error()
          const msg = e.message || "Failed to approve"
          if (msg.includes("User denied") || msg.includes("User rejected")) {
            toast.error("Transaction cancelled")
          } else {
            toast.error("Approval failed")
          }
          setIsApproving(false)
        },
      })
      return
    }
    
    executeSell()
  }, [radialMenu.cabalId, tradeAmount, address, selectedCabal?.tokenAddress, tokenAllowance, approveWrite, executeSell])
  
  const handleTrade = useCallback(() => {
    if (tradeTab === 'buy') {
      handleBuy()
    } else {
      handleSell()
    }
  }, [tradeTab, handleBuy, handleSell])
  
  // Handle stake success
  useEffect(() => {
    if (stakeSuccess && stakeHash) {
      haptics.success()
      toast.success("Staked!")
      refetchStakedBalance()
      refetchTokenBalance()
      refetchSelectedCabal()
      // Staking clears vote - refetch vote status
      refetchChildVoteStatus()
      refetchUserChildVote()
      setStakeAmount('')
      setIsSigning(false)
      resetStake()
    }
  }, [stakeSuccess, stakeHash, refetchStakedBalance, refetchTokenBalance, refetchSelectedCabal, refetchChildVoteStatus, refetchUserChildVote, resetStake])
  
  // Handle unstake success
  useEffect(() => {
    if (unstakeSuccess && unstakeHash) {
      haptics.success()
      toast.success("Unstaked!")
      refetchStakedBalance()
      refetchTokenBalance()
      refetchSelectedCabal()
      // Unstaking clears vote - refetch vote status
      refetchChildVoteStatus()
      refetchUserChildVote()
      setStakeAmount('')
      resetUnstake()
    }
  }, [unstakeSuccess, unstakeHash, refetchStakedBalance, refetchTokenBalance, refetchSelectedCabal, refetchChildVoteStatus, refetchUserChildVote, resetUnstake])
  
  // Handle vote child success
  useEffect(() => {
    if (voteChildSuccess && voteChildHash) {
      haptics.success()
      toast.success("Vote cast for child CABAL creation!")
      refetchChildVoteStatus()
      refetchUserChildVote()
      resetVoteChild()
    }
  }, [voteChildSuccess, voteChildHash, refetchChildVoteStatus, refetchUserChildVote, resetVoteChild])
  
  // Handle finalize child success
  useEffect(() => {
    if (finalizeChildSuccess && finalizeChildHash) {
      haptics.sacredRhythm()
      toast.success("Child CABAL created")
      refetchChildVoteStatus()
      refetchUserChildVote()
      refetchHierarchicalIds()
      refetchCabalsData()
      resetFinalizeChild()
    }
  }, [finalizeChildSuccess, finalizeChildHash, refetchChildVoteStatus, refetchUserChildVote, refetchHierarchicalIds, refetchCabalsData, resetFinalizeChild])
  
  // Reset stake state when menu closes
  useEffect(() => {
    if (!radialMenu.isOpen) {
      setStakeAmount('')
      setStakeTab('stake')
      setIsSigning(false)
    }
  }, [radialMenu.isOpen])
  
  // Refetch active cabal data when menu opens for an active cabal
  useEffect(() => {
    if (radialMenu.isOpen && radialMenu.phase === CabalPhase.Active && hasSelectedCabal) {
      // Small delay to ensure the menu state is set before refetching
      const timeout = setTimeout(() => {
        refetchStakedBalance()
        refetchTbaBalance()
        refetchTbaWeth()
        refetchTbaToken()
        refetchTokenBalance()
        refetchChildVoteStatus()
        refetchUserChildVote()
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [radialMenu.isOpen, radialMenu.phase, hasSelectedCabal, refetchStakedBalance, refetchTbaBalance, refetchTbaWeth, refetchTbaToken, refetchTokenBalance, refetchChildVoteStatus, refetchUserChildVote])
  
  // Refetch presale vote data when menu opens for a presale cabal
  useEffect(() => {
    if (radialMenu.isOpen && radialMenu.phase === CabalPhase.Presale && hasSelectedCabal) {
      // Small delay to ensure the menu state is set before refetching
      const timeout = setTimeout(() => {
        refetchVoteStatus()
        refetchUserVote()
        refetchUserContribution()
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [radialMenu.isOpen, radialMenu.phase, hasSelectedCabal, refetchVoteStatus, refetchUserVote, refetchUserContribution])
  
  const handleStake = useCallback(async (overrideAmount?: bigint) => {
    const amountToUse = overrideAmount ?? (stakeAmount ? parseEther(stakeAmount) : 0n)
    if (!CABAL_DIAMOND_ADDRESS || !address || amountToUse === 0n || !selectedCabal?.tokenAddress) return
    
    const amount = amountToUse
    setIsSigning(true)
    
    try {
      // Get nonce for permit
      const nonce = await readContract(wagmiConfig, {
        address: selectedCabal.tokenAddress,
        abi: [...erc20Abi, { 
          inputs: [{ name: 'owner', type: 'address' }], 
          name: 'nonces', 
          outputs: [{ name: '', type: 'uint256' }], 
          stateMutability: 'view', 
          type: 'function' 
        }] as const,
        functionName: 'nonces', 
        args: [address],
      })
      
      const tokenName = await readContract(wagmiConfig, { 
        address: selectedCabal.tokenAddress, 
        abi: erc20Abi, 
        functionName: 'name' 
      })
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
      
      const signature = await signTypedDataAsync({
        domain: { 
          name: tokenName, 
          version: '1', 
          chainId, 
          verifyingContract: selectedCabal.tokenAddress 
        },
        types: { 
          Permit: [
            { name: 'owner', type: 'address' }, 
            { name: 'spender', type: 'address' }, 
            { name: 'value', type: 'uint256' }, 
            { name: 'nonce', type: 'uint256' }, 
            { name: 'deadline', type: 'uint256' }
          ] 
        },
        primaryType: 'Permit',
        message: { 
          owner: address, 
          spender: CABAL_DIAMOND_ADDRESS, 
          value: amount, 
          nonce: nonce as bigint, 
          deadline 
        },
      })
      
      const { v, r, s } = hexToSignature(signature)
      
      stakeWrite({ 
        address: CABAL_DIAMOND_ADDRESS, 
        abi: CABAL_ABI, 
        functionName: 'stakeWithPermit', 
        args: [BigInt(radialMenu.cabalId), amount, deadline, Number(v), r, s] 
      }, {
        onError: (e) => {
          haptics.error()
          const msg = e.message || "Failed to stake"
          if (msg.includes("User rejected") || msg.includes("User denied")) {
            toast.error("Transaction cancelled")
          } else {
            toast.error(msg.split("\n")[0].slice(0, 60))
          }
          setIsSigning(false)
        },
      })
    } catch (e) {
      haptics.error()
      const error = e instanceof Error ? e : new Error('Failed to sign')
      if (error.message.includes('User rejected') || error.message.includes('User denied')) {
        toast.error("Transaction cancelled")
      } else {
        toast.error("Signing failed")
      }
      setIsSigning(false)
    }
  }, [radialMenu.cabalId, stakeAmount, address, selectedCabal?.tokenAddress, chainId, signTypedDataAsync, stakeWrite])
  
  const handleUnstake = useCallback((overrideAmount?: bigint) => {
    const amountToUse = overrideAmount ?? (stakeAmount ? parseEther(stakeAmount) : 0n)
    if (!CABAL_DIAMOND_ADDRESS || !address || amountToUse === 0n) return
    
    const amount = amountToUse
    
    unstakeWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'unstake',
      args: [BigInt(radialMenu.cabalId), amount],
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to unstake"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 60))
        }
      },
    })
  }, [radialMenu.cabalId, stakeAmount, address, unstakeWrite])
  
  // Execute the actual child creation vote
  const executeChildVote = useCallback((support: boolean) => {
    if (!CABAL_DIAMOND_ADDRESS || !address) return
    
    voteChildWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'voteCreateChild',
      args: [BigInt(radialMenu.cabalId), support],
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to vote"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else if (msg.includes("VoteUnchanged")) {
          toast.error("Already voted this direction")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 60))
        }
      },
    })
  }, [radialMenu.cabalId, address, voteChildWrite])
  
  // Handle voting to create a child cabal - shows confirmation if would trigger threshold
  const handleVoteChildCreation = useCallback((support: boolean) => {
    if (!CABAL_DIAMOND_ADDRESS || !address) return
    
    // Check if this vote would push over threshold (51%)
    const votesFor = childVoteStatus?.[0] ?? 0n
    const totalStaked = childVoteStatus?.[2] ?? 0n
    const majorityMet = childVoteStatus?.[4] ?? false
    const userStaked = stakedBalance ?? 0n
    
    // Calculate if vote would trigger (push over 51% majority)
    const majorityRequired = (totalStaked * 51n) / 100n
    const wouldTriggerChildCreation = support && !majorityMet && 
      userStaked > 0n && (votesFor + userStaked) >= majorityRequired
    
    if (wouldTriggerChildCreation) {
      setShowChildCreateConfirm(true)
      return
    }
    
    executeChildVote(support)
  }, [radialMenu.cabalId, address, childVoteStatus, stakedBalance, executeChildVote])
  
  // Handle finalizing child creation
  const handleFinalizeChildCreation = useCallback(() => {
    if (!CABAL_DIAMOND_ADDRESS || !address) return
    
    finalizeChildWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'finalizeChildCreation',
      args: [BigInt(radialMenu.cabalId)],
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to create child"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 60))
        }
      },
    })
  }, [radialMenu.cabalId, address, finalizeChildWrite])
  
  const handleStakeAction = useCallback(() => {
    if (stakeTab === 'stake') {
      handleStake()
    } else {
      handleUnstake()
    }
  }, [stakeTab, handleStake, handleUnstake])
  
  const handleInitializeGenesis = useCallback(() => {
    initGenesis({
      address: CABAL_DIAMOND_ADDRESS!,
      abi: CABAL_ABI,
      functionName: "initializeGenesis",
      value: parseEther(GENESIS_CONTRIBUTION),
    })
  }, [initGenesis])

  // Measure container dimensions synchronously before paint
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    const measure = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
      }
    }
    
    // Measure synchronously
    measure()
    
    // ResizeObserver for ongoing changes
    const resizeObserver = new ResizeObserver(() => {
      measure()
    })
    
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])
  
  // Fallback measurement after data loads (in case initial measurement failed)
  useEffect(() => {
    if (dimensions.width === 0 && dimensions.height === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) })
      }
    }
  }, [cabalsData, dimensions.width, dimensions.height])
  
  // Force center the graph after it's ready
  useEffect(() => {
    if (graphRef.current && dimensions.width > 0 && dimensions.height > 0) {
      // Small delay to ensure graph is fully initialized
      const timer = setTimeout(() => {
        if (graphRef.current) {
          graphRef.current.centerAt(0, 0, 0)
          graphRef.current.zoom(1, 0)
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [dimensions.width, dimensions.height, cabalsData])
  
  // Configure collision force and reheat when selection changes
  useEffect(() => {
    if (!graphRef.current) return
    
    // Access the d3 force simulation
    const fg = graphRef.current
    
    // DISABLE the default center force - it pulls all nodes to center!
    fg.d3Force('center', null)
    
    // Configure collision force with dynamic radius per node
    fg.d3Force('collision', 
      forceCollide()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .radius((node: any) => node.collisionRadius || FULL_NODE_RADIUS * 1.1)
        .strength(1)
        .iterations(5)
    )
    
    // Add strong repulsion to push nodes apart
    fg.d3Force('charge', 
      forceManyBody()
        .strength(-500)
        .distanceMax(FULL_NODE_RADIUS * 10)
    )
    
    // Reheat simulation to animate the expansion/collapse
    fg.d3ReheatSimulation()
    
  }, [radialMenu.isOpen, radialMenu.cabalId, NODE_RADIUS])
  
  // Initialize animated radius
  useEffect(() => {
    if (animatedRadius === 0 && FULL_NODE_RADIUS > 0) {
      setAnimatedRadius(FULL_NODE_RADIUS)
    }
  }, [animatedRadius, FULL_NODE_RADIUS])
  
  // Smooth radius animation when menu opens/closes
  useEffect(() => {
    const isEntering = menuAnimState === 'entering'
    const isExiting = menuAnimState === 'exiting'
    
    // Only animate on actual transitions
    if (!isEntering && !isExiting) {
      return
    }
    
    const targetRadius = isExiting ? FULL_NODE_RADIUS : SMALL_NODE_RADIUS
    const startRadius = animatedRadius || FULL_NODE_RADIUS
    
    if (Math.abs(targetRadius - startRadius) < 1) {
      setAnimatedRadius(targetRadius)
      return
    }
    
    const cleanup = animateValue({
      from: startRadius,
      to: targetRadius,
      duration: isExiting ? ANIM_DURATION.relaxed : ANIM_DURATION.smooth,
      easing: easing.easeOutCubic,
      onUpdate: setAnimatedRadius,
    })
    
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuAnimState, FULL_NODE_RADIUS, SMALL_NODE_RADIUS])

  // Animate child node distance when parent expands/collapses
  useEffect(() => {
    const isEntering = menuAnimState === 'entering'
    const isExiting = menuAnimState === 'exiting'
    
    // Only animate on actual transitions
    if (!isEntering && !isExiting) {
      return
    }
    
    const panelSize = SMALL_NODE_RADIUS * 2 * 1.61803
    const panelOuterEdge = SMALL_NODE_RADIUS + panelSize
    const childRadius = FULL_NODE_RADIUS * 0.61803
    const expandedDistance = panelOuterEdge + childRadius
    const collapsedDistance = FULL_NODE_RADIUS + childRadius
    
    const targetDistance = isExiting ? collapsedDistance : expandedDistance
    const startDistance = animatedChildDistance ?? collapsedDistance
    
    if (Math.abs(targetDistance - startDistance) < 1) {
      setAnimatedChildDistance(targetDistance)
      return
    }
    
    const cleanup = animateValue({
      from: startDistance,
      to: targetDistance,
      duration: isExiting ? ANIM_DURATION.relaxed : ANIM_DURATION.smooth,
      easing: easing.easeOutCubic,
      onUpdate: setAnimatedChildDistance,
    })
    
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuAnimState, FULL_NODE_RADIUS, SMALL_NODE_RADIUS])

  // Animate parent node distance when focused node's menu expands/collapses
  const parentDistanceStartRef = useRef<number | null>(null)
  const prevMenuAnimStateRef = useRef<string>('exited')
  
  useEffect(() => {
    // Only animate on actual state transitions, not on initial render
    const wasExited = prevMenuAnimStateRef.current === 'exited'
    const isEntering = menuAnimState === 'entering'
    const isExiting = menuAnimState === 'exiting'
    
    // Skip if not a real transition
    if (!isEntering && !isExiting) {
      prevMenuAnimStateRef.current = menuAnimState
      return
    }
    
    prevMenuAnimStateRef.current = menuAnimState
    
    const PHI = 1.61803
    const parentRadius = FULL_NODE_RADIUS * PHI
    const panelSize = SMALL_NODE_RADIUS * 2 * PHI
    const ringRadius = SMALL_NODE_RADIUS + panelSize
    
    const expandedDistance = ringRadius + parentRadius
    const collapsedDistance = FULL_NODE_RADIUS + parentRadius
    
    const targetDistance = isExiting ? collapsedDistance : expandedDistance
    const startDistance = animatedParentDistance ?? collapsedDistance
    
    if (Math.abs(targetDistance - startDistance) < 1) {
      setAnimatedParentDistance(targetDistance)
      return
    }
    
    const cleanup = animateValue({
      from: startDistance,
      to: targetDistance,
      duration: isExiting ? ANIM_DURATION.relaxed : ANIM_DURATION.smooth,
      easing: easing.easeOutCubic,
      onUpdate: setAnimatedParentDistance,
    })
    
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuAnimState, FULL_NODE_RADIUS, SMALL_NODE_RADIUS])

  // Animate submenu ring radius when menu opens/closes
  useEffect(() => {
    const isEntering = menuAnimState === 'entering'
    const isExiting = menuAnimState === 'exiting'
    
    // Only animate on actual transitions
    if (!isEntering && !isExiting) {
      return
    }
    
    const panelSize = SMALL_NODE_RADIUS * 2 * 1.61803
    const panelOffset = SMALL_NODE_RADIUS + panelSize / 2
    const expandedRingRadius = panelOffset + panelSize / 2
    const collapsedRingRadius = FULL_NODE_RADIUS
    
    const targetRadius = isExiting ? collapsedRingRadius : expandedRingRadius
    const startRadius = animatedSubmenuRingRadius ?? collapsedRingRadius
    
    if (Math.abs(targetRadius - startRadius) < 1) {
      setAnimatedSubmenuRingRadius(targetRadius)
      return
    }
    
    const cleanup = animateValue({
      from: startRadius,
      to: targetRadius,
      duration: isExiting ? ANIM_DURATION.relaxed : ANIM_DURATION.smooth,
      easing: easing.easeOutCubic,
      onUpdate: setAnimatedSubmenuRingRadius,
    })
    
    return cleanup
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuAnimState, FULL_NODE_RADIUS, SMALL_NODE_RADIUS])

  // Entrance animation - bloom nodes in when data first loads
  useEffect(() => {
    if (cabalsData && cabalsData.length > 0 && !hasTriggeredEntranceRef.current) {
      hasTriggeredEntranceRef.current = true
      
      return animateValue({
        from: 0,
        to: 1,
        duration: ANIM_DURATION.slow,
        easing: easing.easeOutCubic,
        onUpdate: setNodeEntranceScale,
      })
    }
  }, [cabalsData])

  // Snapshot current positions before focus changes
  // Use a ref to track the last computed graph data for snapshotting
  const lastGraphDataRef = useRef<GraphData>({ nodes: [], links: [] })
  
  const snapshotNodePositions = useCallback(() => {
    const nodes = lastGraphDataRef.current.nodes as GraphNode[]
    nodes.forEach((n: GraphNode) => {
      previousNodePositionsRef.current.set(n.id, {
        x: n.x ?? 0,
        y: n.y ?? 0,
        radius: n.nodeRadius ?? FULL_NODE_RADIUS
      })
    })
  }, [FULL_NODE_RADIUS])
  
  // Animate focus transitions when navigating between nodes
  useEffect(() => {
    if (focusedCabalId !== previousFocusRef.current) {
      // Note: snapshotNodePositions() and setFocusTransitionProgress(0) 
      // are called in handleNodeClick BEFORE focus changes
      
      return animateValue({
        from: 0,
        to: 1,
        duration: ANIM_DURATION.relaxed,
        easing: easing.easeOutCubic,
        onUpdate: setFocusTransitionProgress,
        onComplete: () => { previousFocusRef.current = focusedCabalId },
      })
    }
  }, [focusedCabalId])
  
  // Animate when new cabals are added (e.g., child creation)
  useEffect(() => {
    const currentCount = cabalsData?.length ?? 0
    const previousCount = previousCabalCountRef.current
    
    if (currentCount > previousCount && previousCount > 0) {
      // New cabal(s) added - snapshot and animate
      snapshotNodePositions()
      setFocusTransitionProgress(0)
      
      animateValue({
        from: 0,
        to: 1,
        duration: ANIM_DURATION.relaxed,
        easing: easing.easeOutCubic,
        onUpdate: setFocusTransitionProgress,
      })
    }
    
    previousCabalCountRef.current = currentCount
  }, [cabalsData?.length, snapshotNodePositions])

  // Build graph data from hierarchical cabals
  const graphData = useMemo((): GraphData => {
    if (!cabalsData || cabalsData.length === 0) {
      return { nodes: [], links: [] }
    }

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    // Create a set of valid cabal IDs for link validation
    const validIds = new Set(cabalsData.map((c) => c.id.toString()))

    // Build ancestry map for distance-based calculations
    const ancestryMap = buildAncestryMap(cabalsData)
    
    // Find the focused cabal
    const focusedCabal = cabalsData.find(c => c.id.toString() === focusedCabalId)
    const focusedParentId = focusedCabal?.parentCabalId?.toString()
    
    // Calculate where the focused node WAS positioned when viewing from parent
    // This is used to position ancestors in the opposite direction
    let focusedNodeAngleFromParent = Math.PI / 2 // Default: ancestors go to bottom
    if (focusedParentId && focusedParentId !== focusedCabalId) {
      const siblings = getChildren(focusedParentId, cabalsData)
      const focusedIndexInSiblings = siblings.findIndex(c => c.id.toString() === focusedCabalId)
      if (focusedIndexInSiblings >= 0 && siblings.length > 0) {
        const angleStep = (2 * Math.PI) / siblings.length
        focusedNodeAngleFromParent = -Math.PI / 2 + focusedIndexInSiblings * angleStep
      }
    }
    
    // Helper: recursively calculate node position
    // positionCache stores {x, y, radius} for each node
    const positionCache = new Map<string, {x: number, y: number, radius: number}>()
    
    // Calculate size based on distance from focused
    const getNodeRadius = (nodeId: string): number => {
      const ancestorDist = getAncestorDistance(focusedCabalId, nodeId, ancestryMap)
      const descendantDist = getDescendantDistance(focusedCabalId, nodeId, ancestryMap)
      const isSibling = areSiblings(focusedCabalId, nodeId, cabalsData)
      
      if (ancestorDist === 0 && descendantDist === 0) {
        return FULL_NODE_RADIUS  // Focused node
      } else if (ancestorDist > 0) {
        return FULL_NODE_RADIUS * Math.pow(PHI, ancestorDist)  // Ancestors get larger
      } else if (descendantDist > 0) {
        return FULL_NODE_RADIUS * Math.pow(PHI_INV, descendantDist)  // Descendants get smaller
      } else if (isSibling) {
        return FULL_NODE_RADIUS  // Siblings same size as focused
      } else {
        return FULL_NODE_RADIUS * Math.pow(PHI_INV, 3)  // Unrelated - tiny
      }
    }
    
    // Recursive position calculator
    const getNodePosition = (nodeId: string): {x: number, y: number, radius: number} => {
      // Check cache first
      if (positionCache.has(nodeId)) {
        return positionCache.get(nodeId)!
      }
      
      const cabal = cabalsData.find(c => c.id.toString() === nodeId)
      if (!cabal) return {x: 9999, y: 9999, radius: FULL_NODE_RADIUS * 0.1}
      
      const thisRadius = getNodeRadius(nodeId)
      const ancestorDist = getAncestorDistance(focusedCabalId, nodeId, ancestryMap)
      const descendantDist = getDescendantDistance(focusedCabalId, nodeId, ancestryMap)
      const isSibling = areSiblings(focusedCabalId, nodeId, cabalsData)
      const parentId = cabal.parentCabalId.toString()
      
      let x = 0, y = 0
      
      if (nodeId === focusedCabalId) {
        // Focused node at center
        x = 0
        y = 0
      } else if (ancestorDist > 0) {
        // Ancestors: position behind focused, stacking outward
        // Each ancestor is positioned behind its child in the chain
        const angle = focusedNodeAngleFromParent + Math.PI
        
        // Calculate cumulative distance for this ancestor level
        let cumulativeDistance = 0
        for (let level = 1; level <= ancestorDist; level++) {
          const levelRadius = FULL_NODE_RADIUS * Math.pow(PHI, level)
          const prevRadius = level === 1 ? FULL_NODE_RADIUS : FULL_NODE_RADIUS * Math.pow(PHI, level - 1)
          // Use animated distance for level 1 (parent)
          if (level === 1 && animatedParentDistance !== null) {
            cumulativeDistance = animatedParentDistance
          } else {
            cumulativeDistance += prevRadius + levelRadius
          }
        }
        
        x = Math.cos(angle) * cumulativeDistance
        y = Math.sin(angle) * cumulativeDistance
      } else if (descendantDist > 0) {
        // Descendants: position around their parent
        // First, get parent's position recursively
        const parentPos = getNodePosition(parentId)
        const parentRadius = parentPos.radius
        
        // Get siblings (children of this node's parent)
        const siblings = getChildren(parentId, cabalsData)
        const myIndex = siblings.findIndex(c => c.id.toString() === nodeId)
        const siblingCount = siblings.length
        
        // Calculate angle around parent
        const angleStep = (2 * Math.PI) / siblingCount
        const angle = -Math.PI / 2 + myIndex * angleStep
        
        // Calculate distance from parent
        let distFromParent: number
        if (descendantDist === 1 && animatedChildDistance !== null) {
          // Direct child of focused - use animated distance from CENTER
          distFromParent = animatedChildDistance
          // For direct children, position from center, not from parent
          x = Math.cos(angle) * distFromParent
          y = Math.sin(angle) * distFromParent
        } else {
          // Deeper descendants - position around their parent
          distFromParent = parentRadius + thisRadius
          x = parentPos.x + Math.cos(angle) * distFromParent
          y = parentPos.y + Math.sin(angle) * distFromParent
        }
      } else if (isSibling) {
        // Siblings of focused: positioned around the parent
        const parentPos = getNodePosition(focusedParentId!)
        const parentRadius = parentPos.radius
        
        // Get all siblings including focused
        const allSiblings = getChildren(focusedParentId!, cabalsData)
        const myIndex = allSiblings.findIndex(c => c.id.toString() === nodeId)
        const siblingCount = allSiblings.length
        
        const angleStep = (2 * Math.PI) / siblingCount
        const angle = -Math.PI / 2 + myIndex * angleStep
        const distFromParent = parentRadius + thisRadius
        
        x = parentPos.x + Math.cos(angle) * distFromParent
        y = parentPos.y + Math.sin(angle) * distFromParent
      } else {
        // Unrelated node - position relative to its parent if parent is visible
        // This keeps children attached to their parents during transitions
        const parentPos = getNodePosition(parentId)
        
        // If parent is off-screen, we're also off-screen
        if (Math.abs(parentPos.x) > 2000 || Math.abs(parentPos.y) > 2000) {
          x = 9999
          y = 9999
        } else {
          // Stay attached to parent
          const siblings = getChildren(parentId, cabalsData)
          const myIndex = siblings.findIndex(c => c.id.toString() === nodeId)
          const siblingCount = Math.max(1, siblings.length)
          
          const angleStep = (2 * Math.PI) / siblingCount
          const angle = -Math.PI / 2 + myIndex * angleStep
          const distFromParent = parentPos.radius + thisRadius
          
          x = parentPos.x + Math.cos(angle) * distFromParent
          y = parentPos.y + Math.sin(angle) * distFromParent
        }
      }
      
      const result = {x, y, radius: thisRadius}
      positionCache.set(nodeId, result)
      return result
    }
    
    // Calculate positions and interpolate for smooth sacred geometry transitions
    const t = focusTransitionProgress
    
    cabalsData.forEach((cabal) => {
      const nodeId = cabal.id.toString()
      const isSelected = radialMenu.isOpen && radialMenu.cabalId === nodeId
      
      // Check if this cabal is in "launching" state
      const isThisLaunching = cabal.phase === CabalPhase.Presale && (
        launchingCabalIdsFromBatch.has(nodeId) ||
        launchingCabalIds.has(nodeId) || 
        (isSelected && isLaunchApproved)
      )
      
      // Get TARGET position using the recursive position calculator
      // Positions are calculated relative to parents
      const {x: targetX, y: targetY, radius: targetRadius} = getNodePosition(nodeId)
      
      // Get PREVIOUS position from snapshot (taken before focus change)
      const prevPos = previousNodePositionsRef.current.get(nodeId)
      
      // Interpolate from previous to target using sacred easing
      // t=0: show previous position, t=1: show target position
      let currentX: number, currentY: number, currentRadius: number
      
      if (prevPos && t < 1) {
        // Smooth interpolation with easing (already applied by animateValue)
        currentX = prevPos.x + (targetX - prevPos.x) * t
        currentY = prevPos.y + (targetY - prevPos.y) * t
        currentRadius = prevPos.radius + (targetRadius - prevPos.radius) * t
      } else {
        // No previous position or transition complete
        currentX = targetX
        currentY = targetY
        currentRadius = targetRadius
      }
      
      const node: GraphNode = {
        id: nodeId,
        label: nodeId,
        phase: cabal.phase,
        isLaunching: isThisLaunching,
        nodeRadius: currentRadius,
        collisionRadius: isSelected ? currentRadius * 1.5 : currentRadius * 1.1,
        x: currentX,
        y: currentY,
        fx: currentX,
        fy: currentY,
      }
      
      nodes.push(node)

      // Add link to parent if this is a child cabal (not the root)
      // CABAL1's parent is CABAL0 (id=0), so we can't use parentId > 0
      if (cabal.id !== 0n && validIds.has(cabal.parentCabalId.toString())) {
        links.push({
          source: cabal.parentCabalId.toString(),
          target: cabal.id.toString(),
        })
      }
    })

    const result = { nodes, links }
    // Store for snapshotting before focus transitions
    lastGraphDataRef.current = result
    return result
  }, [cabalsData, radialMenu.isOpen, radialMenu.cabalId, NODE_RADIUS, isLaunchApproved, launchingCabalIds, launchingCabalIdsFromBatch, animatedChildDistance, animatedParentDistance, FULL_NODE_RADIUS, SMALL_NODE_RADIUS, focusedCabalId, focusTransitionProgress])


  const closeRadialMenu = useCallback(() => {
    // Clear any pending animation
    if (menuAnimTimeoutRef.current) {
      clearTimeout(menuAnimTimeoutRef.current)
      menuAnimTimeoutRef.current = null
    }
    
    // Trigger exit animation - node expands immediately
    setMenuAnimState('exiting')
    
    menuAnimTimeoutRef.current = setTimeout(() => {
      setRadialMenu(prev => ({ ...prev, isOpen: false }))
      setMenuAnimState('exited')
      setContributionAmount("0.00001")
    }, 500) // Match expand animation duration (500ms)
  }, [])
  
  // Handle finalize (launch) success - placed after closeRadialMenu is defined
  useEffect(() => {
    if (finalizeSuccess && finalizeHash) {
      haptics.sacredRhythm()
      toast.success("Cabal launched!")
      refetchSelectedCabal()
      resetFinalize()
      closeRadialMenu()
    }
  }, [finalizeSuccess, finalizeHash, refetchSelectedCabal, resetFinalize, closeRadialMenu])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      // Debounce rapid clicks (prevents touch + click double-firing)
      const now = Date.now()
      if (now - lastNodeClickRef.current < 300) {
        return
      }
      lastNodeClickRef.current = now
      
      // Haptic feedback on tap
      haptics.cardTap()
      
      // If clicking a non-focused node, zoom into it (make it focused)
      if (node.id !== focusedCabalId) {
        // If menu is open, just close it - don't also refocus
        if (radialMenu.isOpen) {
          closeRadialMenu()
          return
        }
        // Menu is closed, so refocus to the clicked node
        // Snapshot current positions BEFORE changing focus
        snapshotNodePositions()
        // Reset transition progress to 0 IMMEDIATELY to prevent flash
        setFocusTransitionProgress(0)
        // Reset animated distances for the new focus context
        setAnimatedChildDistance(null)
        setAnimatedParentDistance(null)
        setAnimatedSubmenuRingRadius(null)
        // Set the clicked node as focused - this will re-center the view
        setFocusedCabalId(node.id)
        return
      }
      
      // Clicking the focused node - toggle radial menu
      if (radialMenu.isOpen && radialMenu.cabalId === node.id) {
        closeRadialMenu()
        return
      }
      
      // Convert node's graph coordinates to screen coordinates
      if (!graphRef.current) return
      
      // Focused node is always at center (0,0)
      const screenX = dimensions.width / 2
      const screenY = dimensions.height / 2
      
      // Clear any pending exit animation
      if (menuAnimTimeoutRef.current) {
        clearTimeout(menuAnimTimeoutRef.current)
        menuAnimTimeoutRef.current = null
      }
      
      setRadialMenu({
        isOpen: true,
        cabalId: node.id,
        phase: node.phase,
        screenX,
        screenY,
      })
      
      // Trigger entering animation
      setMenuAnimState('entering')
      menuAnimTimeoutRef.current = setTimeout(() => {
        setMenuAnimState('entered')
      }, 400) // Match animation duration (0.382s + buffer)
    },
    [dimensions.width, dimensions.height, radialMenu.isOpen, radialMenu.cabalId, closeRadialMenu, focusedCabalId, snapshotNodePositions]
  )
  
  // Track if we just handled a touch to prevent click handler from closing menu
  const justTouchedNodeRef = useRef(false)
  // Debounce node clicks to prevent double-firing on mobile
  const lastNodeClickRef = useRef(0)
  
  // Custom touch handler for immediate tap response on mobile
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!graphRef.current || !containerRef.current) return
    
    const touch = e.changedTouches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const screenX = touch.clientX - rect.left
    const screenY = touch.clientY - rect.top
    
    // Convert screen coords to graph coords
    const graphCoords = graphRef.current.screen2GraphCoords(screenX, screenY)
    
    // Check if any node was touched - use current animated radius for open menu
    const hitRadius = radialMenu.isOpen ? Math.max(animatedRadius, SMALL_NODE_RADIUS) : FULL_NODE_RADIUS
    const touchedNode = graphData.nodes.find((node) => {
      const nodeX = node.x || 0
      const nodeY = node.y || 0
      const dx = graphCoords.x - nodeX
      const dy = graphCoords.y - nodeY
      const distance = Math.sqrt(dx * dx + dy * dy)
      // Use appropriate radius for touch hit area
      return distance < hitRadius * 1.2
    })
    
    if (touchedNode) {
      e.preventDefault()
      e.stopPropagation()
      justTouchedNodeRef.current = true
      // Clear flag after a short delay
      setTimeout(() => { justTouchedNodeRef.current = false }, 100)
      handleNodeClick(touchedNode)
    } else {
      // Touched background - close menu
      closeRadialMenu()
    }
  }, [graphData.nodes, handleNodeClick, closeRadialMenu, FULL_NODE_RADIUS, SMALL_NODE_RADIUS, radialMenu.isOpen, animatedRadius])
  
  const handleContribute = useCallback(() => {
    if (!CABAL_DIAMOND_ADDRESS || !contributionAmount) return
    
    contributeWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: "contribute",
      args: [BigInt(radialMenu.cabalId)],
      value: parseEther(contributionAmount),
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to contribute"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 80))
        }
      },
    })
  }, [radialMenu.cabalId, contributionAmount, contributeWrite])
  
  const executeVote = useCallback((support: boolean) => {
    if (!CABAL_DIAMOND_ADDRESS) return
    
    voteWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: "voteLaunch",
      args: [BigInt(radialMenu.cabalId), support],
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to vote"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 80))
        }
      },
    })
    setShowLaunchConfirm(false)
  }, [radialMenu.cabalId, voteWrite])
  
  const handleFinalize = useCallback(() => {
    if (!CABAL_DIAMOND_ADDRESS) return
    
    finalizeWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: "finalizeCabal",
      args: [BigInt(radialMenu.cabalId)],
    }, {
      onError: (e) => {
        haptics.error()
        const msg = e.message || "Failed to launch"
        if (msg.includes("User denied") || msg.includes("User rejected")) {
          toast.error("Transaction cancelled")
        } else {
          toast.error(msg.split("\n")[0].slice(0, 80))
        }
      },
    })
  }, [radialMenu.cabalId, finalizeWrite])

  const isLoading = isLoadingIds || isLoadingCabals

  // Show loading state - fills parent and centers content
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading cabal network...</p>
      </div>
    )
  }

  // Show genesis initialization prompt if not initialized - fills parent
  if (!isGenesisInitialized) {
    const isInitializing = isGenesisLoading || isGenesisConfirming
    
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-3xl">🌱</span>
        </div>
        <div>
          <h3 className="font-semibold text-lg">Genesis Required</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            The fractal DAO network has not been initialized yet. Initialize genesis
            to create CABAL0 and start the network.
          </p>
        </div>
        
        {isConnected ? (
          <Button
            onClick={handleInitializeGenesis}
            disabled={isInitializing}
            className="gap-2 button-shimmer-effect"
            size="lg"
          >
            {isInitializing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isGenesisConfirming ? "Confirming..." : "Initializing..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Initialize Genesis ({GENESIS_CONTRIBUTION} ETH)
              </>
            )}
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-muted-foreground">Connect wallet to initialize</p>
            <WalletButton />
          </div>
        )}
        
        <p className="text-xs text-muted-foreground max-w-sm">
          This creates $CABAL0, the root of the fractal DAO network.
          The initial contribution starts CABAL0&apos;s presale.
        </p>
      </div>
    )
  }

  // Show empty state if no cabals - fills parent
  if (graphData.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <span className="text-3xl">🕸️</span>
        </div>
        <div>
          <h3 className="font-semibold text-lg">No Cabals Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            The network is empty. Create the first cabal to get started.
          </p>
        </div>
      </div>
    )
  }

  // Panel sizes - φ (1.61803) × shrunken center diameter, touching (no gap)
  const PANEL_SIZE = SMALL_NODE_RADIUS * 2 * 1.61803 // φ × shrunken diameter
  // Panels tangent to center node (no gap)
  const PANEL_OFFSET = SMALL_NODE_RADIUS + PANEL_SIZE / 2
  
  // Ring tangent to the OUTER EDGE of child nodes (top of CABAL1)
  // Animates with CABAL1 when parent expands/collapses
  const childRadius = FULL_NODE_RADIUS * 0.61803
  const defaultChildCenterDistance = FULL_NODE_RADIUS + childRadius
  // Use animated distance if available, otherwise use default
  const currentChildCenterDistance = animatedChildDistance ?? defaultChildCenterDistance
  // Outer ring is fixed at child node outer edge (fractal consistency)
  // This doesn't change with menu expansion - children push outward but ring stays fixed
  const OUTER_CIRCLE_RADIUS = FULL_NODE_RADIUS + childRadius * 2
  
  const isPresale = radialMenu.phase === CabalPhase.Presale
  const isActive = radialMenu.phase === CabalPhase.Active
  
  // Layout depends on phase:
  // - Presale: 3 panels (triangle) - RAISED at top, Send ETH bottom-left, Voting bottom-right
  // - Active: 4 panels (diamond) - top, left, right, bottom
  // Position mapping:
  // Presale: 0=TOP (Raised), 2=BOTTOM-RIGHT (Vote), 3=BOTTOM-LEFT (Contribute)
  // Active: 0=TOP (Treasury), 2=RIGHT (Proposals), 3=LEFT (Trade), 4=BOTTOM (Stake)
  const getPanelPosition = (index: number, forActive: boolean = false) => {
    if (isPresale && !forActive) {
      // Triangle layout (3 panels, 120° apart)
      // RAISED at top (270°), Send ETH at bottom-left (150°), Voting at bottom-right (30°)
      const triangleAngles: Record<number, number> = {
        0: 270,  // TOP - Raised
        3: 150,  // BOTTOM-LEFT - Send ETH / Contribute
        2: 30,   // BOTTOM-RIGHT - Voting / Governance
      }
      const angle = (triangleAngles[index] ?? 0) * (Math.PI / 180)
      return {
        x: PANEL_OFFSET * Math.cos(angle),
        y: PANEL_OFFSET * Math.sin(angle),
      }
    } else {
      // Diamond layout (4 panels) - top, left, right, bottom
      // Map panel indices to diamond positions:
      // 0 -> top (270°), 2 -> right (0°), 3 -> left (180°), 4 -> bottom (90°)
      const diamondAngles: Record<number, number> = {
        0: 270,  // TOP - Treasury
        2: 0,    // RIGHT - Proposals
        3: 180,  // LEFT - Trade
        4: 90,   // BOTTOM - Stake
      }
      const angle = (diamondAngles[index] ?? 0) * (Math.PI / 180)
      return {
        x: PANEL_OFFSET * Math.cos(angle),
        y: PANEL_OFFSET * Math.sin(angle),
      }
    }
  }
  
  // Pre-calculate positions
  const panelPositions = [0, 1, 2, 3, 4].map(i => getPanelPosition(i, isActive))
  
  // Vote status parsing (isLaunchApproved defined earlier for graph node coloring)
  const votesFor = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[0] ?? 0n
  const totalRaisedForVote = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[2] ?? 0n
  const majorityRequired = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[3] ?? 0n
  const yesPercent = totalRaisedForVote > 0n ? Number((votesFor * 10000n) / totalRaisedForVote) / 100 : 0
  // Only consider user voted if we're not currently fetching fresh vote data
  const userVotedYes = !isUserVoteFetching && (userVote ?? 0n) === 1n
  const hasContributed = !!userContribution && userContribution > 0n
  
  // Check if a YES vote would trigger launch (push over 51%)
  const contributionAmount_bigint = userContribution ?? 0n
  const wouldTriggerLaunch = !isLaunchApproved && !userVotedYes && 
    (votesFor + contributionAmount_bigint) >= majorityRequired && majorityRequired > 0n
  
  // Vote handler - shows confirmation if would trigger launch
  const handleVote = (support: boolean) => {
    if (support && wouldTriggerLaunch) {
      setShowLaunchConfirm(true)
      return
    }
    executeVote(support)
  }
  
  const isContributeLoading = isContributing || isContributeConfirming
  const isVoteLoading = isVoting || isVoteConfirming
  const isTradeLoading = isBuying || buyConfirming || isSelling || sellConfirming || approving || approveConfirming || isApproving
  const isStakeLoading = isStakePending || stakeConfirming || isUnstaking || unstakeConfirming || isSigning
  
  // Fill parent container completely
  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-muted/10 rounded-xl overflow-hidden border border-primary/10 relative touch-manipulation [&_canvas]:touch-manipulation select-none"
      onTouchStart={(e) => {
        // Prevent default to avoid browser gestures interfering
        // but only if touching on canvas area
        if ((e.target as HTMLElement).tagName === 'CANVAS') {
          e.preventDefault()
        }
      }}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Skip if we just handled a touch event
        if (justTouchedNodeRef.current) return
        // Close menu if clicking on background (not a node)
        if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'CANVAS') {
          closeRadialMenu()
        }
      }}
    >
        {/* Container circle and axes - visual boundary for all nodes */}
        {dimensions.width > 0 && dimensions.height > 0 && (
          <svg 
            className="absolute inset-0 pointer-events-none"
            width={dimensions.width}
            height={dimensions.height}
          >
            {/* X axis at y=0 (center) */}
            <line
              x1={0}
              y1={dimensions.height / 2}
              x2={dimensions.width}
              y2={dimensions.height / 2}
              stroke="rgba(180, 140, 80, 0.1)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ opacity: nodeEntranceScale }}
            />
            {/* Y axis at x=0 (center) */}
            <line
              x1={dimensions.width / 2}
              y1={0}
              x2={dimensions.width / 2}
              y2={dimensions.height}
              stroke="rgba(180, 140, 80, 0.1)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ opacity: nodeEntranceScale }}
            />
            {/* Outer ring around expanded panels - grows outward with menu */}
            <circle
              cx={dimensions.width / 2}
              cy={dimensions.height / 2}
              r={animatedSubmenuRingRadius ?? FULL_NODE_RADIUS}
              fill="none"
              stroke={`rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.25)`}
              strokeWidth="1"
              style={{
                opacity: menuAnimState === 'entered' || menuAnimState === 'entering' ? 1 : 0,
                transition: 'opacity 382ms cubic-bezier(0.33, 1, 0.68, 1)'
              }}
            />
          </svg>
        )}
        {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            nodeLabel=""
            nodeRelSize={4}
            linkColor={() => 'transparent'}
            linkWidth={0}
            linkDirectionalArrowLength={0} 
            onNodeClick={handleNodeClick as (node: object) => void}
            enablePointerInteraction={true}
            enableZoomInteraction={false}
            enablePanInteraction={false}
            enableNodeDrag={false}
            d3VelocityDecay={0.3}
            d3AlphaDecay={0.02}
            d3AlphaMin={0.001}
            nodeCanvasObjectMode={() => "replace"}
          nodePointerAreaPaint={(node, color, ctx, globalScale) => {
            // Hit area uses FULL_NODE_RADIUS to match visual size
            const n = node as GraphNode
            const radius = FULL_NODE_RADIUS / globalScale
            const x = n.x || 0
            const y = n.y || 0
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
          }}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GraphNode
            const label = n.label
            const isSelected = radialMenu.isOpen && radialMenu.cabalId === n.id
            
            // Use node's own radius (children are 0.618x parent)
            const nodeBaseRadius = n.nodeRadius || FULL_NODE_RADIUS
            // Selected nodes shrink for radial menu
            const baseRadius = isSelected ? (animatedRadius || nodeBaseRadius * 0.35) : nodeBaseRadius
            // Apply entrance animation scale (blooms from 0 to 1)
            const scaledRadius = baseRadius * nodeEntranceScale
            const radius = scaledRadius / globalScale
            // Font size is φ⁻¹ (0.618) of the circle radius, also scaled for entrance
            const fontSize = (scaledRadius * 0.61803) / globalScale
            const x = n.x || 0
            const y = n.y || 0
            
            // Main disk - dark fill using BRAND_BG (matches bg-background)
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, 2 * Math.PI)
            ctx.fillStyle = `rgb(${BRAND_BG.r}, ${BRAND_BG.g}, ${BRAND_BG.b})`
            ctx.fill()
            
            // Gold border using BRAND_GOLD at 40% opacity (matches border-primary/40)
            ctx.strokeStyle = `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.4)`
            ctx.lineWidth = 1 / globalScale
            ctx.stroke()

            // Label - use Geist Mono for slashed zeros like submenu panels
            ctx.font = `600 ${fontSize}px "Geist Mono", ui-monospace, monospace`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillStyle = SACRED_COLORS.labelColor
            ctx.fillText(label, x, y)
          }}
          backgroundColor="transparent"
          cooldownTicks={0}
          warmupTicks={0}
          onEngineStop={() => {
            if (graphRef.current) {
              // Always center on (0,0) where CABAL0 is pinned
              graphRef.current.centerAt(0, 0, 0)
              graphRef.current.zoom(1, 0)
            }
          }}
          />
        )}
        
        {/* Radial Fractal UI */}
        {(radialMenu.isOpen || menuAnimState === 'exiting') && (
          <div 
            className={`absolute pointer-events-none z-10 radial-menu-container ${menuAnimState}`}
            style={{
              left: radialMenu.screenX,
              top: radialMenu.screenY,
              transform: 'translate(-50%, -50%)',
            }}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* PANEL 0: TOP - Treasury ETH (Active) or Raised (Presale) */}
            <div 
              className={`absolute pointer-events-auto rounded-full bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center radial-panel ${
                menuAnimState === 'entering' ? 'radial-panel-enter radial-delay-0' : 
                menuAnimState === 'exiting' ? 'radial-panel-exit' : 'radial-panel-visible'
              }`}
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE,
                left: panelPositions[0].x - PANEL_SIZE / 2,
                top: panelPositions[0].y - PANEL_SIZE / 2,
                transformOrigin: `${PANEL_SIZE / 2 - panelPositions[0].x}px ${PANEL_SIZE / 2 - panelPositions[0].y}px`,
                zIndex: 4,
              }}
            >
              {selectedCabal ? (
                <div className="px-2 flex flex-col items-center w-full">
                  {isActive ? (
                    // Active: Show treasury ETH
                    <>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Treasury</p>
                      <p className="text-base font-bold font-mono leading-tight">
                        <TokenAmount amount={(tbaEthBalance?.value ?? 0n) + (tbaWethBalance ?? 0n)} decimals={6} />
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ETH</p>
                    </>
                  ) : (
                    // Presale: Show raised
                    <>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Raised</p>
                      <p className="text-base font-bold font-mono leading-tight">
                        <TokenAmount amount={selectedCabal.totalRaised} decimals={6} />
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ETH</p>
                    </>
                  )}
                </div>
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* PANEL 1: Removed for presale - now using 3 panel triangle layout */}
            
            {/* PANEL 3: BOTTOM-LEFT (Presale) or LEFT (Active) - Contribute / Trade */}
            <div 
              className={`absolute pointer-events-auto bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden rounded-full radial-panel ${
                menuAnimState === 'entering' ? 'radial-panel-enter radial-delay-3' : 
                menuAnimState === 'exiting' ? 'radial-panel-exit' : 'radial-panel-visible'
              }`}
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE,
                left: panelPositions[3].x - PANEL_SIZE / 2,
                top: panelPositions[3].y - PANEL_SIZE / 2,
                transformOrigin: `${PANEL_SIZE / 2 - panelPositions[3].x}px ${PANEL_SIZE / 2 - panelPositions[3].y}px`,
                zIndex: 3,
              }}
            >
              {isPresale ? (
                // Contribute Panel
                !isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect to contribute</p>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1 w-full text-center">
                    {/* Show contributed amount */}
                    <div className="text-[11px] font-mono">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Contributed:</span>
                        <span>{formatCompact(Number(formatEther(userContribution ?? 0n)))} ETH</span>
                      </div>
                    </div>
                    <Input
                        type="number"
                        step="0.00001"
                        min="0.00001"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        className="font-mono text-center text-xs h-7 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={isContributeLoading}
                      />
                    <Button
                      onClick={handleContribute}
                      disabled={isContributeLoading || !contributionAmount}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {isContributeLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        isContributing ? "..." : isContributeConfirming ? "..." : "Send ETH"
                      )}
                    </Button>
                  </div>
                )
              ) : isActive ? (
                // Trade Panel - with token balance at top
                !isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect to trade</p>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1 w-full text-center">
                    {/* Token balance display */}
                    <div className="text-[11px] font-mono">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">${selectedCabal?.symbol ?? 'TOKEN'}:</span>
                        <span>{formatCompact(Number(formatEther(tokenBalance ?? 0n)))}</span>
                      </div>
                    </div>
                    {/* Buy/Sell Toggle */}
                    <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
                      <button
                        onClick={() => setTradeTab('buy')}
                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${
                          tradeTab === 'buy'
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => setTradeTab('sell')}
                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${
                          tradeTab === 'sell'
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Sell
                      </button>
                    </div>
                    {/* Min Buy / Max Sell Button */}
                    <Button
                      onClick={() => {
                        if (tradeTab === 'buy') {
                          // Min buy = 0.00001 ETH
                          handleBuy(parseEther('0.00001'))
                        } else {
                          // Max sell = full token balance
                          handleSell(tokenBalance ?? 0n)
                        }
                      }}
                      disabled={isTradeLoading || (tradeTab === 'sell' && (tokenBalance ?? 0n) === 0n)}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {isTradeLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        tradeTab === 'buy' ? 'Min Buy' : 'Max Sell'
                      )}
                    </Button>
                  </div>
                )
              ) : (
                <div className="px-2">
                  <p className="text-xs text-muted-foreground">Paused</p>
                </div>
              )}
            </div>
            
            {/* PANEL 2: BOTTOM-RIGHT (Presale) or RIGHT (Active) - Vote/Launch / Proposals */}
            <div 
              className={`absolute pointer-events-auto bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden rounded-full radial-panel ${
                menuAnimState === 'entering' ? 'radial-panel-enter radial-delay-2' : 
                menuAnimState === 'exiting' ? 'radial-panel-exit' : 'radial-panel-visible'
              }`}
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE,
                left: panelPositions[2].x - PANEL_SIZE / 2,
                top: panelPositions[2].y - PANEL_SIZE / 2,
                transformOrigin: `${PANEL_SIZE / 2 - panelPositions[2].x}px ${PANEL_SIZE / 2 - panelPositions[2].y}px`,
                zIndex: 1,
              }}
            >
              {isPresale ? (
                // Vote Panel
                !isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect to vote</p>
                  </div>
                ) : isLaunchApproved ? (
                  <div className="px-3 py-2 space-y-2 w-full text-center">
                    {(() => {
                      const minLaunchAmount = parseEther('0.001')
                      const totalRaised = selectedCabal?.totalRaised ?? 0n
                      const hasEnoughForLaunch = totalRaised >= minLaunchAmount
                      
                      if (isLaunchable && hasEnoughForLaunch) {
                        return (
                          <Button
                            onClick={handleFinalize}
                            disabled={isFinalizing || isFinalizeConfirming}
                            className="w-full h-8 text-xs"
                            size="sm"
                          >
                            {(isFinalizing || isFinalizeConfirming) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Launch"
                            )}
                          </Button>
                        )
                      } else if (isLaunchable && !hasEnoughForLaunch) {
                        return (
                          <>
                            <p className="text-[10px] text-muted-foreground">Need 0.001 ETH to launch</p>
                            <p className="text-xs font-mono">Have: {formatEther(totalRaised)}</p>
                          </>
                        )
                      } else {
                        return (
                          <>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Launching in</p>
                            <p className="text-lg font-mono font-bold">
                              {Math.max(0, Math.ceil((Number(launchableAtEarly) - now) / 60))} min
                            </p>
                          </>
                        )
                      }
                    })()}
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1 w-full">
                    {/* User Voting Power */}
                    <div className="text-[11px] font-mono">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Voting Power:</span>
                        <span>{(() => {
                          const totalRaised = selectedCabal?.totalRaised ?? 0n
                          const userSent = userContribution ?? 0n
                          if (totalRaised === 0n) return "0.00%"
                          const pct = Number((userSent * 10000n) / totalRaised) / 100
                          return pct.toFixed(2) + "%"
                        })()}</span>
                      </div>
                    </div>
                    {/* Vote Progress */}
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        {yesPercent.toFixed(0)}% / 51%
                      </p>
                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-primary rounded-l-full transition-all"
                          style={{ width: `${yesPercent}%` }}
                        />
                      </div>
                    </div>
                    {/* Vote Button - Yes only, disabled if hasn't contributed */}
                    <Button
                      onClick={() => handleVote(true)}
                      disabled={isVoteLoading || isUserVoteFetching || userVotedYes || !hasContributed}
                      variant={userVotedYes ? "outline" : "default"}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {isVoteLoading || isUserVoteFetching ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        userVotedYes ? "✓ Voted" : "Launch"
                      )}
                    </Button>
                  </div>
                )
              ) : isActive ? (
                // Active Cabal: Governance Actions Panel
                !isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect wallet</p>
                  </div>
                ) : (
                  <div className="px-2 py-1.5 space-y-1.5 w-full">
                    {/* Create Child Button (primary action) */}
                    {(() => {
                  const treasuryBalance = (tbaEthBalance?.value ?? 0n) + (tbaWethBalance ?? 0n)
                  const minRequired = parseEther('0.00001') // Match contract MIN_CREATION_FEE
                  const hasStake = (stakedBalance ?? 0n) > 0n
                  // Only check treasury funds if we've actually loaded the balance
                  const isTreasuryLoading = tbaEthBalance === undefined
                  const hasTreasuryFunds = isTreasuryLoading || treasuryBalance >= minRequired
                  
                  // Parse child vote status
                  const votesFor = childVoteStatus?.[0] ?? 0n
                  const votesAgainst = childVoteStatus?.[1] ?? 0n
                  const totalStaked = childVoteStatus?.[2] ?? 0n
                  const majorityMet = childVoteStatus?.[4] ?? false
                  const approvedAt = childVoteStatus?.[5] ?? 0n
                  const finalizableAt = childVoteStatus?.[6] ?? 0n
                  
                  const childYesPercent = totalStaked > 0n 
                    ? Number((votesFor * 100n) / totalStaked) 
                    : 0
                  
                  // Contract now uses a nonce system to track voting rounds
                  // getChildCreationVote returns 0 if the user's vote is from a previous (finalized) round
                  // So we can reliably trust the userChildVote value
                  const userVotedChildYes = !isUserChildVoteFetching && (userChildVote ?? 0n) === 1n
                  
                  // Use the reactive `now` state (updates every second) for countdown
                  // Edge case: majorityMet can be true but approvedAt/finalizableAt can be 0
                  // This happens if vote threshold was dynamically met due to stake changes after voting
                  // In this case, treat as finalizable immediately (or show vote button to re-trigger timer)
                  const hasApprovalTimestamp = approvedAt > 0n && finalizableAt > 0n
                  const isChildFinalizable = majorityMet && (!hasApprovalTimestamp || now >= Number(finalizableAt))
                  
                  const isChildVoteLoading = isVotingChild || voteChildConfirming || isUserChildVoteFetching
                  const isChildFinalizeLoading = isFinalizingChild || finalizeChildConfirming
                  
                  // Time remaining until finalizable (uses reactive `now` state)
                  const childTimeRemaining = finalizableAt > 0n ? Math.max(0, Number(finalizableAt) - now) : 0
                  const childMinsRemaining = Math.ceil(childTimeRemaining / 60)
                  
                  // Can vote if has stake and treasury has funds
                  const canVote = hasStake && hasTreasuryFunds
                  
                  return (
                    <div className="px-3 py-2 space-y-1.5 w-full text-center">
                      {majorityMet ? (
                        // Vote passed - show finalize or countdown
                        isChildFinalizable ? (
                          <Button
                            onClick={handleFinalizeChildCreation}
                            disabled={isChildFinalizeLoading}
                            className="w-full h-8 text-xs"
                            size="sm"
                          >
                            {isChildFinalizeLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Create CABAL"
                            )}
                          </Button>
                        ) : (
                          <>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Creating in</p>
                            <p className="text-lg font-mono font-bold">{childMinsRemaining} min</p>
                          </>
                        )
                      ) : (
                        // Voting in progress or no proposal yet - show UI even if can't vote (greyed)
                        <>
                          {/* Power display - always show */}
                          <div className={`space-y-1 ${!canVote ? 'opacity-50' : ''}`}>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Power:</span>
                              <span>{(() => {
                                const totalStaked = selectedCabal?.totalStaked ?? 0n
                                const userStaked = stakedBalance ?? 0n
                                if (totalStaked === 0n) return "0.00%"
                                const pct = Number((userStaked * 10000n) / totalStaked) / 100
                                return pct.toFixed(2) + "%"
                              })()}</span>
                            </div>
                            {/* Vote Progress bar - only show if there are votes */}
                            {votesFor > 0n && (
                              <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                                <div 
                                  className="absolute left-0 top-0 bottom-0 bg-primary rounded-l-full transition-all"
                                  style={{ width: `${childYesPercent}%` }}
                                />
                              </div>
                            )}
                          </div>
                          {/* Vote Button - disabled if no stake or no treasury funds */}
                          <Button
                            onClick={() => handleVoteChildCreation(true)}
                            disabled={!canVote || isChildVoteLoading || userVotedChildYes}
                            className="w-full h-7 text-xs"
                            size="sm"
                          >
                            {isChildVoteLoading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              userVotedChildYes ? "✓ Voted" : "Create CABAL"
                            )}
                          </Button>
                        </>
                      )}
                  </div>
                )
                })()}
                    {/* Governance Actions Grid */}
                    <div className="pt-1 border-t border-primary/20 mt-1">
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setGovernanceAction({ isOpen: true, actionType: 'contribute' })}
                          className="flex flex-col items-center gap-0.5 py-1 px-1 rounded hover:bg-primary/10 transition-colors"
                          title="Contribute to presale"
                        >
                          <Send className="h-3 w-3 text-primary" />
                          <span className="text-[8px] text-muted-foreground">Contrib</span>
                        </button>
                        <button
                          onClick={() => setGovernanceAction({ isOpen: true, actionType: 'buy' })}
                          className="flex flex-col items-center gap-0.5 py-1 px-1 rounded hover:bg-primary/10 transition-colors"
                          title="Buy tokens"
                        >
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span className="text-[8px] text-muted-foreground">Buy</span>
                        </button>
                        <button
                          onClick={() => setGovernanceAction({ isOpen: true, actionType: 'sell' })}
                          className="flex flex-col items-center gap-0.5 py-1 px-1 rounded hover:bg-primary/10 transition-colors"
                          title="Sell tokens"
                        >
                          <TrendingDown className="h-3 w-3 text-red-500" />
                          <span className="text-[8px] text-muted-foreground">Sell</span>
                        </button>
                        <button
                          onClick={() => setGovernanceAction({ isOpen: true, actionType: 'stake' })}
                          className="flex flex-col items-center gap-0.5 py-1 px-1 rounded hover:bg-primary/10 transition-colors"
                          title="Stake in cabal"
                        >
                          <Lock className="h-3 w-3 text-blue-500" />
                          <span className="text-[8px] text-muted-foreground">Stake</span>
                        </button>
                        <button
                          onClick={() => setGovernanceAction({ isOpen: true, actionType: 'vote' })}
                          className="flex flex-col items-center gap-0.5 py-1 px-1 rounded hover:bg-primary/10 transition-colors"
                          title="Vote in cabal"
                        >
                          <Vote className="h-3 w-3 text-purple-500" />
                          <span className="text-[8px] text-muted-foreground">Vote</span>
                        </button>
                        <button
                          onClick={() => setGovernanceAction({ isOpen: true, actionType: 'delegate' })}
                          className="flex flex-col items-center gap-0.5 py-1 px-1 rounded hover:bg-primary/10 transition-colors"
                          title="Delegate power"
                        >
                          <Users className="h-3 w-3 text-orange-500" />
                          <span className="text-[8px] text-muted-foreground">Deleg</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="px-2">
                  <p className="text-xs text-muted-foreground">—</p>
                </div>
              )}
            </div>
            
            {/* PANEL 4: BOTTOM CENTER - Stake (Active only) */}
            {isActive && (
              <div 
                className={`absolute pointer-events-auto bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden rounded-full radial-panel ${
                  menuAnimState === 'entering' ? 'radial-panel-enter radial-delay-4' : 
                  menuAnimState === 'exiting' ? 'radial-panel-exit' : 'radial-panel-visible'
                }`}
                style={{
                  width: PANEL_SIZE,
                  height: PANEL_SIZE,
                  left: panelPositions[4].x - PANEL_SIZE / 2,
                  top: panelPositions[4].y - PANEL_SIZE / 2,
                  transformOrigin: `${PANEL_SIZE / 2 - panelPositions[4].x}px ${PANEL_SIZE / 2 - panelPositions[4].y}px`,
                  zIndex: 2,
                }}
              >
                {!isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect to stake</p>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1 w-full text-center">
                    {/* Staked balance display */}
                    <div className="text-[11px] font-mono">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">Staked:</span>
                        <span>{formatCompact(Number(formatEther(stakedBalance ?? 0n)))}</span>
                      </div>
                    </div>
                    {/* Stake/Unstake Toggle */}
                    <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
                      <button
                        onClick={() => setStakeTab('stake')}
                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${
                          stakeTab === 'stake'
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Stake
                      </button>
                      <button
                        onClick={() => setStakeTab('unstake')}
                        className={`flex-1 py-1 text-[10px] font-medium rounded transition-all ${
                          stakeTab === 'unstake'
                            ? 'bg-foreground text-background'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Unstake
                      </button>
                    </div>
                    {/* Max Stake/Unstake Button */}
                    <Button
                      onClick={() => {
                        const maxAmount = stakeTab === 'stake' 
                          ? tokenBalance ?? 0n
                          : stakedBalance ?? 0n
                        if (stakeTab === 'stake') {
                          handleStake(maxAmount)
                        } else {
                          handleUnstake(maxAmount)
                        }
                      }}
                      disabled={isStakeLoading || (stakeTab === 'stake' ? (tokenBalance ?? 0n) === 0n : (stakedBalance ?? 0n) === 0n)}
                      className="w-full h-7 text-xs"
                      size="sm"
                    >
                      {isStakeLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        stakeTab === 'stake' ? 'Max Stake' : 'Max Unstake'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Launch Confirmation Dialog */}
        <Dialog open={showLaunchConfirm} onOpenChange={setShowLaunchConfirm}>
          <DialogContent 
            className="dialog-glow-animated"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle>
                Start 10 Minute Countdown?
              </DialogTitle>
              <DialogDescription>
                Your vote will start a countdown. After 10 minutes, anyone can finalize the launch to deploy the token and begin trading.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLaunchConfirm(false)
                }}
                disabled={isVoteLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  executeVote(true)
                }}
                disabled={isVoteLoading}
                className="gap-2"
              >
                {isVoteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isVoteLoading ? "Confirming..." : "Launch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Child Creation Confirmation Dialog */}
        <Dialog open={showChildCreateConfirm} onOpenChange={setShowChildCreateConfirm}>
          <DialogContent 
            className="dialog-glow-animated"
            onPointerDownCapture={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <DialogHeader>
              <DialogTitle>
                Start 10 Minute Countdown?
              </DialogTitle>
              <DialogDescription>
                Your vote will start a countdown. After 10 minutes, anyone can finalize to create a new child CABAL.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowChildCreateConfirm(false)
                }}
                disabled={isVotingChild || voteChildConfirming}
              >
                Cancel
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  executeChildVote(true)
                  setShowChildCreateConfirm(false)
                }}
                disabled={isVotingChild || voteChildConfirming}
                className="gap-2"
              >
                {(isVotingChild || voteChildConfirming) && <Loader2 className="h-4 w-4 animate-spin" />}
                {(isVotingChild || voteChildConfirming) ? "Confirming..." : "Create CABAL"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Governance Action Modal */}
        <GovernanceActionModal
          isOpen={governanceAction.isOpen}
          onClose={() => setGovernanceAction({ ...governanceAction, isOpen: false })}
          cabalId={BigInt(radialMenu.cabalId || "0")}
          actionType={governanceAction.actionType}
          cabals={cabalsData ?? []}
          onSuccess={() => {
            // Refetch cabals data after successful proposal
            refetchCabalsData?.()
          }}
        />
    </div>
  )
}
