'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignTypedData, useChainId } from 'wagmi';
import { formatEther, parseEther, erc20Abi, hexToSignature } from 'viem';
import { readContract } from '@wagmi/core';
import { config as wagmiConfig } from '@/lib/wagmi-config';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TokenAmount } from '@/components/TokenAmount';
import { CABAL_ABI, CabalInfo } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { Loader2, TrendingUp } from 'lucide-react';
import { haptics } from '@/lib/haptics';

interface StakeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cabalId: bigint;
  cabal: CabalInfo;
  onSuccess: () => void;
}

export function StakeModal({ isOpen, onOpenChange, cabalId, cabal, onSuccess }: StakeModalProps) {
  const [amount, setAmount] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();

  // Token Balance
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: cabal.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Staked Balance
  const { data: stakedBalance, refetch: refetchStaked } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getStakedBalance',
    args: address ? [cabalId, address] : undefined,
  });

  // Stake write contract
  const { writeContract: stakeWrite, data: stakeHash, isPending: isStaking } = useWriteContract();
  const { isSuccess: stakeSuccess, isLoading: stakeConfirming } = useWaitForTransactionReceipt({ hash: stakeHash });

  // Handle stake success
  useEffect(() => {
    if (stakeSuccess && stakeHash) {
      haptics.success(); // Success haptic
      toast.success('Staked!', {
        action: {
          label: 'View',
          onClick: () => window.open(`https://basescan.org/tx/${stakeHash}`, '_blank'),
        },
        duration: 5000,
      });
      refetchStaked();
      refetchTokenBalance();
      onSuccess();
      setAmount('');
      onOpenChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakeSuccess, stakeHash]);

  const handleStake = async () => {
    if (!CABAL_DIAMOND_ADDRESS || !amount || !address) return;
    const stakeAmount = parseEther(amount);
    setIsSigning(true);
    
    try {
      const nonce = await readContract(wagmiConfig, {
        address: cabal.tokenAddress,
        abi: [...erc20Abi, { 
          inputs: [{ name: 'owner', type: 'address' }], 
          name: 'nonces', 
          outputs: [{ name: '', type: 'uint256' }], 
          stateMutability: 'view', 
          type: 'function' 
        }] as const,
        functionName: 'nonces', 
        args: [address],
      });
      
      const tokenName = await readContract(wagmiConfig, { 
        address: cabal.tokenAddress, 
        abi: erc20Abi, 
        functionName: 'name' 
      });
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      
      const signature = await signTypedDataAsync({
        domain: { 
          name: tokenName, 
          version: '1', 
          chainId, 
          verifyingContract: cabal.tokenAddress 
        },
        types: { 
          Permit: [
            { name: 'owner', type: 'address' }, 
            { name: 'spender', type: 'address' }, 
            { name: 'value', type: 'uint256' }, 
            { name: 'nonce', type: 'uint256' }, 
            { name: 'deadline', type: 'uint256' }
          ] 
        },
        primaryType: 'Permit',
        message: { 
          owner: address, 
          spender: CABAL_DIAMOND_ADDRESS, 
          value: stakeAmount, 
          nonce: nonce as bigint, 
          deadline 
        },
      });
      
      const { v, r, s } = hexToSignature(signature);
      
      stakeWrite({ 
        address: CABAL_DIAMOND_ADDRESS, 
        abi: CABAL_ABI, 
        functionName: 'stakeWithPermit', 
        args: [cabalId, stakeAmount, deadline, Number(v), r, s] 
      }, {
        onError: (e) => {
          haptics.error(); // Error haptic
          toast.error(e.message);
          setIsSigning(false);
        },
        onSuccess: () => { 
          setIsSigning(false); 
        }
      });
    } catch (e) {
      haptics.error(); // Error haptic
      toast.error(e instanceof Error ? e.message : 'Failed to sign');
      setIsSigning(false);
    }
  };

  const handleMax = () => {
    if (tokenBalance) {
      setAmount(formatEther(tokenBalance as bigint));
    }
  };

  const isLoading = isStaking || stakeConfirming || isSigning;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Stake ${cabal.symbol}
          </DialogTitle>
          <DialogDescription>
            Stake your tokens to gain voting power in governance.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Currently Staked */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Currently Staked</span>
              <span className="font-mono font-medium">
                <TokenAmount amount={stakedBalance as bigint} symbol={cabal.symbol} />
              </span>
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Amount to Stake</Label>
              <button 
                onClick={handleMax}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Balance: {tokenBalance ? Number(formatEther(tokenBalance as bigint)).toFixed(4) : '0'} {cabal.symbol}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
              <Button variant="outline" onClick={handleMax}>
                Max
              </Button>
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground">
            Staking gives you voting power in governance proposals. You can unstake at any time.
          </p>
        </div>

        <Button 
          onClick={handleStake} 
          disabled={isLoading || !amount || Number(amount) <= 0}
          className="w-full h-12 text-base"
          size="lg"
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSigning ? 'Sign Permit...' : isStaking ? 'Confirming...' : stakeConfirming ? 'Processing...' : 'Stake'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
