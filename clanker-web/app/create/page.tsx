'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { WalletButton } from '@/components/wallet/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { ArrowLeft, Settings2, ChevronDown, ChevronUp, Plus } from 'lucide-react';

export default function CreateCabalPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
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

  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Automatically sync name with symbol (ticker) if not manually edited
  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    // Clean up ticker: remove leading $ if present
    const cleanSymbol = value.startsWith('$') ? value.slice(1) : value;
    
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

  useEffect(() => {
    if (isSuccess) {
      toast.success('CABAL created successfully!');
      router.push('/');
    }
  }, [isSuccess, router]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="page-container">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <span className="text-xl font-bold tracking-tight">Create</span>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="page-container section-gap max-w-lg">
        {!isConnected ? (
          <Card className="p-6 text-center">
            <CardTitle className="mb-3">Connect Wallet</CardTitle>
            <CardDescription>
              Connect your wallet to create a CABAL.
            </CardDescription>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>New CABAL</CardTitle>
              <CardDescription>
                Create a decentralized group wallet with its own governance token.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Primary Input: Ticker */}
                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                    <Input
                      placeholder="TICKER"
                      value={formData.symbol}
                      onChange={handleSymbolChange}
                      required
                      maxLength={10}
                      className="pl-7 font-mono uppercase text-lg h-12"
                    />
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="border-t pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex justify-between items-center text-muted-foreground hover:text-foreground h-auto py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Settings2 className="h-4 w-4" />
                      Advanced Settings
                    </span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>

                  {/* Advanced Content */}
                  {showAdvanced && (
                    <div className="space-y-6 pt-4 animate-in slide-in-from-top-2 fade-in duration-200">
                      {/* Name & Image */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-medium mb-1.5 block">Token Name</label>
                          <Input
                            placeholder="My CABAL"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1.5 block">Image URL (Optional)</label>
                          <Input
                            placeholder="ipfs://... or https://..."
                            value={formData.image}
                            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* Governance */}
                      <div>
                        <h3 className="font-semibold mb-4 text-sm">Governance</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Quorum %</label>
                            <Input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.quorumPercent}
                              onChange={(e) => setFormData({ ...formData, quorumPercent: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Majority %</label>
                            <Input
                              type="number"
                              min="50"
                              max="100"
                              value={formData.majorityPercent}
                              onChange={(e) => setFormData({ ...formData, majorityPercent: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Voting Period (Blocks)</label>
                            <Input
                              type="number"
                              min="100"
                              value={formData.votingPeriod}
                              onChange={(e) => setFormData({ ...formData, votingPeriod: e.target.value })}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Proposal Threshold</label>
                            <Input
                              type="number"
                              min="0"
                              value={formData.proposalThreshold}
                              onChange={(e) => setFormData({ ...formData, proposalThreshold: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-semibold gap-2"
                  disabled={isPending || isConfirming || !formData.name || !formData.symbol}
                >
                  <Plus className="h-5 w-5" />
                  {isPending ? 'Confirming...' : isConfirming ? 'Creating...' : 'Create'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
