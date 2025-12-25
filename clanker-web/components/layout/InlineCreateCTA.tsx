'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { Plus, Loader2, Wallet } from 'lucide-react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { haptics } from '@/lib/haptics';

interface InlineCreateCTAProps {
  onSuccess?: (cabalId?: bigint) => void;
}

export function InlineCreateCTA({ onSuccess }: InlineCreateCTAProps) {
  const { isConnected } = useAccount();
  const [symbol, setSymbol] = useState('');
  const [createdCabalId, setCreatedCabalId] = useState<bigint | null>(null);

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    const cleanSymbol = value
      .replace(/^\$/, '')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 20);
    setSymbol(cleanSymbol);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!CABAL_DIAMOND_ADDRESS) {
      toast.error('Contract not deployed');
      return;
    }

    if (!symbol) {
      toast.error('Enter a ticker symbol');
      return;
    }

    const settings = {
      votingPeriod: BigInt(50400),
      quorumBps: BigInt(1000), // 10%
      majorityBps: BigInt(5100), // 51%
      proposalThreshold: BigInt(0),
    };

    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'createCabal',
      args: [symbol, symbol, '', settings],
    }, {
      onSuccess: () => {
        toast.success('CABAL created! Waiting for confirmation...');
      },
      onError: (error) => {
        haptics.error(); // Error haptic
        toast.error(error.message || 'Failed to create CABAL');
      },
    });
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

  // Handle success
  useEffect(() => {
    if (isSuccess && hash) {
      const timer = setTimeout(() => {
        haptics.sacredRhythm(); // Sacred geometry success celebration
        toast.success('CABAL created successfully!');
        reset();
        setSymbol('');
        onSuccess?.(createdCabalId || undefined);
        setCreatedCabalId(null);
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash, createdCabalId]);

  const isLoading = isPending || isConfirming;

  return (
    <div className="fixed bottom-[70px] left-0 right-0 z-40">
      <div className="page-container flex justify-center">
        <div className="bg-background border rounded-2xl shadow-xl p-4 w-full max-w-sm dialog-glow-animated">
          {!isConnected ? (
            // Show connect wallet prompt
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="h-4 w-4" />
                <span className="text-sm">Connect wallet to create</span>
              </div>
              <WalletButton />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Ticker Input */}
              <label className="flex items-center justify-center h-14 rounded-md border border-input bg-background input-sacred cursor-text w-full">
                <div className="relative inline-flex items-center justify-center min-w-[min-content]">
                  {/* Ghost element to force width */}
                  <span className="opacity-0 pointer-events-none font-mono text-lg font-bold uppercase whitespace-pre border border-transparent" aria-hidden="true">
                    ${symbol || "CABAL"}
                  </span>
                  
                  {/* Visible input group */}
                  <div className="absolute inset-0 flex items-center justify-center w-full">
                  <span className={`font-mono font-bold text-lg select-none ${symbol ? "" : "text-muted-foreground"}`}>$</span>
                  <input
                    placeholder="CABAL"
                    value={symbol}
                    onChange={handleSymbolChange}
                    maxLength={20}
                    className="w-full min-w-0 font-mono font-bold uppercase text-lg text-left bg-transparent border-none outline-none placeholder:text-muted-foreground focus:ring-0 p-0"
                    disabled={isLoading}
                  />
                  </div>
                </div>
              </label>

              {/* Create Button */}
              <Button
                type="submit"
                size="lg"
                haptic="golden"
                className="h-12 w-full text-base font-semibold gap-2 button-shimmer-effect active-press"
                disabled={isLoading || !symbol}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-5 w-5" />
                )}
                {isPending ? 'CONFIRM...' : isConfirming ? 'CREATING...' : 'CREATE'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
