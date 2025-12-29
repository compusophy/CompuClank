'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { Loader2, Wallet, Coins } from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { haptics } from '@/lib/haptics';
import { parseEther } from 'viem';

const MIN_CONTRIBUTION = '0.001'; // Must match contract MIN_CONTRIBUTION

interface ContributeCTAProps {
  cabalId: bigint;
  onSuccess?: () => void;
}

export function ContributeCTA({ cabalId, onSuccess }: ContributeCTAProps) {
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState(MIN_CONTRIBUTION);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const { refetch: refetchContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getContribution',
    args: address ? [cabalId, address] : undefined,
    query: { enabled: !!address },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!CABAL_DIAMOND_ADDRESS) {
      toast.error('Contract not deployed');
      return;
    }

    if (!amount || parseFloat(amount) < parseFloat(MIN_CONTRIBUTION)) {
      toast.error(`Minimum contribution is ${MIN_CONTRIBUTION} ETH`);
      return;
    }

    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'contribute',
      args: [cabalId],
      value: parseEther(amount),
    }, {
      onError: (error) => {
        haptics.error();
        toast.error(error.message || 'Failed to contribute');
      },
    });
  };

  // Handle success
  useEffect(() => {
    if (isSuccess && hash) {
      const handleSuccess = async () => {
        haptics.sacredRhythm();
        toast.success(`Contributed ${amount} ETH successfully!`);
        
        // Wait for refetch to complete
        await refetchContribution();
        
        // Notify parent to refetch other data
        onSuccess?.();
        
        // Reset local state
        reset();
        setAmount(MIN_CONTRIBUTION);
      };

      handleSuccess();
    }
  }, [isSuccess, hash, amount, onSuccess, reset, refetchContribution]);

  const isLoading = isPending || isConfirming;

  return (
    <div className="fixed bottom-[70px] left-0 right-0 z-40">
      <div className="page-container flex justify-center">
        <div className="bg-background border rounded-2xl shadow-xl p-4 w-full max-w-sm dialog-glow-animated">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">Connect wallet to contribute</span>
              </div>
              <WalletButton />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Amount Input */}
              <label className="flex items-center justify-center h-14 rounded-md border border-input bg-background input-sacred cursor-text w-full overflow-hidden px-4">
                <div className="relative inline-flex items-center justify-center min-w-[min-content]">
                  {/* Ghost element to force width */}
                  <span className="opacity-0 pointer-events-none font-mono text-lg font-bold px-1 whitespace-pre border border-transparent" aria-hidden="true">
                    {amount || "0.0"} ETH
                  </span>
                  
                  {/* Visible input group */}
                  <div className="absolute inset-0 flex items-center justify-center w-full px-1">
                    <input
                      type="number"
                      step="0.001"
                      min={MIN_CONTRIBUTION}
                      placeholder="0.0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="font-mono text-lg bg-transparent border-none outline-none placeholder:text-muted-foreground focus:ring-0 p-0 text-right min-w-[1ch] no-spinner"
                      disabled={isLoading}
                    />
                    <span className="font-mono text-lg select-none ml-1.5">ETH</span>
                  </div>
                </div>
              </label>

              {/* Contribute Button */}
              <Button
                type="submit"
                size="lg"
                haptic="golden"
                className="h-12 w-full text-base font-semibold gap-2 button-shimmer-effect active-press"
                disabled={isLoading || !amount}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Coins className="h-5 w-5" />
                )}
                {isPending ? 'CONFIRM...' : isConfirming ? 'CONTRIBUTING...' : 'CONTRIBUTE'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
