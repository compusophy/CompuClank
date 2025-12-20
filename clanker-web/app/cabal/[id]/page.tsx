'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignTypedData, useChainId } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { formatEther, parseEther, erc20Abi, hexToSignature } from 'viem';
import { readContract } from '@wagmi/core';
import { config as wagmiConfig } from '@/lib/wagmi-config';
import { toast } from 'sonner';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CABAL_ABI, CabalInfo, CabalPhase } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { TokenAmount } from '@/components/TokenAmount';
import { ArrowLeft } from 'lucide-react';

function SimpleTabs({ tabs, activeTab, onTabChange }: { 
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === tab.id
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
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

// PRESALE COMPONENTS

function ContributeSection({ cabalId, onSuccess, userAddress }: { cabalId: bigint; onSuccess: () => void; userAddress: string }) {
  const [amount, setAmount] = useState('0.00001');
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: contribution, refetch: refetchContribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getContribution',
    args: [cabalId, userAddress as `0x${string}`],
  });

  useEffect(() => {
    if (isSuccess && hash) {
      showTransactionToast(hash, `Contributed ${amount} ETH`);
      onSuccess();
      refetchContribution();
      reset();
      setAmount('0.00001');
    }
  }, [isSuccess, hash, amount, onSuccess, reset, refetchContribution]);

  const handleContribute = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'contribute',
      args: [cabalId],
      value: parseEther(amount),
    }, {
      onError: (e) => toast.error(e.message),
    });
  };

  const contributionAmount = contribution as bigint | undefined;

  return (
    <div className="space-y-4">
      {contributionAmount && contributionAmount > 0n && (
        <div className="p-3 bg-muted rounded-md flex justify-between items-center text-sm">
          <span>Your Contribution</span>
          <TokenAmount amount={contributionAmount} symbol="ETH" className="font-mono font-medium" />
        </div>
      )}
      <div className="flex gap-2">
        <Input
          type="number"
          step="0.001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="ETH amount"
        />
        <Button onClick={handleContribute} disabled={isPending || isConfirming}>
          {isPending || isConfirming ? 'Confirming...' : 'Contribute'}
        </Button>
      </div>
    </div>
  );
}

function LaunchSection({ cabalId, cabal, userAddress, onSuccess }: { 
  cabalId: bigint; cabal: CabalInfo; userAddress: string; onSuccess: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const isCreator = cabal.creator.toLowerCase() === userAddress.toLowerCase();

  useEffect(() => {
    if (isSuccess && hash) {
      showTransactionToast(hash, "Token deployed!");
      onSuccess();
    }
  }, [isSuccess, hash, onSuccess]);

  const handleFinalize = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'finalizeCabal',
      args: [cabalId],
    }, {
      onError: (e) => toast.error(e.message),
    });
  };

  if (!isCreator) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the creator can launch. Creator: <span className="font-mono text-xs">{cabal.creator.slice(0, 8)}...</span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Treasury (10%)</span>
          <TokenAmount amount={cabal.totalRaised / 10n} symbol="ETH" className="font-mono" />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">DevBuy (90%)</span>
          <TokenAmount amount={cabal.totalRaised * 9n / 10n} symbol="ETH" className="font-mono" />
        </div>
      </div>
      <Button onClick={handleFinalize} disabled={isPending || isConfirming || cabal.totalRaised === 0n} className="w-full">
        {isPending || isConfirming ? 'Deploying...' : 'Launch Token'}
      </Button>
    </div>
  );
}

// ACTIVE COMPONENTS - POSITION TAB

