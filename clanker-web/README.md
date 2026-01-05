# CABAL Web

The frontend application for CABAL - a decentralized token launch and community coordination protocol.

## Features

- **Graph Explorer** - Interactive force-directed graph visualization of cabals using canvas rendering with D3 physics
- **Token Launch UI** - Create and finalize presale cabals
- **Staking & Trading** - Stake tokens for rewards, buy/sell via integrated Uniswap v4
- **Farcaster Integration** - Native mini app support with haptic feedback
- **Mobile-First** - Touch-optimized with radial menus and gesture support

## Tech Stack

- **Next.js 15** - React framework with App Router
- **Wagmi + Viem** - Ethereum wallet & contract interactions
- **RainbowKit** - Multi-wallet connection
- **Farcaster Mini App SDK** - Frame integration with haptics
- **react-force-graph-2d** - D3-based force simulation for graph visualization
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library

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
NEXT_PUBLIC_CABAL_DIAMOND_ADDRESS=0x...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main graph explorer view
│   ├── create/            # Cabal creation flow
│   ├── [id]/              # Individual cabal details
│   └── globals.css        # Global styles & color system
│
├── components/
│   ├── GraphExplorer.tsx  # Force-directed graph with radial menus
│   ├── CreateModal.tsx    # Cabal creation form
│   ├── TradeModal.tsx     # Buy/sell interface
│   ├── StakeModal.tsx     # Staking interface
│   ├── layout/            # Header, footer, CTAs
│   ├── ui/                # shadcn/ui components
│   └── wallet/            # Wallet connection
│
├── hooks/
│   ├── useHierarchicalCabals.ts  # Graph data structure
│   ├── useUserCabalPositions.ts  # User balances
│   └── useLaunchingCabals.ts     # Active presales
│
└── lib/
    ├── abi/               # Contract ABIs
    ├── wagmi-config.ts    # Chain & wallet config
    └── haptics.ts         # Haptic feedback utilities
```

## Design System

The app uses a golden color palette with RGB values for consistency across CSS and canvas:

| Color | RGB | Usage |
|-------|-----|-------|
| Primary Gold | `rgb(212, 146, 54)` | Main accents, buttons |
| Background | `rgb(18, 16, 14)` | Dark mode base |
| Card | `rgb(24, 22, 20)` | Elevated surfaces |
| Border | `rgba(212, 146, 54, 0.4)` | Borders, dividers |
| Muted | `rgb(55, 50, 45)` | Secondary backgrounds |

All animations use golden ratio (φ = 1.618) timing for sacred geometry aesthetics.

## Graph Explorer

The main view features an interactive force-directed graph:

- **Nodes** represent cabals with status indicators (presale/active/launching)
- **Tap/click** opens a radial menu with quick actions
- **Circle packing** - selected nodes expand to push others away
- **Touch-optimized** with haptic feedback on Farcaster

## License

MIT
