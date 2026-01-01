"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi"
import { parseEther } from "viem"
import { CABAL_ABI, CabalPhase } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"
import { Loader2, Sparkles, Info, Coins, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WalletButton } from "@/components/wallet/WalletButton"
import dynamic from "next/dynamic"
import { toast } from "sonner"

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

// Golden sacred geometry colors
const SACRED_COLORS = {
  nodeFill: "rgba(24, 20, 15, 0.95)", // Deep obsidian with golden undertone
  nodeStroke: "rgba(180, 140, 80, 0.6)", // Golden border
  nodeStrokeHover: "rgba(200, 160, 100, 0.8)", // Brighter gold on hover
  nodeGlow: "rgba(180, 140, 80, 0.15)", // Subtle golden glow
  labelColor: "rgba(245, 235, 220, 0.95)", // Warm cream text
  linkColor: "rgba(180, 140, 80, 0.25)", // Golden links
}

// Initial contribution for genesis (0.001 ETH minimum)
const GENESIS_CONTRIBUTION = "0.001"

interface RadialMenuState {
  isOpen: boolean
  cabalId: string
  phase: number
  screenX: number
  screenY: number
}

export function GraphExplorer({
  onSelectCabal,
  onContribute,
}: {
  onSelectCabal?: (cabalId: bigint) => void
  onContribute?: (cabalId: bigint) => void
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
  
  const { isConnected } = useAccount()
  
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
  
  // Handle genesis success
  useEffect(() => {
    if (isGenesisSuccess) {
      toast.success("Genesis initialized! CABAL0 has been created.")
      refetchGenesis()
    }
  }, [isGenesisSuccess, refetchGenesis])
  
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
      const node: GraphNode = {
        id: cabal.id.toString(),
        label: cabal.id.toString(),
        phase: cabal.phase,
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
  }, [cabalsData])


  const handleNodeClick = useCallback(
    (node: GraphNode, event: MouseEvent) => {
      // Get container position to calculate relative screen coords
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return
      
      // Use the mouse event position relative to container
      const screenX = event.clientX - containerRect.left
      const screenY = event.clientY - containerRect.top
      
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
  }, [])
  
  const handleMenuAction = useCallback((action: "details" | "contribute") => {
    const cabalId = BigInt(radialMenu.cabalId)
    closeRadialMenu()
    
    if (action === "details" && onSelectCabal) {
      onSelectCabal(cabalId)
    } else if (action === "contribute" && onContribute) {
      onContribute(cabalId)
    }
  }, [radialMenu.cabalId, onSelectCabal, onContribute, closeRadialMenu])

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

  // Radial menu radius
  const MENU_RADIUS = 60
  const isPresale = radialMenu.phase === CabalPhase.Presale
  
  // Fill parent container completely
  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-muted/10 rounded-xl overflow-hidden border border-primary/10 relative"
      onClick={(e) => {
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
            {/* Container circle */}
            <circle
              cx={dimensions.width / 2}
              cy={dimensions.height / 2}
              r={Math.min(dimensions.width, dimensions.height) / 2 - 20}
              fill="none"
              stroke="rgba(180, 140, 80, 0.15)"
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
            nodeRelSize={10}
            linkColor={() => SACRED_COLORS.linkColor}
            linkWidth={1.5}
            linkDirectionalArrowLength={0} 
            onNodeClick={handleNodeClick}
            enableZoomInteraction={false}
            enablePanInteraction={false}
            enableNodeDrag={false}
            d3VelocityDecay={0.4}
            d3AlphaDecay={0.05}
          nodeCanvasObject={(node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = node.label
            const statusColor =
              PHASE_COLORS[node.phase as keyof typeof PHASE_COLORS] || "#6b7280"
            
            // Golden ratio sizing
            const radius = 32 / globalScale
            const fontSize = 14 / globalScale  // Larger since it's just a number
            const statusDotRadius = 5 / globalScale
            const x = node.x || 0
            const y = node.y || 0
            
            // Outer glow - golden sacred geometry
            const gradient = ctx.createRadialGradient(x, y, radius * 0.8, x, y, radius * 1.5)
            gradient.addColorStop(0, SACRED_COLORS.nodeGlow)
            gradient.addColorStop(1, "transparent")
            ctx.beginPath()
            ctx.arc(x, y, radius * 1.5, 0, 2 * Math.PI)
            ctx.fillStyle = gradient
            ctx.fill()
            
            // Main disk - dark with golden border
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, 2 * Math.PI)
            ctx.fillStyle = SACRED_COLORS.nodeFill
            ctx.fill()
            
            // Golden border with subtle glow
            ctx.strokeStyle = SACRED_COLORS.nodeStroke
            ctx.lineWidth = 2 / globalScale
            ctx.stroke()
            
            // Inner subtle golden ring (sacred geometry detail)
            ctx.beginPath()
            ctx.arc(x, y, radius * 0.85, 0, 2 * Math.PI)
            ctx.strokeStyle = "rgba(180, 140, 80, 0.15)"
            ctx.lineWidth = 1 / globalScale
            ctx.stroke()

            // Ticker label - warm cream color
            ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
            ctx.textAlign = "center"
            ctx.textBaseline = "middle"
            ctx.fillStyle = SACRED_COLORS.labelColor
            ctx.fillText(label, x, y)
            
            // Status indicator dot - top right of the disk
            const dotX = x + radius * 0.65
            const dotY = y - radius * 0.65
            
            // Status dot glow
            ctx.beginPath()
            ctx.arc(dotX, dotY, statusDotRadius * 1.5, 0, 2 * Math.PI)
            ctx.fillStyle = `${statusColor}40`
            ctx.fill()
            
            // Status dot
            ctx.beginPath()
            ctx.arc(dotX, dotY, statusDotRadius, 0, 2 * Math.PI)
            ctx.fillStyle = statusColor
            ctx.fill()
            ctx.strokeStyle = SACRED_COLORS.nodeFill
            ctx.lineWidth = 1 / globalScale
            ctx.stroke()
          }}
          backgroundColor="transparent"
          cooldownTicks={graphData.nodes.length === 1 ? 0 : 100}
          warmupTicks={0}
          onEngineStop={() => {
            if (graphRef.current) {
              // Always center on (0,0) where CABAL0 is pinned
              graphRef.current.centerAt(0, 0, 0)
              // Calculate zoom to fit circle
              const circleRadius = Math.min(dimensions.width, dimensions.height) / 2 - 20
              const graphRadius = 50 // approximate node spread
              const scale = circleRadius / Math.max(graphRadius, 100)
              graphRef.current.zoom(Math.min(scale, 1), 0)
            }
          }}
          />
        )}
        
        {/* Radial Menu */}
        {radialMenu.isOpen && (
          <div 
            className="absolute pointer-events-none"
            style={{
              left: radialMenu.screenX,
              top: radialMenu.screenY,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Menu items arranged radially */}
            {/* Details button - top */}
            <button
              onClick={() => handleMenuAction("details")}
              className="absolute pointer-events-auto w-12 h-12 rounded-full bg-background/90 border border-primary/30 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all shadow-lg backdrop-blur-sm"
              style={{
                left: '50%',
                top: -MENU_RADIUS,
                transform: 'translateX(-50%)',
              }}
              title="View Details"
            >
              <Info className="h-5 w-5 text-primary" />
            </button>
            
            {/* Contribute button - bottom (only for presale) */}
            {isPresale && (
              <button
                onClick={() => handleMenuAction("contribute")}
                className="absolute pointer-events-auto w-12 h-12 rounded-full bg-background/90 border border-primary/30 flex items-center justify-center hover:bg-primary/20 hover:border-primary/50 transition-all shadow-lg backdrop-blur-sm"
                style={{
                  left: '50%',
                  top: MENU_RADIUS,
                  transform: 'translateX(-50%)',
                }}
                title="Contribute"
              >
                <Coins className="h-5 w-5 text-primary" />
              </button>
            )}
            
            {/* Close button - center */}
            <button
              onClick={closeRadialMenu}
              className="absolute pointer-events-auto w-8 h-8 rounded-full bg-muted/80 border border-muted-foreground/20 flex items-center justify-center hover:bg-muted transition-all"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              title="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
    </div>
  )
}
