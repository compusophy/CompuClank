'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignTypedData, useChainId } from 'wagmi';
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
import { ArrowDownUp, Loader2 } from 'lucide-react';

type TradeTab = 'buy' | 'sell' | 'stake';

interface TradeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cabalId: bigint;
  cabal: CabalInfo;
  onSuccess: () => void;
  initialTab?: TradeTab;
}

function showTransactionToast(hash: string, message: string) {
  toast.success(message, {
    action: {
      label: 'View',
      onClick: () => window.open(`https://basescan.org/tx/${hash}`, '_blank'),
    },
    duration: 5000,
  });
}

// Tab button component
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'bg-foreground text-background shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      {children}
    </button>
  );
}

export function TradeModal({ isOpen, onOpenChange, cabalId, cabal, onSuccess, initialTab = 'buy' }: TradeModalProps) {
  const [activeTab, setActiveTab] = useState<TradeTab>(initialTab);
  const [amount, setAmount] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();

  // Reset amount when tab changes
  useEffect(() => {
    setAmount('');
  }, [activeTab]);

  // Update initial tab when prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // ETH Balance
  const { data: ethBalance } = useBalance({
    address,
  });

  // Token Balance
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: cabal.tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Token Allowance for Diamond (for selling)
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({
    address: cabal.tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && CABAL_DIAMOND_ADDRESS ? [address, CABAL_DIAMOND_ADDRESS] : undefined,
  });

  // Staked Balance
  const { data: stakedBalance, refetch: refetchStaked } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getStakedBalance',
    args: address ? [cabalId, address] : undefined,
  });

  // Buy tokens contract call
  const { writeContract: buyWrite, data: buyHash, isPending: isBuying, reset: resetBuy } = useWriteContract();
  const { isSuccess: buySuccess, isLoading: buyConfirming } = useWaitForTransactionReceipt({ hash: buyHash });

  // Sell tokens contract call
  const { writeContract: sellWrite, data: sellHash, isPending: isSelling, reset: resetSell } = useWriteContract();
  const { isSuccess: sellSuccess, isLoading: sellConfirming } = useWaitForTransactionReceipt({ hash: sellHash });

  // Approve tokens contract call
  const { writeContract: approveWrite, data: approveHash, isPending: approving } = useWriteContract();
  const { isSuccess: approveSuccess, isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveHash });

  // Stake write contract
  const { writeContract: stakeWrite, data: stakeHash, isPending: isStaking } = useWriteContract();
  const { isSuccess: stakeSuccess, isLoading: stakeConfirming } = useWaitForTransactionReceipt({ hash: stakeHash });

  // Handle buy success
  useEffect(() => {
    if (buySuccess && buyHash) {
      showTransactionToast(buyHash, 'Bought tokens!');
      refetchTokenBalance();
      onSuccess();
      setAmount('');
      resetBuy();
    }
  }, [buySuccess, buyHash]);

  // Handle sell success
  useEffect(() => {
    if (sellSuccess && sellHash) {
      showTransactionToast(sellHash, 'Sold tokens!');
      refetchTokenBalance();
      onSuccess();
      setAmount('');
      resetSell();
    }
  }, [sellSuccess, sellHash]);

  // Handle approve success - continue with sell
  useEffect(() => {
    if (approveSuccess && approveHash) {
      toast.success('Approved! Now selling...');
      refetchAllowance();
      setIsApproving(false);
      // Execute the sell after approval
      executeSell();
    }
  }, [approveSuccess, approveHash]);

  // Handle stake success
  useEffect(() => {
    if (stakeSuccess && stakeHash) {
      showTransactionToast(stakeHash, 'Staked!');
      refetchStaked();
      refetchTokenBalance();
      onSuccess();
      setAmount('');
    }
  }, [stakeSuccess, stakeHash]);

  const executeSell = () => {
    if (!CABAL_DIAMOND_ADDRESS || !amount || !address) return;
    
    const tokenAmount = parseEther(amount);
    const minEthOut = 0n; // TODO: Add slippage calculation
    
    sellWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'sellTokens',
      args: [cabalId, tokenAmount, minEthOut],
    }, {
      onError: (e) => {
        console.error('Sell error:', e);
        toast.error(e.message.includes('execution reverted') 
          ? 'Sell failed - try a smaller amount' 
          : e.message
        );
      },
    });
  };

  const handleBuy = async () => {
    if (!CABAL_DIAMOND_ADDRESS || !address || !amount) return;
    
    const ethAmount = parseEther(amount);
    const minAmountOut = 0n; // TODO: Add slippage calculation
    
    buyWrite({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'buyTokens',
      args: [cabalId, minAmountOut],
      value: ethAmount,
    }, {
      onError: (e) => {
        console.error('Buy error:', e);
        toast.error(e.message.includes('execution reverted') 
          ? 'Buy failed - try a smaller amount or check slippage' 
          : e.message
        );
      },
    });
  };

  const handleSell = async () => {
    if (!CABAL_DIAMOND_ADDRESS || !address || !amount) return;
    
    const tokenAmount = parseEther(amount);
    const currentAllowance = (tokenAllowance as bigint) || 0n;
    
    // Check if we need approval
    if (currentAllowance < tokenAmount) {
      setIsApproving(true);
      toast.info('Approving tokens for sale...');
      
      approveWrite({
        address: cabal.tokenAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [CABAL_DIAMOND_ADDRESS, tokenAmount],
      }, {
        onError: (e) => {
          console.error('Approve error:', e);
          toast.error('Failed to approve tokens');
          setIsApproving(false);
        },
      });
      return;
    }
    
    executeSell();
  };

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
          toast.error(e.message); 
          setIsSigning(false); 
        },
        onSuccess: () => { 
          setIsSigning(false); 
          setAmount(''); 
        }
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign');
      setIsSigning(false);
    }
  };

  const handleAction = () => {
    switch (activeTab) {
      case 'buy':
        handleBuy();
        break;
      case 'sell':
        handleSell();
        break;
      case 'stake':
        handleStake();
        break;
    }
  };

  const handleMax = () => {
    switch (activeTab) {
      case 'buy':
        if (ethBalance) {
          // Leave some ETH for gas
          const maxEth = ethBalance.value > parseEther('0.001') 
            ? ethBalance.value - parseEther('0.001') 
            : 0n;
          setAmount(formatEther(maxEth));
        }
        break;
      case 'sell':
        if (tokenBalance) {
          setAmount(formatEther(tokenBalance as bigint));
        }
        break;
      case 'stake':
        if (tokenBalance) {
          setAmount(formatEther(tokenBalance as bigint));
        }
        break;
    }
  };

  const isLoading = isBuying || buyConfirming || isSelling || sellConfirming || isStaking || stakeConfirming || isSigning || approving || approveConfirming || isApproving;
  
  const getButtonText = () => {
    if (isSigning) return 'Sign Permit...';
    if (approving || approveConfirming || isApproving) return 'Approving...';
    if (isBuying || isSelling || isStaking) return 'Confirming...';
    if (buyConfirming || sellConfirming || stakeConfirming) return 'Processing...';
    
    switch (activeTab) {
      case 'buy': return 'Buy';
      case 'sell': return 'Sell';
      case 'stake': return 'Stake';
    }
  };

  const getAvailableBalance = () => {
    switch (activeTab) {
      case 'buy':
        return ethBalance ? formatEther(ethBalance.value) : '0';
      case 'sell':
      case 'stake':
        return tokenBalance ? formatEther(tokenBalance as bigint) : '0';
    }
  };

  const getInputSymbol = () => {
    switch (activeTab) {
      case 'buy': return 'ETH';
      case 'sell':
      case 'stake': return cabal.symbol;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Trade ${cabal.symbol}</DialogTitle>
          <DialogDescription>
            Buy, sell, or stake your tokens
          </DialogDescription>
        </DialogHeader>
        
        {/* Tab Selector */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          <TabButton active={activeTab === 'buy'} onClick={() => setActiveTab('buy')}>
            Buy
          </TabButton>
          <TabButton active={activeTab === 'sell'} onClick={() => setActiveTab('sell')}>
            Sell
          </TabButton>
          <TabButton active={activeTab === 'stake'} onClick={() => setActiveTab('stake')}>
            Stake
          </TabButton>
        </div>

        {/* Input Section */}
        <div className="space-y-4 py-2">
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-sm">
              <Label className="text-muted-foreground">
                {activeTab === 'buy' ? 'You pay' : activeTab === 'sell' ? 'You sell' : 'You stake'}
              </Label>
              <button 
                onClick={handleMax}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Balance: {Number(getAvailableBalance()).toFixed(4)} {getInputSymbol()}
              </button>
            </div>
            <div className="flex gap-3 items-center">
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-2xl font-mono border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
              />
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border">
                <span className="font-medium">{getInputSymbol()}</span>
              </div>
            </div>
          </div>

          {/* Output Preview for Buy/Sell */}
          {activeTab !== 'stake' && (
            <div className="flex justify-center -my-1">
              <div className="p-2 bg-muted rounded-full">
                <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {activeTab !== 'stake' && (
            <div className="p-4 bg-muted/30 rounded-xl space-y-3 border border-dashed">
              <div className="flex justify-between items-center text-sm">
                <Label className="text-muted-foreground">
                  {activeTab === 'buy' ? 'You receive' : 'You receive'}
                </Label>
              </div>
              <div className="flex gap-3 items-center">
                <span className="text-2xl font-mono text-muted-foreground">≈ ---</span>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border">
                  <span className="font-medium">{activeTab === 'buy' ? cabal.symbol : 'ETH'}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Swaps via Uniswap V4. Price impact may apply.
              </p>
            </div>
          )}

          {/* Stake Info */}
          {activeTab === 'stake' && (
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Currently Staked</span>
                <span className="font-mono font-medium">
                  <TokenAmount amount={stakedBalance as bigint} symbol={cabal.symbol} />
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Staking gives you voting power in governance proposals.
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleAction} 
          disabled={isLoading || !amount || Number(amount) <= 0}
          className="w-full h-12 text-base"
          size="lg"
        >
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {getButtonText()}
        </Button>

      </DialogContent>
    </Dialog>
  );
}
