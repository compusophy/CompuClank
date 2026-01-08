"use client"

import { useState, useEffect } from "react"
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther } from "viem"
import { CABAL_ABI, CabalPhase } from "@/lib/abi/cabal"

// Minimal interface for cabals - compatible with GraphExplorer's local CabalInfo
interface CabalInfoMinimal {
  id: bigint
  symbol: string
  phase: number
}
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Send, TrendingUp, TrendingDown, Lock, Unlock, Vote, Users, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useTransactionGuard } from "@/lib/transaction-context"

export type GovernanceActionType = 
  | 'contribute'    // Contribute ETH to another cabal's presale
  | 'buy'           // Buy tokens from another cabal
  | 'sell'          // Sell tokens of another cabal
  | 'stake'         // Stake tokens in another cabal
  | 'unstake'       // Unstake tokens from another cabal
  | 'vote'          // Vote in another cabal's proposal
  | 'delegate'      // Delegate voting power in another cabal
  | 'dissolve'      // Dissolve a child cabal

interface GovernanceActionModalProps {
  isOpen: boolean
  onClose: () => void
  cabalId: bigint
  actionType: GovernanceActionType
  cabals: readonly CabalInfoMinimal[]
  childCabalIds?: readonly bigint[]
  onSuccess?: () => void
}

const ACTION_CONFIG: Record<GovernanceActionType, {
  title: string
  description: string
  icon: React.ReactNode
  targetFilter?: 'presale' | 'active' | 'child' | 'any'
  amountLabel?: string
  amountUnit?: string
  requiresTargetProposal?: boolean
  requiresDelegatee?: boolean
}> = {
  contribute: {
    title: "Contribute to Presale",
    description: "Propose to contribute ETH from treasury to another cabal's presale",
    icon: <Send className="h-5 w-5" />,
    targetFilter: 'presale',
    amountLabel: "ETH Amount",
    amountUnit: "ETH",
  },
  buy: {
    title: "Buy Tokens",
    description: "Propose to buy tokens from another cabal using treasury ETH",
    icon: <TrendingUp className="h-5 w-5" />,
    targetFilter: 'active',
    amountLabel: "ETH to Spend",
    amountUnit: "ETH",
  },
  sell: {
    title: "Sell Tokens",
    description: "Propose to sell tokens of another cabal for ETH",
    icon: <TrendingDown className="h-5 w-5" />,
    targetFilter: 'active',
    amountLabel: "Token Amount",
    amountUnit: "tokens",
  },
  stake: {
    title: "Stake in CABAL",
    description: "Propose to stake tokens in another cabal for voting power",
    icon: <Lock className="h-5 w-5" />,
    targetFilter: 'active',
    amountLabel: "Token Amount",
    amountUnit: "tokens",
  },
  unstake: {
    title: "Unstake from CABAL",
    description: "Propose to unstake tokens from another cabal",
    icon: <Unlock className="h-5 w-5" />,
    targetFilter: 'active',
    amountLabel: "Token Amount",
    amountUnit: "tokens",
  },
  vote: {
    title: "Vote in CABAL",
    description: "Propose to cast a vote in another cabal's governance",
    icon: <Vote className="h-5 w-5" />,
    targetFilter: 'active',
    requiresTargetProposal: true,
  },
  delegate: {
    title: "Delegate Power",
    description: "Propose to delegate voting power in another cabal",
    icon: <Users className="h-5 w-5" />,
    targetFilter: 'active',
    requiresDelegatee: true,
  },
  dissolve: {
    title: "Dissolve Child",
    description: "Propose to dissolve a child cabal and reclaim treasury",
    icon: <Trash2 className="h-5 w-5" />,
    targetFilter: 'child',
  },
}

