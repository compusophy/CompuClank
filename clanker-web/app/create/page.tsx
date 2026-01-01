'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { toast } from 'sonner';
import { WalletButton } from '@/components/wallet/WalletButton';
import { SettingsModal } from '@/components/SettingsModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { CABAL_ABI } from '@/lib/abi/cabal';
import { CABAL_DIAMOND_ADDRESS } from '@/lib/wagmi-config';
import { ArrowLeft, Plus, Wallet, Loader2 } from 'lucide-react';
import { parseEther } from 'viem';

const MIN_CREATION_FEE = '0.001'; // Must match contract MIN_CREATION_FEE

export default function CreateCabalPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const { writeContract, data: hash, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
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

  useEffect(() => {
    if (isSuccess) {
      toast.success('CABAL created successfully!');
      router.push('/');
    }
  }, [isSuccess, router]);

  const isLoading = isPending || isConfirming;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="page-container">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <span className="text-xl font-bold tracking-tight">Create</span>
            </div>
            <div className="flex items-center gap-3">
              <WalletButton />
              <SettingsModal />
            </div>
          </div>
        </div>
      </header>

      <main className="page-container py-8 max-w-lg mx-auto">
        {!isConnected ? (
          <Card className="p-12 text-center border-dashed">
            <div className="space-y-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl mb-2">Connect Wallet</CardTitle>
                <CardDescription className="mb-6">
                  Connect your wallet to create a CABAL.
                </CardDescription>
                <WalletButton />
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <Button
                  size="lg"
                  className="w-full h-12 text-lg font-semibold gap-2"
                  disabled={isLoading}
                  onClick={handleCreate}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                  {isPending ? 'CONFIRM...' : isConfirming ? 'CREATING...' : 'CREATE'}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
