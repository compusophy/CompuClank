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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useTransactionGuard } from "@/lib/transaction-context"

export type GovernanceActionType = 
  | 'contribute'    // Contribute ETH to another cabal's presale
  | 'buy'           // Buy tokens from another cabal
  | 'sell'          // Sell tokens of another cabal
  | 'trade'         // Buy or sell tokens (combined UI)
  | 'stake'         // Stake tokens in another cabal
  | 'unstake'       // Unstake tokens from another cabal
  | 'vote'          // Vote in another cabal's proposal
  | 'delegate'      // Delegate voting power in another cabal
  | 'dissolve'      // Dissolve a child cabal
  | 'create'        // Create a new child cabal

interface GovernanceActionModalProps {
  isOpen: boolean
  onClose: () => void
  cabalId: bigint
  actionType: GovernanceActionType // Initial action type (ignored, we use internal state)
  cabals: readonly CabalInfoMinimal[]
  childCabalIds?: readonly bigint[]
  stakedBalance?: bigint
  totalStaked?: bigint
  onSuccess?: () => void
}

// Available proposal types for the selector
const PROPOSAL_TYPES = [
  { value: 'create', label: 'Create Child CABAL', targetFilter: null },
  { value: 'contribute', label: 'Contribute to Presale', targetFilter: 'presale' as const },
  { value: 'trade', label: 'Trade Tokens', targetFilter: 'active' as const },
  { value: 'stake', label: 'Stake in CABAL', targetFilter: 'active' as const },
  { value: 'delegate', label: 'Delegate Power', targetFilter: 'active' as const },
] as const

