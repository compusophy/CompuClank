import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

if (typeof window !== 'undefined') {
  if (!rpcUrl) {
    console.warn('⚠️ NEXT_PUBLIC_RPC_URL is not set. Using default public RPC (rate-limited).');
  } else {
    console.log('✅ Using custom RPC:', rpcUrl.includes('base.org') ? 'Base Public' : 'Custom Provider');
  }
}

export const config = createConfig({
  chains: [base],
  connectors: [
    // Farcaster Mini App connector - provides embedded wallet in Farcaster context
    // This connector automatically detects when running inside Farcaster and
    // announces via EIP-1193, so users are already connected without needing to click
    farcasterMiniApp(),
    injected(),
    coinbaseWallet({ appName: 'CABAL' }),
  ],
  transports: {
    [base.id]: http(rpcUrl, {
      // Disable block polling - reduces RPC calls dramatically
      // We manually refetch when needed (after transactions)
      batch: { batchSize: 100 },
    }),
  },
  // Disable global polling - reduces RPC spam from ~1/sec to only on-demand
  pollingInterval: 60_000, // Poll every 60s instead of default 4s
  ssr: true,
});

// Contract addresses (set after deployment)
export const CABAL_DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_CABAL_DIAMOND_ADDRESS as `0x${string}` | undefined;
