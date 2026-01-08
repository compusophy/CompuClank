'use client';

import { useState } from 'react';
import { Users, Rocket, Vote, TrendingUp, Wallet, ArrowDown, Code, Sparkles, Gift, GitBranch, UserPlus, Info } from 'lucide-react';
import { UI_CONSTANTS } from '@/lib/utils';

interface StepProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  technicalDetails?: string;
  isTechnical: boolean;
  status?: 'presale' | 'active' | 'governance';
  isLast?: boolean;
}

function Step({ icon, title, description, technicalDetails, isTechnical, status, isLast }: StepProps) {
  const statusStyles = status === 'presale' 
    ? 'border-yellow-500/50 bg-yellow-500/5' 
    : status === 'active' 
    ? 'border-green-500/50 bg-green-500/5' 
    : status === 'governance'
    ? 'border-purple-500/50 bg-purple-500/5'
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
                  : status === 'active'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
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

// Inline view for tab navigation
export function HowItWorksView() {
  const [isTechnical, setIsTechnical] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">How CABAL Works</h2>
        </div>
        <ModeToggle isTechnical={isTechnical} onToggle={() => setIsTechnical(!isTechnical)} />
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto px-4 py-4 ${UI_CONSTANTS.spaceY}`}>
        {/* Intro */}
        <p className="text-sm text-muted-foreground">
          {isTechnical 
            ? "CABALs use EIP-2535 Diamond Pattern with ERC-6551 Token Bound Accounts. Clanker deploys tokens with Uniswap V4 pools. Hierarchical naming: C0 → C01 → C011."
            : "A fractal governance system where communities raise ETH, launch tokens, and spawn child communities in an unlimited hierarchy."
          }
        </p>

        {/* Technical Architecture Overview */}
        {isTechnical && (
          <div className="bg-muted/30 rounded-lg p-3 border border-dashed space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Architecture</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <p className="font-medium">Diamond Facets</p>
                <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                  <li>• CabalCreationFacet</li>
                  <li>• ChildCreationFacet</li>
                  <li>• StakingFacet</li>
                  <li>• GovernanceFacet</li>
                  <li>• DelegationFacet</li>
                  <li>• SwapFacet</li>
                </ul>
              </div>
              <div className="space-y-1">
                <p className="font-medium">Constraints</p>
                <ul className="text-muted-foreground space-y-0.5 font-mono text-[11px]">
                  <li>• 8 children max/CABAL</li>
                  <li>• 51% vote threshold</li>
                  <li>• 10 min gov delay</li>
                  <li>• 1% protocol fee</li>
                  <li>• 1%/ancestor fee</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Hierarchical Naming */}
        <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Hierarchical Naming</h4>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-1 bg-background rounded">C0</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 bg-background rounded">C01</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 bg-background rounded">C011</span>
            <span className="text-muted-foreground">...</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Each CABAL can have up to 8 children. Names encode ancestry.
          </p>
        </div>

        {/* Flow */}
        <div className="py-2">
          <Step
            icon={<Users className="h-5 w-5" />}
            title="Create CABAL"
            description="Anyone can create the genesis CABAL (C0). Child CABALs are created via governance vote."
            technicalDetails="createChildCabal() via TBA.executeCall() → mints CabalNFT → creates ERC-6551 TBA"
            isTechnical={isTechnical}
          />
          
          <Step
            icon={<Wallet className="h-5 w-5 text-yellow-500" />}
            title="Presale Phase"
            description="Contributors send ETH to the CABAL. Contributions are tracked for proportional token distribution."
            technicalDetails="contribute() → ETH to TBA → LibAppStorage.setContribution()"
            isTechnical={isTechnical}
            status="presale"
          />
          
          <Step
            icon={<Rocket className="h-5 w-5" />}
            title="Vote & Launch"
            description="51% of contributors must vote YES. After 10 min timer, anyone can finalize. Fees: 1% protocol + 1%/ancestor."
            technicalDetails="voteLaunch() → 51% → finalizeCabal() → Clanker.deploy() → auto-stake tokens"
            isTechnical={isTechnical}
          />
          
          <Step
            icon={<Gift className="h-5 w-5" />}
            title="Auto-Staked Tokens"
            description="Your tokens are auto-staked with voting power. Unstake to withdraw to wallet. 10 min governance delay after launch."
            technicalDetails="setStakedBalance() per contributor → unstake() → governanceStartsAt = launchedAt + 10min"
            isTechnical={isTechnical}
          />
          
          <Step
            icon={<TrendingUp className="h-5 w-5 text-green-500" />}
            title="Trade & Earn"
            description="Buy and sell tokens. 1% trading fee via Clanker locker flows to treasury (1% per ancestor)."
            technicalDetails="SwapFacet → Universal Router → Clanker locker fees → TBA.claimLPFees()"
            isTechnical={isTechnical}
            status="active"
          />
          
          <Step
            icon={<GitBranch className="h-5 w-5 text-purple-500" />}
            title="Create Child CABALs"
            description="Stakers vote to spawn children (max 8). Parent treasury funds the child's presale. Names are hierarchical."
            technicalDetails="voteCreateChild() → 51% → finalizeChildCreation() → name = parent.name + childIndex"
            isTechnical={isTechnical}
            status="governance"
          />
          
          <Step
            icon={<Vote className="h-5 w-5" />}
            title="Full Governance"
            description="CABALs can propose to: buy/sell tokens, stake in other CABALs, vote in other governance, delegate power."
            technicalDetails="proposeBuyTokens(), proposeSellTokens(), proposeStake(), proposeVote(), proposeDelegate()"
            isTechnical={isTechnical}
            status="governance"
          />
          
          <Step
            icon={<UserPlus className="h-5 w-5" />}
            title="Delegation"
            description="Delegate your voting power to trusted community members or other CABAL TBAs."
            technicalDetails="DelegationFacet.delegate() → delegatedPower tracked → affects getVotingPower()"
            isTechnical={isTechnical}
            status="governance"
            isLast
          />
        </div>

        {/* Fee Breakdown */}
        <div className="bg-muted/30 rounded-lg p-3 border space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fee Distribution on Launch</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Protocol (C0)</span>
              <span className="font-mono">1%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Per Ancestor</span>
              <span className="font-mono">1% each</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Treasury ETH</span>
              <span className="font-mono">50%*</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dev Buy → Stakers</span>
              <span className="font-mono">50%*</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">*of remaining after protocol + ancestor fees</p>
        </div>

        {/* Footer note */}
        <div className="text-center pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {isTechnical 
              ? "Base L2 • Solidity 0.8.20 • Diamond (EIP-2535) • TBA (ERC-6551)"
              : "Built on Base with Clanker & Uniswap V4"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