export function GovernanceActionModal({
  isOpen,
  onClose,
  cabalId,
  cabals,
  childCabalIds = [],
  stakedBalance = 0n,
  totalStaked = 0n,
  onSuccess,
}: GovernanceActionModalProps) {
  const txGuard = useTransactionGuard()
  
  // Calculate voting power percentage
  const votingPower = totalStaked > 0n 
    ? Number((stakedBalance * 10000n) / totalStaked) / 100 
    : 0
  
  // Form state
  const [selectedType, setSelectedType] = useState<string>('create')
  const [targetCabalId, setTargetCabalId] = useState<string>("")
  const [amount, setAmount] = useState<string>("")
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy')
  const [delegatee, setDelegatee] = useState<string>("")
  
  // Write contract
  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash })
  
  // Get current proposal type config
  const currentType = PROPOSAL_TYPES.find(t => t.value === selectedType) ?? PROPOSAL_TYPES[0]
  
  // Filter cabals based on selected type
  const filteredCabals = cabals.filter(c => {
    const cId = c.id.toString()
    if (cId === cabalId.toString()) return false // Can't target self
    
    switch (currentType.targetFilter) {
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
  
  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setSelectedType('create')
      setTargetCabalId("")
      setAmount("")
      setTradeMode('buy')
      setDelegatee("")
    }
  }, [isOpen])
  
  // Track transaction hash for global status
  useEffect(() => {
    if (txHash) {
      txGuard.onHash(txHash)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash])
  
  // Handle success
  useEffect(() => {
    if (isSuccess && txHash) {
      txGuard.onComplete()
      toast.success("Proposal created!")
      onSuccess?.()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, txHash])
  
  const handleSubmit = () => {
    if (!CABAL_DIAMOND_ADDRESS) return
    
    // Check if another transaction is pending
    if (!txGuard.canStart()) {
      toast.error("Please wait for the current transaction to complete")
      return
    }
    
    // Start the transaction guard
    txGuard.guardTransaction("Create Proposal", () => {})
    
    const onError = (e: Error) => {
      txGuard.onComplete()
      toast.error(e.message?.split('\n')[0] || "Transaction failed")
    }
    
    const description = `${currentType.label}`
    
    switch (selectedType) {
      case 'create':
        // Use minimum amount (0.00001 ETH) - no user input needed
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeCreateChildCabal',
          args: [cabalId, parseEther("0.00001"), description],
        }, { onError })
        break
      case 'contribute':
        if (!targetCabalId || !amount) return
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeContributeToPresale',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount), description],
        }, { onError })
        break
      case 'trade':
        if (!targetCabalId || !amount) return
        if (tradeMode === 'buy') {
          writeContract({
            address: CABAL_DIAMOND_ADDRESS,
            abi: CABAL_ABI,
            functionName: 'proposeBuyTokens',
            args: [cabalId, BigInt(targetCabalId), parseEther(amount), 0n, description],
          }, { onError })
        } else {
          writeContract({
            address: CABAL_DIAMOND_ADDRESS,
            abi: CABAL_ABI,
            functionName: 'proposeSellTokens',
            args: [cabalId, BigInt(targetCabalId), parseEther(amount), 0n, description],
          }, { onError })
        }
        break
      case 'stake':
        if (!targetCabalId || !amount) return
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeStake',
          args: [cabalId, BigInt(targetCabalId), parseEther(amount), description],
        }, { onError })
        break
      case 'delegate':
        if (!targetCabalId || !delegatee) return
        writeContract({
          address: CABAL_DIAMOND_ADDRESS,
          abi: CABAL_ABI,
          functionName: 'proposeDelegate',
          args: [cabalId, BigInt(targetCabalId), delegatee as `0x${string}`, description],
        }, { onError })
        break
    }
  }
  
  const isLoading = isPending || isConfirming || txGuard.isPending
  
  // Check if can submit based on selected type
  const canSubmit = (() => {
    if (isLoading || !txGuard.canStart()) return false
    
    switch (selectedType) {
      case 'create':
        return true // No inputs needed
      case 'contribute':
      case 'trade':
      case 'stake':
        return !!targetCabalId && !!amount
      case 'delegate':
        return !!targetCabalId && !!delegatee
      default:
        return false
    }
  })()
  
  // Check if this type needs a target cabal
  const needsTarget = selectedType !== 'create'
  
  // Check if this type needs an amount
  const needsAmount = selectedType === 'contribute' || selectedType === 'trade' || selectedType === 'stake'
  
  // Check if this type needs delegatee
  const needsDelegatee = selectedType === 'delegate'
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Proposal</DialogTitle>
        </DialogHeader>
        
        {/* Voting Power Display */}
        <div className="flex justify-between items-center py-2 px-3 bg-muted/50 rounded-lg border border-primary/20">
          <span className="text-sm text-muted-foreground">Your Voting Power</span>
          <span className={`text-sm font-medium ${votingPower > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            {votingPower.toFixed(2)}%
          </span>
        </div>
        
        <div className="space-y-4 py-2">
          {/* Proposal Type Selector */}
          <div className="space-y-2">
            <Label>Proposal Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPOSAL_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Target Cabal Selection */}
          {needsTarget && (
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
          )}
          
          {/* Trade Mode Toggle */}
          {selectedType === 'trade' && (
            <div className="space-y-2">
              <Label>Trade Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={tradeMode === 'buy' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTradeMode('buy')}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Buy
                </Button>
                <Button
                  type="button"
                  variant={tradeMode === 'sell' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTradeMode('sell')}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Sell
                </Button>
              </div>
            </div>
          )}
          
          {/* Amount Input */}
          {needsAmount && (
            <div className="space-y-2">
              <Label>
                {selectedType === 'trade' 
                  ? (tradeMode === 'buy' ? 'ETH to Spend' : 'Token Amount')
                  : selectedType === 'contribute' 
                    ? 'ETH Amount' 
                    : 'Token Amount'}
              </Label>
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
                  {selectedType === 'trade' 
                    ? (tradeMode === 'buy' ? 'ETH' : 'tokens')
                    : selectedType === 'contribute' 
                      ? 'ETH' 
                      : 'tokens'}
                </span>
              </div>
            </div>
          )}
          
          {/* Delegatee Address */}
          {needsDelegatee && (
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
