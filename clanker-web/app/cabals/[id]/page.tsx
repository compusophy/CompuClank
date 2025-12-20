'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { formatEther, parseEther } from 'viem';
import { toast } from 'sonner';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CABAL_ABI, CabalInfo, CabalPhase } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';

function SimpleTabs({ tabs, activeTab, onTabChange }: { 
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div className="flex border-b mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 -mb-px ${
            activeTab === tab.id
              ? 'border-b-2 border-primary text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TransactionSuccess({ hash, message }: { hash: string; message: string }) {
  return (
    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg space-y-2">
      <p className="text-green-600 font-medium">{message}</p>
      <a
        href={`https://basescan.org/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-primary hover:underline"
      >
        View on Basescan
      </a>
    </div>
  );
}

function ContributeSection({ cabalId, onSuccess }: { cabalId: bigint; onSuccess: () => void }) {
  const [amount, setAmount] = useState('0.01');
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

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

  const handleReset = () => {
    reset();
    setAmount('0.01');
  };

  if (isSuccess && hash) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contribution Successful</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TransactionSuccess hash={hash} message={`Contributed ${amount} ETH successfully!`} />
          <Button onClick={handleReset} variant="outline" className="w-full">
            Contribute More
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contribute to Presale</CardTitle>
        <CardDescription>
          Contribute ETH to receive tokens when the Cabal launches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="amount">Amount (ETH)</Label>
          <Input
            id="amount"
            type="number"
            step="0.001"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <Button
          onClick={handleContribute}
          disabled={isPending || isConfirming}
          className="w-full"
        >
          {isPending ? 'Waiting for wallet...' : isConfirming ? 'Confirming...' : 'Contribute'}
        </Button>
      </CardContent>
    </Card>
  );
}

function FinalizeCabalSection({ cabalId, cabal, userAddress, onSuccess }: { 
  cabalId: bigint; 
  cabal: CabalInfo; 
  userAddress: string;
  onSuccess: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const isCreator = cabal.creator.toLowerCase() === userAddress.toLowerCase();

  useEffect(() => {
    if (isSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

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
      <Card>
        <CardHeader>
          <CardTitle>Waiting for Launch</CardTitle>
          <CardDescription>
            Only the creator can finalize the presale and deploy the token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Creator: <span className="font-mono">{cabal.creator}</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isSuccess && hash) {
    const tokenAddress = cabal.tokenAddress !== '0x0000000000000000000000000000000000000000' ? cabal.tokenAddress : null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Deployed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <TransactionSuccess hash={hash} message="Token deployed successfully! The Cabal is now active." />
          
          {tokenAddress && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-900">
              <h3 className="font-semibold text-green-800 dark:text-green-300">Success!</h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Token deployed at: <span className="font-mono">{tokenAddress}</span>
              </p>
              <a 
                href={`https://clanker.world/clanker/${tokenAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline mt-2 inline-block"
              >
                View on Clanker World &rarr;
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Launch Your Token</CardTitle>
        <CardDescription>
          As the creator, you can finalize the presale and deploy the token via Clanker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total Raised</span>
            <span className="font-mono font-bold">{formatEther(cabal.totalRaised)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span>Tithe (10% to Treasury)</span>
            <span className="font-mono">{formatEther(cabal.totalRaised / 10n)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span>DevBuy (90% to Token)</span>
            <span className="font-mono">{formatEther(cabal.totalRaised * 9n / 10n)} ETH</span>
          </div>
        </div>
        <Button
          onClick={handleFinalize}
          disabled={isPending || isConfirming || cabal.totalRaised === 0n}
          className="w-full"
          size="lg"
        >
          {isPending ? 'Waiting for wallet...' : isConfirming ? 'Deploying token...' : 'Finalize & Deploy Token'}
        </Button>
        {cabal.totalRaised === 0n && (
          <p className="text-xs text-muted-foreground text-center">
            Need at least some ETH contributed to finalize
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ClaimTokensSection({ cabalId, cabal, userAddress, onSuccess }: { 
  cabalId: bigint; 
  cabal: CabalInfo; 
  userAddress: string;
  onSuccess: () => void;
}) {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getClaimable',
    args: [cabalId, userAddress as `0x${string}`],
  });

  const { data: contribution } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getContribution',
    args: [cabalId, userAddress as `0x${string}`],
  });

  useEffect(() => {
    if (isSuccess) {
      refetchClaimable();
      onSuccess();
    }
  }, [isSuccess, refetchClaimable, onSuccess]);

  const handleClaim = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    
    writeContract({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'claimTokens',
      args: [cabalId],
    }, {
      onError: (e) => toast.error(e.message),
    });
  };

  const contributionAmount = contribution as bigint | undefined;
  const claimableAmount = claimable as bigint | undefined;

  if (!contributionAmount || contributionAmount === 0n) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Contribution</CardTitle>
          <CardDescription>
            You did not contribute to this presale.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSuccess && hash) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tokens Claimed</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionSuccess hash={hash} message={`Claimed your ${cabal.symbol} tokens successfully!`} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim Your Tokens</CardTitle>
        <CardDescription>
          Claim your proportional share of {cabal.symbol} tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Your Contribution</span>
            <span className="font-mono">{formatEther(contributionAmount)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span>Claimable Tokens</span>
            <span className="font-mono font-bold">
              {claimableAmount ? formatEther(claimableAmount) : '0'} {cabal.symbol}
            </span>
          </div>
        </div>
        <Button
          onClick={handleClaim}
          disabled={isPending || isConfirming || !claimableAmount || claimableAmount === 0n}
          className="w-full"
        >
          {isPending ? 'Waiting for wallet...' : isConfirming ? 'Confirming...' : 
           !claimableAmount || claimableAmount === 0n ? 'Already Claimed' : 'Claim Tokens'}
        </Button>
      </CardContent>
    </Card>
  );
}

function StakingSection({ cabalId, cabal }: { cabalId: bigint; cabal: CabalInfo }) {
  const { address } = useAccount();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  const { data: stakedBalance, refetch: refetchStaked } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getStakedBalance',
    args: address ? [cabalId, address] : undefined,
  });

  const { data: votingPower, refetch: refetchVoting } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getVotingPower',
    args: address ? [cabalId, address] : undefined,
  });

  const { writeContract: stake, data: stakeHash, isPending: isStaking } = useWriteContract();
  const { writeContract: unstake, data: unstakeHash, isPending: isUnstaking } = useWriteContract();
  
  const { isSuccess: stakeSuccess } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isSuccess: unstakeSuccess } = useWaitForTransactionReceipt({ hash: unstakeHash });

  useEffect(() => {
    if (stakeSuccess || unstakeSuccess) {
      refetchStaked();
      refetchVoting();
      setStakeAmount('');
      setUnstakeAmount('');
    }
  }, [stakeSuccess, unstakeSuccess, refetchStaked, refetchVoting]);

  const handleStake = () => {
    if (!CABAL_DIAMOND_ADDRESS || !stakeAmount) return;
    stake({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'stake',
      args: [cabalId, parseEther(stakeAmount)],
    }, {
      onError: (e) => toast.error(e.message),
    });
  };

  const handleUnstake = () => {
    if (!CABAL_DIAMOND_ADDRESS || !unstakeAmount) return;
    unstake({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'unstake',
      args: [cabalId, parseEther(unstakeAmount)],
    }, {
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your Position</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Staked Balance</span>
            <span className="font-mono">
              {stakedBalance ? formatEther(stakedBalance as bigint) : '0'} {cabal.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Voting Power</span>
            <span className="font-mono">
              {votingPower ? formatEther(votingPower as bigint) : '0'}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Stake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="number"
              placeholder="Amount"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
            />
            <Button onClick={handleStake} disabled={isStaking} className="w-full" size="sm">
              {isStaking ? 'Staking...' : 'Stake'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Unstake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              type="number"
              placeholder="Amount"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
            />
            <Button onClick={handleUnstake} disabled={isUnstaking} className="w-full" size="sm" variant="outline">
              {isUnstaking ? 'Unstaking...' : 'Unstake'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DelegationSection({ cabalId }: { cabalId: bigint }) {
  const [delegatee, setDelegatee] = useState('');
  const { writeContract: delegate, isPending: isDelegating } = useWriteContract();
  const { writeContract: undelegate, isPending: isUndelegating } = useWriteContract();

  const handleDelegate = () => {
    if (!CABAL_DIAMOND_ADDRESS || !delegatee) return;
    delegate({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'delegate',
      args: [cabalId, delegatee as `0x${string}`],
    }, {
      onSuccess: () => {
        toast.success('Delegated successfully!');
        setDelegatee('');
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleUndelegate = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    undelegate({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'undelegate',
      args: [cabalId],
    }, {
      onSuccess: () => toast.success('Undelegated successfully!'),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delegation</CardTitle>
        <CardDescription>
          Delegate your voting power to another address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="delegatee">Delegate to Address</Label>
          <Input
            id="delegatee"
            placeholder="0x..."
            value={delegatee}
            onChange={(e) => setDelegatee(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDelegate} disabled={isDelegating} className="flex-1">
            {isDelegating ? 'Delegating...' : 'Delegate'}
          </Button>
          <Button onClick={handleUndelegate} disabled={isUndelegating} variant="outline" className="flex-1">
            {isUndelegating ? 'Undelegating...' : 'Undelegate'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TreasurySection({ cabalId, cabal }: { cabalId: bigint; cabal: CabalInfo }) {
  const { data: ethBalance } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getTreasuryETHBalance',
    args: [cabalId],
  });

  const { writeContract: claimFees, isPending } = useWriteContract();
  const WETH = '0x4200000000000000000000000000000000000006';

  const handleClaimFees = () => {
    if (!CABAL_DIAMOND_ADDRESS) return;
    claimFees({
      address: CABAL_DIAMOND_ADDRESS,
      abi: CABAL_ABI,
      functionName: 'claimLPFees',
      args: [cabalId, WETH],
    }, {
      onSuccess: () => toast.success('LP fees claimed!'),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treasury</CardTitle>
        <CardDescription>
          TBA: <span className="font-mono text-xs">{cabal.tbaAddress}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span>ETH Balance</span>
          <span className="font-mono text-lg">
            {ethBalance ? formatEther(ethBalance as bigint) : '0'} ETH
          </span>
        </div>
        <Button onClick={handleClaimFees} disabled={isPending} variant="outline" className="w-full">
          {isPending ? 'Claiming...' : 'Claim LP Fees (WETH)'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CabalDetailPage() {
  const params = useParams();
  const cabalId = BigInt(params.id as string);
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: cabal, isLoading, refetch } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: 'getCabal',
    args: [cabalId],
  }) as { data: CabalInfo | undefined; isLoading: boolean; refetch: () => void };

  // Refetch data after any successful transaction
  const handleTransactionSuccess = () => {
    refetch();
    // Also invalidate all queries to refresh other data
    queryClient.invalidateQueries();
  };

  if (!CABAL_DIAMOND_ADDRESS) {
    return (
      <div className="container mx-auto py-10 max-w-4xl">
        <p>Contract not deployed</p>
      </div>
    );
  }

  if (isLoading || !cabal) {
    return (
      <div className="container mx-auto py-10 max-w-4xl">
        <p>Loading...</p>
      </div>
    );
  }

  const phaseLabel = ['Presale', 'Active', 'Paused'][cabal.phase] || 'Unknown';

  const tabs = [
    { id: 'overview', label: 'Overview' },
    ...(cabal.phase === CabalPhase.Presale 
      ? [
          { id: 'presale', label: 'Contribute' },
          { id: 'finalize', label: 'Launch' },
        ] 
      : []),
    ...(cabal.phase === CabalPhase.Active
      ? [
          { id: 'claim', label: 'Claim Tokens' },
          { id: 'staking', label: 'Staking' },
          { id: 'delegation', label: 'Delegation' },
          { id: 'governance', label: 'Governance' },
          { id: 'treasury', label: 'Treasury' },
        ]
      : []),
  ];

  return (
    <div className="container mx-auto py-10 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/cabals" className="text-sm text-muted-foreground hover:underline">
            Back to Cabals
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-3xl font-bold">{cabal.name}</h1>
            <span className="text-muted-foreground font-mono">${cabal.symbol}</span>
            <span className={`px-2 py-1 text-xs rounded-full text-white ${
              cabal.phase === CabalPhase.Presale ? 'bg-yellow-500' :
              cabal.phase === CabalPhase.Active ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {phaseLabel}
            </span>
          </div>
        </div>
        <ConnectButton />
      </div>

      <SimpleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Total Raised</span>
                <span className="font-mono">{formatEther(cabal.totalRaised)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span>Contributors</span>
                <span>{cabal.contributorCount.toString()}</span>
              </div>
              {cabal.phase === CabalPhase.Active && (
                <>
                  <div className="flex justify-between">
                    <span>Total Staked</span>
                    <span className="font-mono">{formatEther(cabal.totalStaked)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Token Address</span>
                    <a
                      href={`https://basescan.org/address/${cabal.tokenAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-primary hover:underline"
                    >
                      {cabal.tokenAddress.slice(0, 6)}...{cabal.tokenAddress.slice(-4)}
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governance Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Voting Period</span>
                <span>{cabal.settings.votingPeriod.toString()} blocks</span>
              </div>
              <div className="flex justify-between">
                <span>Quorum</span>
                <span>{Number(cabal.settings.quorumBps) / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span>Majority</span>
                <span>{Number(cabal.settings.majorityBps) / 100}%</span>
              </div>
              <div className="flex justify-between">
                <span>Proposal Threshold</span>
                <span>{cabal.settings.proposalThreshold.toString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'presale' && isConnected && (
        <ContributeSection cabalId={cabalId} onSuccess={handleTransactionSuccess} />
      )}

      {activeTab === 'finalize' && isConnected && address && (
        <FinalizeCabalSection cabalId={cabalId} cabal={cabal} userAddress={address} onSuccess={handleTransactionSuccess} />
      )}

      {activeTab === 'claim' && isConnected && address && (
        <ClaimTokensSection cabalId={cabalId} cabal={cabal} userAddress={address} onSuccess={handleTransactionSuccess} />
      )}

      {activeTab === 'staking' && isConnected && (
        <StakingSection cabalId={cabalId} cabal={cabal} />
      )}

      {activeTab === 'delegation' && isConnected && (
        <DelegationSection cabalId={cabalId} />
      )}

      {activeTab === 'governance' && isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Governance</CardTitle>
            <CardDescription>
              Create and vote on proposals to manage the Cabal treasury.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Proposal creation and voting UI coming soon...
            </p>
          </CardContent>
        </Card>
      )}

      {activeTab === 'treasury' && isConnected && (
        <TreasurySection cabalId={cabalId} cabal={cabal} />
      )}

      {!isConnected && activeTab !== 'overview' && (
        <Card className="p-8 text-center">
          <CardTitle className="mb-4">Connect Wallet</CardTitle>
          <CardDescription className="mb-6">
            Connect your wallet to interact with this Cabal.
          </CardDescription>
          <ConnectButton />
        </Card>
      )}
    </div>
  );
}
