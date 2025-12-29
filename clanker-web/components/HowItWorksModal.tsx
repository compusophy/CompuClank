'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info, Users, Rocket, Vote, TrendingUp, Wallet, ArrowDown, Code, Sparkles, Gift, Coins } from 'lucide-react';
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
        <DialogTitle className="sr-only">How CABAL Works</DialogTitle>
        <div className={`${UI_CONSTANTS.spaceY} overflow-y-auto max-h-[70vh] no-scrollbar`}>
          {/* Title & Mode Toggle */}
          <div className="flex flex-col items-center gap-3">
            <h2 className="text-xl font-bold">How it works</h2>
            <ModeToggle isTechnical={isTechnical} onToggle={() => setIsTechnical(!isTechnical)} />
          </div>

          {/* Intro */}
          <p className="text-sm text-muted-foreground">
            {isTechnical 
              ? "CABALs use EIP-2535 Diamond Pattern for upgradeable contracts with ERC-6551 Token Bound Accounts as treasuries. Clanker deploys tokens and creates Uniswap V4 pools."
              : "Communities raise ETH, launch tokens fairly, and govern a shared treasury. Here's the lifecycle:"
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
                    <li>• CabalCreationFacet</li>
                    <li>• StakingFacet</li>
                    <li>• SwapFacet</li>
                    <li>• GovernanceFacet</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Frontend</p>
                  <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                    <li>• Next.js 15</li>
                    <li>• wagmi + viem</li>
                    <li>• Tailwind CSS</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <p className="font-medium">Integrations</p>
                  <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                    <li>• Clanker Factory</li>
                    <li>• Uniswap V4 Pools</li>
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
              description="Anyone can create a CABAL by choosing a ticker symbol."
              technicalDetails="createCabal() → mints CabalNFT (ERC-721) → creates TBA via ERC-6551 Registry"
              isTechnical={isTechnical}
            />
            
            <Step
              icon={<Wallet className="h-5 w-5 text-yellow-500" />}
              title="Presale Phase"
              description="Contributors send ETH to the CABAL. Each contribution is tracked for proportional token distribution later."
              technicalDetails="contribute() → ETH forwarded to TBA → contribution tracked in LibAppStorage"
              isTechnical={isTechnical}
              status="presale"
            />
            
            <Step
              icon={<Rocket className="h-5 w-5" />}
              title="Vote & Launch"
              description="Contributors vote to launch. When 51% vote YES, a 24hr timer starts. After timer, first claim auto-launches. Split: 1% protocol fee, 33% ETH + 33% tokens to treasury, 33% tokens to contributors."
              technicalDetails="voteLaunch() → 51% threshold → 24hr timer → claimTokens() triggers _finalizeCabal() → 1% to protocol → Clanker deploys token"
              isTechnical={isTechnical}
            />
            
            <Step
              icon={<Gift className="h-5 w-5" />}
              title="Auto-Staked Voting Power"
              description="Your 33% token share is auto-staked for voting power. Claim to unstake and withdraw tokens to your wallet."
              technicalDetails="totalStaked = contributorTokens → votingPower includes unclaimed contribution share → claimTokens() reduces totalStaked"
              isTechnical={isTechnical}
            />
            
            <Step
              icon={<TrendingUp className="h-5 w-5 text-green-500" />}
              title="Active Trading"
              description="Anyone can buy and sell tokens. LP fees from Uniswap V4 are collected by the CABAL treasury."
              technicalDetails="SwapFacet wraps Universal Router → LP fees routed to TBA via Clanker's locker"
              isTechnical={isTechnical}
              status="active"
            />
            
            <Step
              icon={<Coins className="h-5 w-5" />}
              title="Stake for Rewards"
              description="Stake tokens to earn a share of the trading fees that flow to the treasury."
              technicalDetails="StakingFacet.stake() → tracks staked balance → rewards distributed proportionally"
              isTechnical={isTechnical}
              status="active"
            />
            
            <Step
              icon={<Vote className="h-5 w-5" />}
              title="Govern Treasury"
              description="Staked token holders can vote on proposals and delegate voting power to others."
              technicalDetails="GovernanceFacet → DelegationFacet → TBA executes via IERC6551Executable"
              isTechnical={isTechnical}
              status="active"
              isLast
            />
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {isTechnical 
                ? "Base L2 • Solidity 0.8.20 • Hardhat • Clanker SDK"
                : "Built on Base with Clanker & Uniswap V4"
              }
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
