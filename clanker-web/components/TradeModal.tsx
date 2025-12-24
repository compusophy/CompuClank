'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther, erc20Abi } from 'viem';
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
import { CABAL_ABI, CabalInfo } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { ArrowDownUp, Loader2 } from 'lucide-react';
import { UI_CONSTANTS } from '@/lib/utils';
import { GOLDEN_RATIO_WIDTH } from '@/components/layout/PrimaryCTA';
import { haptics } from '@/lib/haptics';

type TradeTab = 'buy' | 'sell';

interface TradeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cabalId: bigint;
  cabal: CabalInfo;
  onSuccess: () => void;
  initialTab?: TradeTab;
}

function showTransactionToast(hash: string, message: string) {
  haptics.success(); // Golden ratio success haptic
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
  const [isApproving, setIsApproving] = useState(false);
  const { address } = useAccount();

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

  // Buy tokens contract call
  const { writeContract: buyWrite, data: buyHash, isPending: isBuying, reset: resetBuy } = useWriteContract();
  const { isSuccess: buySuccess, isLoading: buyConfirming } = useWaitForTransactionReceipt({ hash: buyHash });

  // Sell tokens contract call
  const { writeContract: sellWrite, data: sellHash, isPending: isSelling, reset: resetSell } = useWriteContract();
  const { isSuccess: sellSuccess, isLoading: sellConfirming } = useWaitForTransactionReceipt({ hash: sellHash });

  // Approve tokens contract call
  const { writeContract: approveWrite, data: approveHash, isPending: approving } = useWriteContract();
  const { isSuccess: approveSuccess, isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveHash });

  // Handle buy success
  useEffect(() => {
    if (buySuccess && buyHash) {
      showTransactionToast(buyHash, 'Bought tokens!');
      refetchTokenBalance();
      onSuccess();
      setAmount('');
      resetBuy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveSuccess, approveHash]);

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
        haptics.error(); // Error haptic
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
        haptics.error(); // Error haptic
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
          haptics.error(); // Error haptic
          toast.error('Failed to approve tokens');
          setIsApproving(false);
        },
      });
      return;
    }
    
    executeSell();
  };

  const handleAction = () => {
    if (activeTab === 'buy') {
      handleBuy();
    } else {
      handleSell();
    }
  };

  const handleMax = () => {
    if (activeTab === 'buy') {
      if (ethBalance) {
        // Leave some ETH for gas
        const maxEth = ethBalance.value > parseEther('0.001') 
          ? ethBalance.value - parseEther('0.001') 
          : 0n;
        setAmount(formatEther(maxEth));
      }
    } else {
      if (tokenBalance) {
        setAmount(formatEther(tokenBalance as bigint));
      }
    }
  };

  const isLoading = isBuying || buyConfirming || isSelling || sellConfirming || approving || approveConfirming || isApproving;
  
  const getButtonText = () => {
    if (approving || approveConfirming || isApproving) return 'Approving...';
    if (isBuying || isSelling) return 'Confirming...';
    if (buyConfirming || sellConfirming) return 'Processing...';
    
    return activeTab === 'buy' ? 'Buy' : 'Sell';
  };

  const getAvailableBalance = () => {
    if (activeTab === 'buy') {
      return ethBalance ? formatEther(ethBalance.value) : '0';
    }
    return tokenBalance ? formatEther(tokenBalance as bigint) : '0';
  };

  const getInputSymbol = () => {
    return activeTab === 'buy' ? 'ETH' : cabal.symbol;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent blurBackground className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Trade ${cabal.symbol}</DialogTitle>
          <DialogDescription>
            Buy or sell tokens
          </DialogDescription>
        </DialogHeader>
        
        {/* Tab Selector */}
        <div className={`flex gap-1 p-1 bg-muted ${UI_CONSTANTS.rounded}`}>
          <TabButton active={activeTab === 'buy'} onClick={() => setActiveTab('buy')}>
            Buy
          </TabButton>
          <TabButton active={activeTab === 'sell'} onClick={() => setActiveTab('sell')}>
            Sell
          </TabButton>
        </div>

        {/* Input Section */}
        <div className={`${UI_CONSTANTS.spaceY} py-2`}>
          <div className={`${UI_CONSTANTS.padding} bg-muted/50 ${UI_CONSTANTS.rounded} space-y-3`}>
            <div className="flex justify-between items-center text-sm">
              <Label className="text-muted-foreground">
                {activeTab === 'buy' ? 'You pay' : 'You sell'}
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

          {/* Output Preview */}
          <div className="flex justify-center -my-1">
            <div className="p-2 bg-muted rounded-full">
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className={`${UI_CONSTANTS.padding} bg-muted/30 ${UI_CONSTANTS.rounded} space-y-3 border border-dashed`}>
            <div className="flex justify-between items-center text-sm">
              <Label className="text-muted-foreground">
                You receive
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
        </div>

        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <Button 
            onClick={handleAction} 
            disabled={isLoading || !amount || Number(amount) <= 0}
            className={`${GOLDEN_RATIO_WIDTH} h-12 text-base shadow-lg`}
            size="lg"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {getButtonText()}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
