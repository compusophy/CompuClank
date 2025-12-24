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
import { Plus, Wallet, Loader2 } from 'lucide-react';
import { GOLDEN_RATIO_WIDTH } from '@/components/layout/PrimaryCTA';
import { UI_CONSTANTS } from '@/lib/utils';

interface CreateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (cabalId?: bigint) => void;
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

  const [createdCabalId, setCreatedCabalId] = useState<bigint | null>(null);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  // Automatically sync name with symbol (ticker) if not manually edited
  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Clean up ticker: remove $ prefix, spaces, and non-alphanumeric characters
    const cleanSymbol = value
      .replace(/^\$/, '') // Remove leading $
      .replace(/[^A-Z0-9]/g, '') // Only allow letters and numbers
      .slice(0, 20); // Max 20 characters for ticker
    
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
    
    // Pass the actual created ID if we found it
    onSuccess?.(createdCabalId || undefined);
    setCreatedCabalId(null);
  };

  // Extract ID from logs when receipt is available
  useEffect(() => {
    if (receipt && isSuccess) {
      // Look for the CabalCreated event topic
      // event CabalCreated(uint256 indexed cabalId, address indexed creator, string name, string symbol)
      // The first indexed argument (topic[1]) is the cabalId
      const cabalCreatedLog = receipt.logs.find(log => 
        // We could check address or topic[0] but since we just called createCabal, 
        // we can look for the log that has the right structure.
        // For simplicity, let's look for logs from our diamond address
        log.address.toLowerCase() === CABAL_DIAMOND_ADDRESS?.toLowerCase()
      );

      if (cabalCreatedLog && cabalCreatedLog.topics[1]) {
        try {
          const id = BigInt(cabalCreatedLog.topics[1]);
          setCreatedCabalId(id);
        } catch (e) {
          console.error('Failed to parse cabal ID from logs', e);
        }
      }
    }
  }, [receipt, isSuccess]);

  // Watch for transaction confirmation and ID extraction
  useEffect(() => {
    // Only trigger success once we have the ID (or if we failed to find it but transaction succeeded)
    if (isSuccess && hash) {
      // Small delay to ensure state update for ID has processed if it was found
      const timer = setTimeout(() => {
        handleSuccess();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash, createdCabalId]);

  const isLoading = isPending || isConfirming;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} blurBackground className="sm:max-w-md overflow-y-auto">
        <DialogTitle className="sr-only">Create CABAL</DialogTitle>
        <DialogDescription className="sr-only">
          Create a decentralized group wallet with its own governance token.
        </DialogDescription>

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
          <form onSubmit={handleSubmit} className={UI_CONSTANTS.spaceY}>
            {/* Primary Input: Ticker */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <Input
                placeholder="TICKER"
                value={formData.symbol}
                onChange={handleSymbolChange}
                required
                maxLength={20}
                className="pl-7 font-mono uppercase text-lg h-12"
              />
            </div>

            {/* Image URL Input (Optional) - Removed for now as metadata will be set later */}
            {/* <div className="pt-2">
              <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Image URL (Optional)</label>
              <Input
                placeholder="ipfs://... or https://..."
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="h-10 text-sm"
              />
            </div> */}

            <div className="flex justify-center pt-2">
              <Button
                type="submit"
                className={`${GOLDEN_RATIO_WIDTH} h-12 text-base font-semibold gap-2 shadow-lg`}
                disabled={isLoading || !formData.name || !formData.symbol}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Plus className="h-5 w-5" />
                {isPending ? 'Confirming...' : isConfirming ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
