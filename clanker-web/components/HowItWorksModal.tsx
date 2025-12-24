'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info, Users, Rocket, Vote, TrendingUp, Wallet, ArrowDown, Code, Sparkles } from 'lucide-react';
import { UI_CONSTANTS } from '@/lib/utils';

interface StepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  technicalDetails?: string;
  isTechnical: boolean;
  status?: 'presale' | 'active';
  isLast?: boolean;
}

function Step({ icon, title, description, technicalDetails, isTechnical, status, isLast }: StepProps) {
  const statusStyles = status === 'presale' 
    ? 'border-yellow-500/50 bg-yellow-500/5' 
    : status === 'active' 
    ? 'border-green-500/50 bg-green-500/5' 
    : 'border-border';

  return (
    <div className="flex flex-col items-center">
      <div className={`relative flex items-center gap-3.5 p-3.5 rounded-xl border ${statusStyles} w-full`}>
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            {status && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                status === 'presale' 
                  ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' 
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
              }`}>
                {status}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {isTechnical && technicalDetails && (
            <p className="text-xs text-primary/80 mt-1.5 font-mono bg-primary/5 px-2 py-1 rounded">
              {technicalDetails}
            </p>
          )}
        </div>
      </div>
      {!isLast && (
        <div className="py-2">
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function ModeToggle({ isTechnical, onToggle }: { isTechnical: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-full w-fit">
      <button
        onClick={() => !isTechnical || onToggle()}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
          !isTechnical
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Simple
      </button>
      <button
        onClick={() => isTechnical || onToggle()}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
          isTechnical
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Code className="h-3.5 w-3.5" />
        Technical
      </button>
    </div>
  );
}

export function HowItWorksModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTechnical, setIsTechnical] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Info className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <div className={`${UI_CONSTANTS.spaceY} overflow-y-auto max-h-[70vh] no-scrollbar`}>
          {/* Title & Mode Toggle */}
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-xl font-bold">How it works</h2>
            <ModeToggle isTechnical={isTechnical} onToggle={() => setIsTechnical(!isTechnical)} />
          </div>

          {/* Intro */}
          <p className="text-sm text-muted-foreground">
            {isTechnical 
              ? "CABALs use EIP-2535 Diamond Pattern for upgradeable smart contracts with ERC-6551 Token Bound Accounts as treasuries."
              : "CABALs are decentralized group wallets with governance tokens. Here's the lifecycle:"
            }
          </p>

          {/* Technical Architecture Overview */}
          {isTechnical && (
            <div className="bg-muted/30 rounded-lg p-3 border border-dashed space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Architecture Stack</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <p className="font-medium">Smart Contracts</p>
                  <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                    <li>• Diamond (EIP-2535)</li>
                    <li>• CabalNFT (ERC-721)</li>
                    <li>• CabalTBA (ERC-6551)</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Diamond Facets</p>
                  <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                    <li>• GovernanceFacet</li>
                    <li>• StakingFacet</li>
                    <li>• TreasuryFacet</li>
                    <li>• SwapFacet</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Frontend</p>
                  <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                    <li>• Next.js 14</li>
                    <li>• wagmi + viem</li>
                    <li>• TailwindCSS</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Integrations</p>
                  <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                    <li>• Clanker Factory</li>
                    <li>• Uniswap V4 Hooks</li>
                    <li>• Universal Router</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Flow */}
          <div className="py-2">
            <Step
              icon={<Users className="h-5 w-5" />}
              title="Create CABAL"
              description="Anyone can create a CABAL by choosing a ticker symbol and governance settings."
              technicalDetails="CabalCreationFacet.createCabal() → mints ERC-721 NFT → deploys ERC-6551 TBA via Registry"
              isTechnical={isTechnical}
            />
            
            <Step
              icon={<Wallet className="h-5 w-5 text-yellow-500" />}
              title="Presale Phase"
              description="Contributors send ETH to the CABAL. Each contributor's share is tracked for token distribution."
              technicalDetails="TreasuryFacet.contribute() → LibAppStorage tracks shares → ETH held in Diamond"
              isTechnical={isTechnical}
              status="presale"
            />
            
            <Step
              icon={<Rocket className="h-5 w-5" />}
              title="Finalize & Launch"
              description="Once ready, anyone can finalize. This deploys the token via Clanker and creates a Uniswap V4 pool."
              technicalDetails="CabalCreationFacet.finalize() → IClankerFactory.deploy() → V4 pool with hook → LP to TBA"
              isTechnical={isTechnical}
            />
            
            <Step
              icon={<TrendingUp className="h-5 w-5 text-green-500" />}
              title="Active Trading"
              description="Token holders can buy, sell, and trade. The CABAL treasury collects trading fees."
              technicalDetails="SwapFacet wraps Uniswap Universal Router → PERMIT2 for approvals → fees to TBA"
              isTechnical={isTechnical}
              status="active"
            />
            
            <Step
              icon={<Vote className="h-5 w-5" />}
              title="Stake & Govern"
              description="Stake tokens to gain voting power. Propose and vote on treasury actions."
              technicalDetails="StakingFacet.stake() → voting power in GovernanceFacet → TBA executes via IERC6551Executable"
              isTechnical={isTechnical}
              status="active"
              isLast
            />
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {isTechnical 
                ? "Deployed on Base L2 • Solidity 0.8.x • Hardhat • TypeChain"
                : "Built on Base with Clanker & Uniswap V4"
              }
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