function PositionSection({ cabalId, cabal, userAddress, onSuccess }: { 
  cabalId: bigint; cabal: CabalInfo; userAddress: string; onSuccess: () => void;
}) {
  const { address } = useAccount();
  const chainId = useChainId();
  const queryClient = useQueryClient();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const { signTypedDataAsync } = useSignTypedData();

  // Read data
  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'getClaimable',
    args: [cabalId, userAddress as `0x${string}`],
  });
  const { data: contribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'getContribution',
    args: [cabalId, userAddress as `0x${string}`],
  });
  const { data: hasClaimed, refetch: refetchHasClaimed } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'hasClaimed',
    args: [cabalId, userAddress as `0x${string}`],
  });
  const { data: stakedBalance, refetch: refetchStaked } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'getStakedBalance',
    args: address ? [cabalId, address] : undefined,
  });
  const { data: votingPower, refetch: refetchVoting } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'getVotingPower',
    args: address ? [cabalId, address] : undefined,
  });
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: cabal.tokenAddress, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Claim
  const { writeContract: claimWrite, data: claimHash, isPending: isClaiming } = useWriteContract();
  const { isSuccess: claimSuccess, isLoading: claimConfirming } = useWaitForTransactionReceipt({ hash: claimHash });

  // Stake
  const { writeContract: stakeWrite, data: stakeHash, isPending: isStaking, reset: resetStake } = useWriteContract();
  const { isSuccess: stakeSuccess, isLoading: stakeConfirming } = useWaitForTransactionReceipt({ hash: stakeHash });

  // Unstake
  const { writeContract: unstakeWrite, data: unstakeHash, isPending: isUnstaking } = useWriteContract();
  const { isSuccess: unstakeSuccess, isLoading: unstakeConfirming } = useWaitForTransactionReceipt({ hash: unstakeHash });

  useEffect(() => {
    if (claimSuccess && claimHash) {
      showTransactionToast(claimHash, 'Tokens claimed!');
      refetchClaimable(); refetchHasClaimed(); onSuccess();
    }
  }, [claimSuccess, claimHash]);

  useEffect(() => {
    if (stakeSuccess && stakeHash) {
      showTransactionToast(stakeHash, 'Staked!');
      refetchStaked(); refetchVoting(); refetchTokenBalance(); queryClient.invalidateQueries(); onSuccess();
    }
  }, [stakeSuccess, stakeHash]);

  useEffect(() => {
    if (unstakeSuccess && unstakeHash) {
      showTransactionToast(unstakeHash, 'Unstaked!');
      refetchStaked(); refetchVoting(); refetchTokenBalance(); queryClient.invalidateQueries(); onSuccess();
    }
  }, [unstakeSuccess, unstakeHash]);

  const handleClaim = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    claimWrite({ address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'claimTokens', args: [cabalId] }, {
      onError: (e) => toast.error(e.message),
    });
  };

  const handleStake = async () => {
    if (!CABAL_DIAMOND_ADDRESS || !stakeAmount || !address) return;
    const amount = parseEther(stakeAmount);
    setIsSigning(true);
    try {
      const nonce = await readContract(wagmiConfig, {
        address: cabal.tokenAddress,
        abi: [...erc20Abi, { inputs: [{ name: 'owner', type: 'address' }], name: 'nonces', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }] as const,
        functionName: 'nonces', args: [address],
      });
      const tokenName = await readContract(wagmiConfig, { address: cabal.tokenAddress, abi: erc20Abi, functionName: 'name' });
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const signature = await signTypedDataAsync({
        domain: { name: tokenName, version: '1', chainId, verifyingContract: cabal.tokenAddress },
        types: { Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
        primaryType: 'Permit',
        message: { owner: address, spender: CABAL_DIAMOND_ADDRESS, value: amount, nonce: nonce as bigint, deadline },
      });
      const { v, r, s } = hexToSignature(signature);
      stakeWrite({ address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'stakeWithPermit', args: [cabalId, amount, deadline, Number(v), r, s] }, {
        onError: (e) => { toast.error(e.message); setIsSigning(false); },
        onSuccess: () => { setIsSigning(false); setStakeAmount(''); }
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to sign');
      setIsSigning(false);
    }
  };

  const handleUnstake = () => {
    if (!CABAL_DIAMOND_ADDRESS || !unstakeAmount) return;
    unstakeWrite({ address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'unstake', args: [cabalId, parseEther(unstakeAmount)] }, {
      onError: (e) => toast.error(e.message),
      onSuccess: () => setUnstakeAmount(''),
    });
  };

  const contributionAmount = contribution as bigint | undefined;
  const claimableAmount = claimable as bigint | undefined;
  const hasClaimedStatus = hasClaimed as boolean | undefined;
  const canClaim = contributionAmount && contributionAmount > 0n && claimableAmount && claimableAmount > 0n && !hasClaimedStatus;

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-mono font-bold">
            <TokenAmount amount={tokenBalance as bigint} decimals={2} />
          </p>
          <p className="text-xs text-muted-foreground">Balance</p>
        </div>
        <div>
          <p className="text-2xl font-mono font-bold">
            <TokenAmount amount={stakedBalance as bigint} decimals={2} />
          </p>
          <p className="text-xs text-muted-foreground">Staked</p>
        </div>
        <div>
          <p className="text-2xl font-mono font-bold">
            <TokenAmount amount={votingPower as bigint} decimals={2} />
          </p>
          <p className="text-xs text-muted-foreground">Votes</p>
        </div>
      </div>

      {/* Claim */}
      {canClaim && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">Claimable Tokens</p>
                <p className="text-xl font-mono font-bold">
                  <TokenAmount amount={claimableAmount} symbol={cabal.symbol} />
                </p>
              </div>
              <Button onClick={handleClaim} disabled={isClaiming || claimConfirming}>
                {isClaiming || claimConfirming ? 'Claiming...' : 'Claim'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stake/Unstake */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label className="text-xs">Stake</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Amount" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => tokenBalance && setStakeAmount(formatEther(tokenBalance as bigint))}>Max</Button>
            </div>
            <Button onClick={handleStake} disabled={isSigning || isStaking || stakeConfirming || !stakeAmount} className="w-full" size="sm">
              {isSigning ? 'Sign...' : isStaking || stakeConfirming ? 'Staking...' : 'Stake'}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Label className="text-xs">Unstake</Label>
            <div className="flex gap-2">
              <Input type="number" placeholder="Amount" value={unstakeAmount} onChange={(e) => setUnstakeAmount(e.target.value)} />
              <Button variant="outline" size="sm" onClick={() => stakedBalance && setUnstakeAmount(formatEther(stakedBalance as bigint))}>Max</Button>
            </div>
            <Button onClick={handleUnstake} disabled={isUnstaking || unstakeConfirming || !unstakeAmount} className="w-full" size="sm" variant="outline">
              {isUnstaking || unstakeConfirming ? 'Unstaking...' : 'Unstake'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ACTIVE COMPONENTS - GOVERNANCE TAB

function GovernanceSection({ cabalId, cabal }: { cabalId: bigint; cabal: CabalInfo }) {
  const [delegatee, setDelegatee] = useState('');
  const { writeContract: delegate, isPending: isDelegating } = useWriteContract();
  const { writeContract: undelegate, isPending: isUndelegating } = useWriteContract();
  const { writeContract: claimFees, isPending: isClaiming } = useWriteContract();

  const { data: ethBalance } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'getTreasuryETHBalance', args: [cabalId],
  });

  const handleDelegate = () => {
    if (!CABAL_DIAMOND_ADDRESS || !delegatee) return;
    delegate({ address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'delegate', args: [cabalId, delegatee as `0x${string}`] }, {
      onSuccess: () => { toast.success('Delegated!'); setDelegatee(''); },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleUndelegate = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    undelegate({ address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'undelegate', args: [cabalId] }, {
      onSuccess: () => toast.success('Undelegated!'),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleClaimFees = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    claimFees({ address: CABAL_DIAMOND_ADDRESS, abi: CABAL_ABI, functionName: 'claimLPFees', args: [cabalId, '0x4200000000000000000000000000000000000006'] }, {
      onSuccess: () => toast.success('LP fees claimed!'),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-6">
      {/* Treasury */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Treasury</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">ETH Balance</span>
            <span className="text-xl font-mono font-bold">
              <TokenAmount amount={ethBalance as bigint} symbol="ETH" />
            </span>
          </div>
          <p className="text-xs text-muted-foreground break-all">TBA: {cabal.tbaAddress}</p>
          <Button onClick={handleClaimFees} disabled={isClaiming} variant="outline" size="sm" className="w-full">
            {isClaiming ? 'Claiming...' : 'Claim LP Fees'}
          </Button>
        </CardContent>
      </Card>

      {/* Delegation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Delegation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="0x..." value={delegatee} onChange={(e) => setDelegatee(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={handleDelegate} disabled={isDelegating || !delegatee} size="sm" className="flex-1">
              {isDelegating ? 'Delegating...' : 'Delegate'}
            </Button>
            <Button onClick={handleUndelegate} disabled={isUndelegating} variant="outline" size="sm" className="flex-1">
              {isUndelegating ? '...' : 'Undelegate'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Proposals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}

// MAIN PAGE

export default function CabalDetailPage() {
  const params = useParams();
  const cabalId = BigInt(params.id as string);
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('position');
  const queryClient = useQueryClient();

  const { data: cabal, isLoading, refetch } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getCabal',
    args: [cabalId],
  }) as { data: CabalInfo | undefined; isLoading: boolean; refetch: () => void };

  const handleSuccess = () => {
    refetch();
    queryClient.invalidateQueries();
  };

  if (!CABAL_DIAMOND_ADDRESS || isLoading || !cabal) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
          <div className="page-container">
            <div className="flex items-center justify-between h-12">
              <div className="flex items-center gap-3">
                <Link href="/cabal"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button></Link>
                <span className="text-muted-foreground">Loading...</span>
              </div>
              <WalletButton />
            </div>
          </div>
        </header>
      </div>
    );
  }

  const phaseLabel = ['Presale', 'Active', 'Paused'][cabal.phase] || 'Unknown';
  const phaseColor = cabal.phase === CabalPhase.Presale ? 'bg-yellow-500' : cabal.phase === CabalPhase.Active ? 'bg-green-500' : 'bg-red-500';

  const tabs = cabal.phase === CabalPhase.Active
    ? [{ id: 'position', label: 'Position' }, { id: 'governance', label: 'Governance' }]
    : [];

  return (
    <div className="min-h-screen">
      {/* Header - just ticker */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="page-container">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <Link href="/cabal"><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button></Link>
              <span className="font-mono font-bold text-lg">${cabal.symbol}</span>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="page-container section-gap">
        {/* Status + Stats - always visible */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 text-xs rounded-full text-white ${phaseColor}`}>{phaseLabel}</span>
            {cabal.phase === CabalPhase.Active && (
              <a href={`https://basescan.org/address/${cabal.tokenAddress}`} target="_blank" rel="noopener noreferrer" 
                 className="text-xs font-mono text-muted-foreground hover:text-foreground">
                {cabal.tokenAddress.slice(0, 6)}...{cabal.tokenAddress.slice(-4)}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Raised</p>
              <p className="font-mono font-medium"><TokenAmount amount={cabal.totalRaised} symbol="ETH" /></p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Contributors</p>
              <p className="font-medium">{cabal.contributorCount.toString()}</p>
            </div>
            {cabal.phase === CabalPhase.Active && (
              <>
                <div>
                  <p className="text-muted-foreground text-xs">Staked</p>
                  <p className="font-mono font-medium"><TokenAmount amount={cabal.totalStaked} /></p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Quorum</p>
                  <p className="font-medium">{Number(cabal.settings.quorumBps) / 100}%</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Connect prompt */}
        {!isConnected && (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Connect wallet to interact</p>
          </Card>
        )}

        {/* Presale Content */}
        {isConnected && address && cabal.phase === CabalPhase.Presale && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Contribute</CardTitle></CardHeader>
              <CardContent>
                <ContributeSection cabalId={cabalId} onSuccess={handleSuccess} userAddress={address} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Launch</CardTitle></CardHeader>
              <CardContent>
                <LaunchSection cabalId={cabalId} cabal={cabal} userAddress={address} onSuccess={handleSuccess} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Active Content - Tabbed */}
        {isConnected && address && cabal.phase === CabalPhase.Active && (
          <>
            <SimpleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            {activeTab === 'position' && (
              <PositionSection cabalId={cabalId} cabal={cabal} userAddress={address} onSuccess={handleSuccess} />
            )}
            {activeTab === 'governance' && (
              <GovernanceSection cabalId={cabalId} cabal={cabal} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
