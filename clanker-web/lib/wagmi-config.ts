import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'CABAL',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id',
  chains: [base],
  ssr: true,
});

// Contract addresses (set after deployment)
export const CABAL_DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_CABAL_DIAMOND_ADDRESS as `0x${string}` | undefined;
