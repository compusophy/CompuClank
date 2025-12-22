'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { Settings2, ChevronDown, ChevronUp, Plus, Wallet, Loader2 } from 'lucide-react';

interface CreateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateModal({ isOpen, onOpenChange, onSuccess }: CreateModalProps) {
  const { isConnected } = useAccount();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    image: '',
    votingPeriod: '50400',
    quorumPercent: '10',
    majorityPercent: '51',
    proposalThreshold: '0',
  });

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Automatically sync name with symbol (ticker) if not manually edited
  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Clean up ticker: remove leading $ if present
    const cleanSymbol = value.startsWith('$') ? value.slice(1) : value;
    
    setFormData(prev => ({
      ...prev,
      symbol: cleanSymbol,
      // If name matches symbol (or is empty), keep them synced
      name: (prev.name === prev.symbol || prev.name === '') ? cleanSymbol : prev.name
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!CABAL_DIAMOND_ADDRESS) {
      toast.error('Contract not deployed');
      return;
    }

    const settings = {
      votingPeriod: BigInt(formData.votingPeriod),
      quorumBps: BigInt(Number(formData.quorumPercent) * 100),
      majorityBps: BigInt(Number(formData.majorityPercent) * 100),
      proposalThreshold: BigInt(formData.proposalThreshold),
    };

    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'createCabal',
      args: [formData.name, formData.symbol, formData.image, settings],
    }, {
      onSuccess: () => {
        toast.success('CABAL created! Waiting for confirmation...');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create CABAL');
      },
    });
  };

  // Handle success via callback in writeContract
  const handleSuccess = () => {
    toast.success('CABAL created successfully!');
    reset();
    onOpenChange(false);
    onSuccess?.();
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        symbol: '',
        image: '',
        votingPeriod: '50400',
        quorumPercent: '10',
        majorityPercent: '51',
        proposalThreshold: '0',
      });
      setShowAdvanced(false);
    }
  }, [isOpen]);

  // Watch for transaction confirmation
  useEffect(() => {
    if (isSuccess && hash) {
      handleSuccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash]);

  const isLoading = isPending || isConfirming;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Create CABAL</DialogTitle>
          <DialogDescription>
            Create a decentralized group wallet with its own governance token.
          </DialogDescription>
        </DialogHeader>

        {!isConnected ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium mb-1">Connect Wallet</p>
              <p className="text-sm text-muted-foreground">
                Connect your wallet to create a CABAL.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Primary Input: Ticker */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <Input
                placeholder="TICKER"
                value={formData.symbol}
                onChange={handleSymbolChange}
                required
                maxLength={10}
                className="pl-7 font-mono uppercase text-lg h-12"
              />
            </div>

            {/* Advanced Settings Toggle */}
            <div className="border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex justify-between items-center text-muted-foreground hover:text-foreground h-auto py-2"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Settings2 className="h-4 w-4" />
                  Advanced Settings
                </span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>

              {/* Advanced Content */}
              {showAdvanced && (
                <div className="space-y-4 pt-3 animate-in slide-in-from-top-2 fade-in duration-200">
                  {/* Name & Image */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Token Name</label>
                      <Input
                        placeholder="My CABAL"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Image URL (Optional)</label>
                      <Input
                        placeholder="ipfs://... or https://..."
                        value={formData.image}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Governance */}
                  <div>
                    <h3 className="font-semibold mb-3 text-sm">Governance</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Quorum %</label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.quorumPercent}
                          onChange={(e) => setFormData({ ...formData, quorumPercent: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Majority %</label>
                        <Input
                          type="number"
                          min="50"
                          max="100"
                          value={formData.majorityPercent}
                          onChange={(e) => setFormData({ ...formData, majorityPercent: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Voting Period</label>
                        <Input
                          type="number"
                          min="100"
                          value={formData.votingPeriod}
                          onChange={(e) => setFormData({ ...formData, votingPeriod: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Prop. Threshold</label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.proposalThreshold}
                          onChange={(e) => setFormData({ ...formData, proposalThreshold: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold gap-2"
              disabled={isLoading || !formData.name || !formData.symbol}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <Plus className="h-5 w-5" />
              {isPending ? 'Confirming...' : isConfirming ? 'Creating...' : 'Create CABAL'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
