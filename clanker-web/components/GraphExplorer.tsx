"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi"
import { parseEther } from "viem"
import { CABAL_ABI, CabalPhase, CabalInfo as FullCabalInfo } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"
import { Loader2, Sparkles, Vote, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WalletButton } from "@/components/wallet/WalletButton"
import { TokenAmount } from "@/components/TokenAmount"
import { Input } from "@/components/ui/input"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { haptics } from "@/lib/haptics"
import { forceCollide } from "d3-force"

// Dynamically import force graph to avoid SSR issues
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
})

interface CabalInfo {
  id: bigint
  symbol: string
  phase: number
  tbaAddress: string
  parentCabalId: bigint
}

interface GraphNode {
  id: string
  label: string
  phase: number
  x?: number
  y?: number
  fx?: number
  fy?: number
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

// Status indicator colors (small dots)
const PHASE_COLORS = {
  [CabalPhase.Presale]: "#eab308", // yellow
  [CabalPhase.Active]: "#22c55e", // green
  [CabalPhase.Paused]: "#ef4444", // red
  3: "#6b7280", // gray for Closed
}

// Match the EXACT color used by border-primary in dark mode
// Dark mode --primary: oklch(0.75 0.18 50) = rgb(212, 146, 54)
// Verified by color picker on the actual rendered UI panels
const BRAND_GOLD = { r: 212, g: 146, b: 54 }
const BRAND_BG = { r: 28, g: 26, b: 24 }

const SACRED_COLORS = {
  nodeFill: `rgba(${BRAND_BG.r}, ${BRAND_BG.g}, ${BRAND_BG.b}, 0.98)`,
  nodeStroke: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.7)`,
  nodeStrokeInner: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.2)`,
  nodeGlowInner: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.15)`,
  nodeGlowOuter: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.05)`,
  labelColor: "rgba(245, 240, 230, 0.95)",
  linkColor: `rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.3)`,
}

// Initial contribution for genesis (0.001 ETH minimum)
const GENESIS_CONTRIBUTION = "0.001"

