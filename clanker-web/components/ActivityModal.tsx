"use client"

import { useReadContract } from "wagmi"
import { formatEther } from "viem"
import { Activity, Zap, Users, Rocket, Coins, Vote, ArrowUpDown, Gift } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { CABAL_ABI, ActivityType } from "@/lib/abi/cabal"
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"

interface ActivityItem {
  cabalId: bigint
  actor: `0x${string}`
  activityType: number
  amount: bigint
  timestamp: bigint
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getActivityLabel(type: ActivityType): string {
  switch (type) {
    case ActivityType.CabalCreated:
      return "created cabal"
    case ActivityType.Contributed:
      return "contributed"
    case ActivityType.VotedLaunch:
      return "voted to launch"
    case ActivityType.Launched:
      return "launched"
    case ActivityType.Claimed:
      return "claimed tokens"
    case ActivityType.Staked:
      return "staked"
    case ActivityType.Unstaked:
      return "unstaked"
    case ActivityType.Bought:
      return "bought"
    case ActivityType.Sold:
      return "sold"
    case ActivityType.ProposalCreated:
      return "created proposal"
    case ActivityType.ProposalVoted:
      return "voted on proposal"
    case ActivityType.ProposalExecuted:
      return "executed proposal"
    case ActivityType.Delegated:
      return "delegated"
    case ActivityType.Undelegated:
      return "undelegated"
    case ActivityType.FeeClaimed:
      return "claimed fees"
    default:
      return "activity"
  }
}

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case ActivityType.CabalCreated:
      return <Users className="h-4 w-4" />
    case ActivityType.Contributed:
      return <Coins className="h-4 w-4" />
    case ActivityType.VotedLaunch:
    case ActivityType.ProposalVoted:
      return <Vote className="h-4 w-4" />
    case ActivityType.Launched:
      return <Rocket className="h-4 w-4" />
    case ActivityType.Claimed:
    case ActivityType.FeeClaimed:
      return <Gift className="h-4 w-4" />
    case ActivityType.Staked:
    case ActivityType.Unstaked:
      return <Zap className="h-4 w-4" />
    case ActivityType.Bought:
    case ActivityType.Sold:
      return <ArrowUpDown className="h-4 w-4" />
    case ActivityType.ProposalCreated:
    case ActivityType.ProposalExecuted:
      return <Vote className="h-4 w-4" />
    case ActivityType.Delegated:
    case ActivityType.Undelegated:
      return <Users className="h-4 w-4" />
    default:
      return <Activity className="h-4 w-4" />
  }
}

function formatTimeAgo(timestamp: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const diff = now - timestamp
  
  if (diff < 60n) return "just now"
  if (diff < 3600n) return `${diff / 60n}m ago`
  if (diff < 86400n) return `${diff / 3600n}h ago`
  return `${diff / 86400n}d ago`
}

function formatAmount(type: ActivityType, amount: bigint): string {
  if (type === ActivityType.ProposalCreated || type === ActivityType.ProposalExecuted) {
    return `#${amount.toString()}`
  }
  
  const formatted = formatEther(amount)
  const num = parseFloat(formatted)
  
  if (num === 0) return ""
  if (num < 0.001) return "<0.001 ETH"
  return `${num.toFixed(3)} ETH`
}

interface ActivityModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivityModal({ isOpen, onOpenChange }: ActivityModalProps) {
  const { data, isLoading } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getRecentActivities",
    query: { enabled: isOpen },
  })

  const activities = data?.[0] as ActivityItem[] | undefined
  const count = data?.[1] as bigint | undefined
  const validActivities = activities && count ? activities.slice(0, Number(count)) : []

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Activity
        </DialogTitle>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : validActivities.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No activity yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Activity will appear here as people interact with cabals
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {validActivities.map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {getActivityIcon(activity.activityType as ActivityType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-mono text-muted-foreground">
                        {truncateAddress(activity.actor)}
                      </span>
                      {" "}
                      <span>{getActivityLabel(activity.activityType as ActivityType)}</span>
                      {" "}
                      <span className="font-semibold font-mono">
                        $CABAL{activity.cabalId.toString()}
                      </span>
                    </p>
                    {activity.amount > 0n && (
                      <p className="text-xs text-muted-foreground">
                        {formatAmount(activity.activityType as ActivityType, activity.amount)}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
