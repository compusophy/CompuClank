'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { Plus, Wallet, Loader2 } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { parseEther } from 'viem';

const MIN_CREATION_FEE = '0.001'; // Must match contract MIN_CREATION_FEE

interface CreateModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (cabalId?: bigint) => void;
}

export function CreateModal({ isOpen, onOpenChange, onSuccess }: CreateModalProps) {
  const { isConnected } = useAccount();
  const [createdCabalId, setCreatedCabalId] = useState<bigint | null>(null);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const handleCreate = () => {
    if (!CABAL_DIAMOND_ADDRESS) {
      toast.error('Contract not deployed');
      return;
    }

    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'createCabal',
      args: [],
      value: parseEther(MIN_CREATION_FEE),
    }, {
      onSuccess: () => {
        toast.success('CABAL created! Waiting for confirmation...');
      },
      onError: (error: Error) => {
        haptics.error();
        if (error.message.includes('User rejected') || error.message.includes('rejected the request')) {
          toast.info('Transaction rejected');
          return;
        }
        
        const message = error.message.length > 100 
          ? `${error.message.substring(0, 100)}...` 
          : error.message;
          
        toast.error(message || 'Failed to create CABAL');
      },
    });
  };

  const handleSuccess = () => {
    haptics.sacredRhythm();
    toast.success('CABAL created successfully!');
    reset();
    onOpenChange(false);
    onSuccess?.(createdCabalId || undefined);
    setCreatedCabalId(null);
  };

  // Extract ID from logs when receipt is available
  useEffect(() => {
    if (receipt && isSuccess) {
      const cabalCreatedLog = receipt.logs.find(log => 
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

  // Watch for transaction confirmation
  useEffect(() => {
    if (isSuccess && hash) {
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
      <DialogContent showCloseButton={false} className="sm:max-w-xs dialog-glow-animated">
        <DialogTitle className="sr-only">Create CABAL</DialogTitle>
        <DialogDescription className="sr-only">
          Create a decentralized group wallet with its own governance token.
        </DialogDescription>

        {!isConnected ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Connect wallet to create</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <Button
              size="lg"
              className="h-12 w-full text-base font-semibold gap-2 button-shimmer-effect active-press"
              disabled={isLoading}
              onClick={handleCreate}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              {isPending ? 'CONFIRM...' : isConfirming ? 'CREATING...' : 'CREATE'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