export function GovernanceActionModal({
  isOpen,
  onClose,
  cabalId,
  actionType,
  cabals,
  childCabalIds = [],
  onSuccess,
}: GovernanceActionModalProps) {
  const config = ACTION_CONFIG[actionType]
  const txGuard = useTransactionGuard()
  
  // Form state
  const [targetCabalId, setTargetCabalId] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [targetProposalId, setTargetProposalId] = useState<string>("")
  const [voteSupport, setVoteSupport] = useState<boolean>(true)
  const [delegatee, setDelegatee] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  
  // Write contract
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash })
  
  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setTargetCabalId("")
      setAmount("")
      setTargetProposalId("")
      setVoteSupport(true)
      setDelegatee("")
      setDescription("")
    }
  }, [isOpen])
  
  // Track transaction hash for global status
  useEffect(() => {
    if (txHash) {
      txGuard.onHash(txHash)
    }
  }, [txHash, txGuard])
  
  // Handle success
  useEffect(() => {
    if (isSuccess && txHash) {
      txGuard.onComplete()
      toast.success("Proposal created!")
      onSuccess?.()
      onClose()
    }
  }, [isSuccess, txHash, onSuccess, onClose, txGuard])
  
  // Filter cabals based on action type
  const filteredCabals = cabals.filter(c => {
    const cId = c.id.toString()
    if (cId === cabalId.toString()) return false // Can't target self
    
    switch (config.targetFilter) {
      case 'presale':
        return c.phase === CabalPhase.Presale
      case 'active':
        return c.phase === CabalPhase.Active
      case 'child':
        return childCabalIds.some(id => id.toString() === cId)
      default:
        return true
    }
  })
  
  const handleSubmit = () => {
    if (!CABAL_DIAMOND_ADDRESS || !targetCabalId) return
    
    // Check if another transaction is pending
    if (!txGuard.canStart()) {
      toast.error("Please wait for the current transaction to complete")
      return
    }
    
    const autoDescription = description || `${config.title}: Target CABAL ${targetCabalId}`
    
    // Start the transaction guard
    txGuard.guardTransaction(config.title, () => {})
    
    const onError = (e: Error) => {
      txGuard.onComplete()
      toast.error(e.message?.split('\n')[0] || "Transaction failed")
    }
    
    // Use direct writeContract calls to maintain type safety
    switch (actionType) {
      case 'contribute':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeContributeToPresale',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount || "0"), autoDescription],
        }, { onError })
        break
      case 'buy':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeBuyTokens',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount || "0"), 0n, autoDescription],
        }, { onError })
        break
      case 'sell':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeSellTokens',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount || "0"), 0n, autoDescription],
        }, { onError })
        break
      case 'stake':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeStake',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount || "0"), autoDescription],
        }, { onError })
        break
      case 'unstake':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeUnstake',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount || "0"), autoDescription],
        }, { onError })
        break
      case 'vote':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeVote',
          args: [cabalId, BigInt(targetCabalId), BigInt(targetProposalId || "0"), voteSupport, autoDescription],
        }, { onError })
        break
      case 'delegate':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeDelegate',
          args: [cabalId, BigInt(targetCabalId), delegatee as `0x${string}`, autoDescription],
        }, { onError })
        break
      case 'dissolve':
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeDissolveChild',
          args: [cabalId, BigInt(targetCabalId), autoDescription],
        }, { onError })
        break
    }
  }
  
  const isLoading = isPending || isConfirming || txGuard.isPending
  const canSubmit = targetCabalId && !isLoading && txGuard.canStart() && (
    !config.amountLabel || amount
  ) && (
    !config.requiresTargetProposal || targetProposalId
  ) && (
    !config.requiresDelegatee || delegatee
  )
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Target Cabal Selection */}
          <div className="space-y-2">
            <Label>Target CABAL</Label>
            <Select value={targetCabalId} onValueChange={setTargetCabalId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a CABAL..." />
              </SelectTrigger>
              <SelectContent>
                {filteredCabals.length === 0 ? (
                  <SelectItem value="" disabled>
                    No eligible CABALs found
                  </SelectItem>
                ) : (
                  filteredCabals.map(c => (
                    <SelectItem key={c.id.toString()} value={c.id.toString()}>
                      {c.symbol} (ID: {c.id.toString()})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          
          {/* Amount Input */}
          {config.amountLabel && (
            <div className="space-y-2">
              <Label>{config.amountLabel}</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.00001"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  className="font-mono"
                  disabled={isLoading}
                />
                <span className="flex items-center text-sm text-muted-foreground px-2">
                  {config.amountUnit}
                </span>
              </div>
            </div>
          )}
          
          {/* Target Proposal (for vote action) */}
          {config.requiresTargetProposal && (
            <>
              <div className="space-y-2">
                <Label>Target Proposal ID</Label>
                <Input
                  type="number"
                  min="0"
                  value={targetProposalId}
                  onChange={(e) => setTargetProposalId(e.target.value)}
                  placeholder="0"
                  className="font-mono"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label>Vote Direction</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={voteSupport ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVoteSupport(true)}
                    disabled={isLoading}
                  >
                    For
                  </Button>
                  <Button
                    type="button"
                    variant={!voteSupport ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVoteSupport(false)}
                    disabled={isLoading}
                  >
                    Against
                  </Button>
                </div>
              </div>
            </>
          )}
          
          {/* Delegatee Address (for delegate action) */}
          {config.requiresDelegatee && (
            <div className="space-y-2">
              <Label>Delegatee Address</Label>
              <Input
                type="text"
                value={delegatee}
                onChange={(e) => setDelegatee(e.target.value)}
                placeholder="0x..."
                className="font-mono text-xs"
                disabled={isLoading}
              />
            </div>
          )}
          
          {/* Description (optional) */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why should this proposal pass?"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {isPending ? "Confirming..." : "Creating..."}
              </>
            ) : (
              "Create Proposal"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
