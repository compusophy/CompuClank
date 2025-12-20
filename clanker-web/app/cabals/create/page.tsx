'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { toast } from 'sonner';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';

// Default governance settings
const DEFAULT_SETTINGS = {
  votingPeriod: BigInt(50400), // ~1 week on Base (2s blocks)
  quorumBps: BigInt(1000), // 10% quorum
  majorityBps: BigInt(5100), // 51% majority
  proposalThreshold: BigInt(0), // Anyone with stake can propose
};

export default function CreateCabalPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    image: '',
    votingPeriod: '50400',
    quorumPercent: '10',
    majorityPercent: '51',
    proposalThreshold: '0',
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

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
        toast.success('Cabal created! Waiting for confirmation...');
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to create Cabal');
      },
    });
  };

  // Handle successful creation with useEffect to avoid render-time side effects
  useEffect(() => {
    if (isSuccess) {
      toast.success('Cabal created successfully!');
      router.push('/cabals');
    }
  }, [isSuccess, router]);

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/cabals" className="text-sm text-muted-foreground hover:underline">
            ← Back to Cabals
          </Link>
          <h1 className="text-3xl font-bold mt-2">Create Cabal</h1>
        </div>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <Card className="p-8 text-center">
          <CardTitle className="mb-4">Connect Wallet</CardTitle>
          <CardDescription className="mb-6">
            Connect your wallet to create a Cabal.
          </CardDescription>
          <ConnectButton />
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>New Cabal</CardTitle>
            <CardDescription>
              Create a decentralized group wallet with its own governance token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Token Name</Label>
                  <Input
                    id="name"
                    placeholder="My Cabal"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="symbol">Token Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="CABAL"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    required
                    maxLength={10}
                  />
                </div>

                <div>
                  <Label htmlFor="image">Image URL (optional)</Label>
                  <Input
                    id="image"
                    placeholder="ipfs://... or https://..."
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Governance Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quorum">Quorum (%)</Label>
                    <Input
                      id="quorum"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.quorumPercent}
                      onChange={(e) => setFormData({ ...formData, quorumPercent: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Min % of staked tokens needed to vote
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="majority">Majority (%)</Label>
                    <Input
                      id="majority"
                      type="number"
                      min="50"
                      max="100"
                      value={formData.majorityPercent}
                      onChange={(e) => setFormData({ ...formData, majorityPercent: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      % of votes needed to pass
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="votingPeriod">Voting Period (blocks)</Label>
                    <Input
                      id="votingPeriod"
                      type="number"
                      min="100"
                      value={formData.votingPeriod}
                      onChange={(e) => setFormData({ ...formData, votingPeriod: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      50400 blocks ≈ 1 week on Base
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="threshold">Proposal Threshold</Label>
                    <Input
                      id="threshold"
                      type="number"
                      min="0"
                      value={formData.proposalThreshold}
                      onChange={(e) => setFormData({ ...formData, proposalThreshold: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Min voting power to create proposal
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isPending || isConfirming || !formData.name || !formData.symbol}
              >
                {isPending ? 'Confirming...' : isConfirming ? 'Creating...' : 'Create Cabal'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