// Golden ratio constant
const PHI = 1.61803

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
  
  // Calculate UI scale based on container size - used for node and panel sizing
  const CONTAINER_PADDING = 14
  const BASE_OUTER_RADIUS = 175
  const GRAPH_NODE_RADIUS = 32
  const availableRadius = dimensions.width > 0 && dimensions.height > 0
    ? Math.min(dimensions.width, dimensions.height) / 2 - CONTAINER_PADDING
    : BASE_OUTER_RADIUS
  const uiScale = availableRadius / BASE_OUTER_RADIUS
  const NODE_RADIUS = GRAPH_NODE_RADIUS * uiScale
  
  // Contribution input state
  const [contributionAmount, setContributionAmount] = useState("0.001")
  
  const { isConnected, address } = useAccount()
  
  // Genesis initialization
  const { writeContract: initGenesis, data: genesisTxHash, isPending: isGenesisLoading } = useWriteContract()
  
  const { isLoading: isGenesisConfirming, isSuccess: isGenesisSuccess } = useWaitForTransactionReceipt({
    hash: genesisTxHash,
  })

  // Get hierarchical cabal IDs only (CABAL0 and descendants, excludes legacy)
  const { data: hierarchicalIds, isLoading: isLoadingIds } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getHierarchicalCabalIds",
  }) as { data: readonly bigint[] | undefined; isLoading: boolean }

  // Get info for hierarchical cabals only
  const { data: cabalsData, isLoading: isLoadingCabals } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabals",
    args: hierarchicalIds ? [hierarchicalIds] : undefined,
    query: {
      enabled: !!hierarchicalIds && hierarchicalIds.length > 0,
    },
  }) as { data: readonly CabalInfo[] | undefined; isLoading: boolean }

  // Check if genesis is initialized
  const { data: isGenesisInitialized, refetch: refetchGenesis } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "isGenesisInitialized",
  }) as { data: boolean | undefined; refetch: () => void }
  
  // Fetch full cabal info for selected node
  const selectedCabalId = radialMenu.cabalId ? BigInt(radialMenu.cabalId) : undefined
  const { data: selectedCabal, refetch: refetchSelectedCabal } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabal",
    args: selectedCabalId ? [selectedCabalId] : undefined,
    query: { enabled: !!selectedCabalId },
  }) as { data: FullCabalInfo | undefined; refetch: () => void }
  
  // Get user's contribution for the selected cabal
  const { data: userContribution, refetch: refetchUserContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getContribution",
    args: selectedCabalId && address ? [selectedCabalId, address] : undefined,
    query: { enabled: !!selectedCabalId && !!address },
  }) as { data: bigint | undefined; refetch: () => void }
  
  // Get launch vote status
  const { data: voteStatus, refetch: refetchVoteStatus } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVoteStatus",
    args: selectedCabalId ? [selectedCabalId] : undefined,
    query: { enabled: !!selectedCabalId && radialMenu.phase === CabalPhase.Presale },
  })
  
  // Get user's vote direction
  const { data: userVote, refetch: refetchUserVote } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getLaunchVote",
    args: selectedCabalId && address ? [selectedCabalId, address] : undefined,
    query: { enabled: !!selectedCabalId && !!address && radialMenu.phase === CabalPhase.Presale },
  })
  
  // Contribute transaction
  const { writeContract: contributeWrite, data: contributeHash, isPending: isContributing, reset: resetContribute } = useWriteContract()
  const { isLoading: isContributeConfirming, isSuccess: contributeSuccess } = useWaitForTransactionReceipt({ hash: contributeHash })
  
  // Vote transaction
  const { writeContract: voteWrite, data: voteHash, isPending: isVoting, reset: resetVote } = useWriteContract()
  const { isLoading: isVoteConfirming, isSuccess: voteSuccess } = useWaitForTransactionReceipt({ hash: voteHash })
  
  // Handle genesis success
  useEffect(() => {
    if (isGenesisSuccess) {
      toast.success("Genesis initialized! CABAL0 has been created.")
      refetchGenesis()
    }
  }, [isGenesisSuccess, refetchGenesis])
  
  // Handle contribution success
  useEffect(() => {
    if (contributeSuccess && contributeHash) {
      haptics.sacredRhythm()
      toast.success(`Contributed ${contributionAmount} ETH!`)
      refetchSelectedCabal()
      refetchUserContribution()
      refetchVoteStatus()
      resetContribute()
      setContributionAmount("0.001")
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
    
    // Configure collision force with dynamic radius per node
    fg.d3Force('collision', 
      forceCollide()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .radius((node: any) => node.collisionRadius || NODE_RADIUS * 1.2)
        .strength(0.8)
        .iterations(3)
    )
    
    // Reheat simulation to animate the expansion/collapse
    fg.d3ReheatSimulation()
    
  }, [radialMenu.isOpen, radialMenu.cabalId, NODE_RADIUS])

  // Build graph data from hierarchical cabals
  const graphData = useMemo((): GraphData => {
    if (!cabalsData || cabalsData.length === 0) {
      return { nodes: [], links: [] }
    }

    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    // Create a set of valid cabal IDs for link validation
    const validIds = new Set(cabalsData.map((c) => c.id.toString()))

    cabalsData.forEach((cabal) => {
      const nodeId = cabal.id.toString()
      const isSelected = radialMenu.isOpen && radialMenu.cabalId === nodeId
      
      const node: GraphNode = {
        id: nodeId,
        label: nodeId,
        phase: cabal.phase,
        // When selected, expand collision radius to make room for radial menu
        // Use a large multiplier to push other nodes away
        collisionRadius: isSelected ? NODE_RADIUS * 4 : NODE_RADIUS * 1.2,
      }
      
      // CABAL0 (root with no parent) is ALWAYS fixed at center
      if (cabal.parentCabalId === 0n) {
        node.fx = 0
        node.fy = 0
      }
      
      nodes.push(node)

      // Add link to parent if this cabal has one and parent exists in our data
      const parentId = cabal.parentCabalId
      if (parentId > 0n && validIds.has(parentId.toString())) {
        links.push({
          source: parentId.toString(),
          target: cabal.id.toString(),
        })
      }
    })

    return { nodes, links }
  }, [cabalsData, radialMenu.isOpen, radialMenu.cabalId, NODE_RADIUS])


  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      // Haptic feedback on tap
      haptics.cardTap()
      
      // Convert node's graph coordinates to screen coordinates
      if (!graphRef.current) return
      
      const { x: screenX, y: screenY } = graphRef.current.graph2ScreenCoords(
        node.x || 0,
        node.y || 0
      )
      
      setRadialMenu({
        isOpen: true,
        cabalId: node.id,
        phase: node.phase,
        screenX,
        screenY,
      })
    },
    []
  )
  
  const closeRadialMenu = useCallback(() => {
    setRadialMenu(prev => ({ ...prev, isOpen: false }))
    setContributionAmount("0.001")
  }, [])
  
  // Track if we just handled a touch to prevent click handler from closing menu
  const justTouchedNodeRef = useRef(false)
  
  // Custom touch handler for immediate tap response on mobile
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!graphRef.current || !containerRef.current) return
    
    const touch = e.changedTouches[0]
    const rect = containerRef.current.getBoundingClientRect()
    const screenX = touch.clientX - rect.left
    const screenY = touch.clientY - rect.top
    
    // Convert screen coords to graph coords
    const graphCoords = graphRef.current.screen2GraphCoords(screenX, screenY)
    
    // Check if any node was touched
    const touchedNode = graphData.nodes.find((node) => {
      const nodeX = node.x || 0
      const nodeY = node.y || 0
      const dx = graphCoords.x - nodeX
      const dy = graphCoords.y - nodeY
      const distance = Math.sqrt(dx * dx + dy * dy)
      // Use a slightly larger hit area for touch (1.2x radius)
      return distance < NODE_RADIUS * 1.2
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
  }, [graphData.nodes, handleNodeClick, closeRadialMenu])
  
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
        toast.error(e.message || "Failed to contribute")
      },
    })
  }, [radialMenu.cabalId, contributionAmount, contributeWrite])
  
  const handleVote = useCallback((support: boolean) => {
    if (!CABAL_DIAMOND_ADDRESS) return
    
    voteWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: "voteLaunch",
      args: [BigInt(radialMenu.cabalId), support],
    }, {
      onError: (e) => {
        haptics.error()
        toast.error(e.message || "Failed to vote")
      },
    })
  }, [radialMenu.cabalId, voteWrite])

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

  // Panel sizes scaled proportionally with node
  const PANEL_SIZE = NODE_RADIUS * PHI * 2 // Diameter for all panels (1.618× node diameter)
  const PANEL_GAP = NODE_RADIUS * 2 * (PHI - 1) // Gap between node edge and panel edge (0.618× node diameter)
  const PANEL_OFFSET = NODE_RADIUS + PANEL_GAP + PANEL_SIZE / 2 // Distance from node center to panel center
  const OUTER_CIRCLE_RADIUS = availableRadius
  
  const isPresale = radialMenu.phase === CabalPhase.Presale
  const isActive = radialMenu.phase === CabalPhase.Active
  
  // Vote status parsing
  const votesFor = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[0] ?? 0n
  const totalRaisedForVote = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[2] ?? 0n
  const launchApprovedAt = (voteStatus as [bigint, bigint, bigint, bigint, bigint, bigint, bigint] | undefined)?.[5] ?? 0n
  const isLaunchApproved = launchApprovedAt > 0n
  const yesPercent = totalRaisedForVote > 0n ? Number((votesFor * 10000n) / totalRaisedForVote) / 100 : 0
  const userVotedYes = (userVote ?? 0n) === 1n
  const hasContributed = !!userContribution && userContribution > 0n
  
  const isContributeLoading = isContributing || isContributeConfirming
  const isVoteLoading = isVoting || isVoteConfirming
  
  // Fill parent container completely
  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-muted/10 rounded-xl overflow-hidden border border-primary/10 relative touch-manipulation [&_canvas]:touch-manipulation"
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
            />
            {/* Container circle - fits within viewport with consistent padding */}
            <circle
              cx={dimensions.width / 2}
              cy={dimensions.height / 2}
              r={OUTER_CIRCLE_RADIUS}
              fill="none"
              stroke={`rgba(${BRAND_GOLD.r}, ${BRAND_GOLD.g}, ${BRAND_GOLD.b}, 0.15)`}
              strokeWidth="1"
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
            linkColor={() => SACRED_COLORS.linkColor}
            linkWidth={1.5}
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
            // Hit area uses scaled NODE_RADIUS to match visual size
            const n = node as GraphNode
            const radius = NODE_RADIUS / globalScale
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
            const statusColor =
              PHASE_COLORS[n.phase as keyof typeof PHASE_COLORS] || "#6b7280"
            
            // Use scaled NODE_RADIUS to match panel sizing
            const radius = NODE_RADIUS / globalScale
            const fontSize = (NODE_RADIUS * 0.44) / globalScale
            const statusDotRadius = (NODE_RADIUS * 0.15) / globalScale
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

            // Label
            ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillStyle = SACRED_COLORS.labelColor
            ctx.fillText(label, x, y)
            
            // Status dot - top right corner
            const dotX = x + radius * 0.65
            const dotY = y - radius * 0.65
            ctx.beginPath()
            ctx.arc(dotX, dotY, statusDotRadius, 0, 2 * Math.PI)
            ctx.fillStyle = statusColor
            ctx.fill()
          }}
          backgroundColor="transparent"
          cooldownTicks={graphData.nodes.length === 1 ? 0 : 100}
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
        {radialMenu.isOpen && (
          <div 
            className="absolute pointer-events-none z-10"
            style={{
              left: radialMenu.screenX,
              top: radialMenu.screenY,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* TOP PANEL - Total Raised */}
            <div 
              className="absolute pointer-events-auto rounded-full bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center"
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE,
                left: `calc(50% - ${PANEL_SIZE / 2}px)`,
                top: -PANEL_OFFSET - PANEL_SIZE / 2,
              }}
            >
              {selectedCabal ? (
                <div className="px-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Raised</p>
                  <p className="text-base font-bold font-mono">
                    <TokenAmount amount={selectedCabal.totalRaised} symbol="ETH" decimals={4} />
                  </p>
                </div>
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* BOTTOM PANEL - Your Position */}
            <div 
              className="absolute pointer-events-auto rounded-full bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center"
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE,
                left: `calc(50% - ${PANEL_SIZE / 2}px)`,
                top: PANEL_OFFSET - PANEL_SIZE / 2,
              }}
            >
              <div className="px-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">You</p>
                <p className="text-base font-bold font-mono">
                  {hasContributed ? (
                    <TokenAmount amount={userContribution} symbol="ETH" decimals={4} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
            </div>
            
            {/* LEFT PANEL - Contribute (Presale) or Trade (Active) - Golden ratio pill */}
            <div 
              className="absolute pointer-events-auto bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE * PHI, // Golden ratio height
                borderRadius: PANEL_SIZE / 2, // Pill shape
                left: -PANEL_OFFSET - PANEL_SIZE / 2,
                top: `calc(50% - ${(PANEL_SIZE * PHI) / 2}px)`,
              }}
            >
              {isPresale ? (
                // Contribute Panel
                !isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect to contribute</p>
                  </div>
                ) : (
                  <div className="px-3 py-3 space-y-2 w-full text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Join</p>
                    <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        className="font-mono text-center text-xs h-7 px-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
disabled={isContributeLoading}
                      />
                    <Button
                      onClick={handleContribute}
                      disabled={isContributeLoading || !contributionAmount}
                      className="w-full h-8 text-xs"
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
                // Trade Panel
                <button
                  onClick={() => onSelectCabal?.(BigInt(radialMenu.cabalId))}
                  className="w-full h-full flex flex-col items-center justify-center hover:bg-primary/10 transition-colors"
                >
                  <ArrowLeftRight className="h-6 w-6 text-primary mb-1" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Trade</p>
                </button>
              ) : (
                <div className="px-2">
                  <p className="text-xs text-muted-foreground">Paused</p>
                </div>
              )}
            </div>
            
            {/* RIGHT PANEL - Vote/Launch (Presale) or Info (Active) - Golden ratio pill */}
            <div 
              className="absolute pointer-events-auto bg-background/95 border border-primary/40 shadow-xl backdrop-blur-md flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                width: PANEL_SIZE,
                height: PANEL_SIZE * PHI, // Golden ratio height
                borderRadius: PANEL_SIZE / 2, // Pill shape
                left: PANEL_OFFSET - PANEL_SIZE / 2,
                top: `calc(50% - ${(PANEL_SIZE * PHI) / 2}px)`,
              }}
            >
              {isPresale ? (
                // Vote Panel
                !isConnected ? (
                  <div className="px-2 space-y-1">
                    <p className="text-xs text-muted-foreground">Connect to vote</p>
                  </div>
                ) : !hasContributed ? (
                  <div className="px-2 space-y-1">
                    <Vote className="h-5 w-5 text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">Contribute to vote</p>
                  </div>
                ) : isLaunchApproved ? (
                  <div className="px-2 space-y-1">
                    <p className="text-lg">🚀</p>
                    <p className="text-xs font-medium">Approved!</p>
                  </div>
                ) : (
                  <div className="px-3 py-3 space-y-2 w-full">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Launch</p>
                    {/* Vote Progress */}
                    <div className="space-y-1">
                      <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-primary rounded-l-full transition-all"
                          style={{ width: `${yesPercent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {yesPercent.toFixed(0)}% / 51%
                      </p>
                    </div>
                    {/* Vote Button - Yes only */}
                    <Button
                      onClick={() => handleVote(true)}
                      disabled={isVoteLoading || userVotedYes}
                      variant={userVotedYes ? "default" : "outline"}
                      className="w-full h-8 text-xs"
                      size="sm"
                    >
                      {isVoteLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        userVotedYes ? "✓ Voted" : "Vote Yes"
                      )}
                    </Button>
                  </div>
                )
              ) : isActive ? (
                // Stakers info for active
                <div className="px-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Stakers</p>
                  <p className="text-base font-bold font-mono">
                    {selectedCabal?.contributorCount?.toString() ?? "—"}
                  </p>
                </div>
              ) : (
                <div className="px-2">
                  <p className="text-xs text-muted-foreground">—</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  )
}
