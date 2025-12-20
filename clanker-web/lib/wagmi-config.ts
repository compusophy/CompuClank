import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'CABAL' }),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});

// Contract addresses (set after deployment)
export const CABAL_DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_CABAL_DIAMOND_ADDRESS as `0x${string}` | undefined;
