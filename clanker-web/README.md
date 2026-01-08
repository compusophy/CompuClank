# CABAL Web

The frontend application for **CABAL** - a hierarchical, composable DAO framework where communities create treasuries, launch tokens, and govern resources collectively.

## What is CABAL?

CABAL is a fractal governance system where:
- **Communities** raise ETH during presale, then launch tokens via Clanker
- **Treasuries** are Token Bound Accounts (ERC-6551) that hold ETH and tokens
- **Governance** allows stakers to vote on proposals and execute treasury actions
- **Hierarchy** - CABALs can create child CABALs, forming a tree of communities

### Hierarchical Naming

New CABALs follow a hierarchical naming scheme:
- Genesis: `C0` (symbol: `$C0`)
- Children of C0: `C01`, `C02`, ... `C08` (max 8 children per CABAL)
- Grandchildren: `C011`, `C012`, ... (children of C01)

This creates an unlimited-depth tree of communities, each with its own treasury and governance.

## Features

### Core Protocol
- **Presale & Launch** - Raise ETH, vote to launch, auto-distribute tokens
- **Staking & Governance** - Stake tokens for voting power, create proposals
- **Child CABALs** - Spawn child communities (8 max per parent)
- **Treasury Management** - ETH + token treasury with governance control

### Governance Actions
CABALs can propose to:
- **Create Child** - Spawn a new child CABAL
- **Buy/Sell Tokens** - Trade other CABAL tokens from treasury
- **Stake/Unstake** - Stake in other CABALs for voting power
- **Vote** - Vote in other CABALs' governance proposals
- **Delegate** - Delegate voting power to other addresses
- **Dissolve** - Wind down a child CABAL

### UI/UX
- **Graph Explorer** - Interactive force-directed graph with sacred geometry animations
- **Radial Menus** - Touch-optimized action menus with golden ratio spacing
- **Transaction Guard** - Prevents double-transactions, shows global status
- **Farcaster Native** - Mini app with haptic feedback

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Contracts | Wagmi + Viem |
| Wallet | RainbowKit + Farcaster Auth |
| Graph | react-force-graph-2d (D3) |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Custom easing with golden ratio |

## Smart Contract Architecture

```
Diamond Proxy (EIP-2535)
├── CabalCreationFacet    # Create cabals, presale, launch
├── ChildCreationFacet    # Child cabal voting & creation (8 max)
├── StakingFacet          # Stake/unstake tokens
├── GovernanceFacet       # Proposals & voting
├── DelegationFacet       # Voting power delegation
├── SwapFacet             # Buy/sell via Universal Router
├── TreasuryFacet         # Claim LP fees, manage assets
├── DissolutionFacet      # Wind down cabals
└── ViewFacet             # Read-only queries

Supporting Contracts
├── CabalNFT (ERC-721)    # Each CABAL is an NFT
├── CabalTBA (ERC-6551)   # Token Bound Account treasury
└── Clanker Factory       # Deploys tokens + Uniswap V4 pools
```

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CABAL_DIAMOND_ADDRESS=0xaEEc898Fcf7c66D7C4573C174ce529Df96d842e9
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main graph explorer view
│   ├── [id]/              # Individual cabal details
│   └── layout.tsx         # Providers & global layout
│
├── components/
│   ├── GraphExplorer.tsx  # Force-directed graph (~2600 lines)
│   ├── GovernanceActionModal.tsx  # Multi-action proposal creator
│   ├── TransactionStatus.tsx      # Global tx indicator
│   ├── HowItWorksModal.tsx        # Onboarding modal
│   ├── graph/             # Graph sub-components
│   ├── ui/                # shadcn/ui components
│   └── wallet/            # Wallet connection
│
├── hooks/
│   ├── useHierarchicalCabals.ts  # Graph data structure
│   └── useLaunchingCabals.ts     # Active presales
│
└── lib/
    ├── abi/               # Contract ABIs
    ├── graph-helpers.ts   # Distance calculations for graph
    ├── graph-constants.ts # Golden ratio, colors
    ├── transaction-context.tsx  # Global tx state
    ├── wagmi-config.ts    # Chain & wallet config
    └── haptics.ts         # Haptic feedback utilities
```

## Design System

### Color Palette (RGB for Canvas Compatibility)

| Color | RGB | Usage |
|-------|-----|-------|
| Primary Gold | `rgb(212, 146, 54)` | Main accents, buttons |
| Background | `rgb(18, 16, 14)` | Dark mode base |
| Card | `rgb(24, 22, 20)` | Elevated surfaces |
| Border | `rgba(212, 146, 54, 0.4)` | Borders, dividers |

### Sacred Geometry

- **Golden Ratio (φ = 1.618)** - Node sizing, animation timing
- **Inverse Golden Ratio (φ⁻¹ = 0.618)** - Child node scaling
- **easeOutCubic** - Natural motion easing

## Graph Explorer

The main view features an interactive hierarchical graph:

- **Focused Node** - Centered, standard size (55px)
- **Ancestors** - Scale UP by φⁿ (parent 1.618x, grandparent 2.618x)
- **Descendants** - Scale DOWN by φ⁻ⁿ (children 0.618x, grandchildren 0.382x)
- **Siblings** - Same size as focused (peer nodes)

### Radial Menus

Tap a node to open context-sensitive panels:

**Presale Phase (3 panels, 120° apart):**
- TOP: Raised amount
- BOTTOM-LEFT: Contribute ETH
- BOTTOM-RIGHT: Vote to launch

**Active Phase (4 panels, 90° apart):**
- TOP: Treasury balance
- LEFT: Trade (buy/sell)
- RIGHT: Governance actions
- BOTTOM: Stake/unstake

## Fee Structure

When a CABAL launches:
- **1% Protocol Fee** → Genesis CABAL (C0)
- **1% per Ancestor** → Each parent in the chain
- **33% to Treasury** → Stays as ETH in TBA
- **67% Dev Buy** → Buys tokens, auto-staked to contributors

Trading fees (1% via Clanker):
- Collected by Clanker locker
- Claimable to CABAL treasury

## License

MIT
