'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi-config';
import { FarcasterProvider } from './FarcasterProvider';

// Configure QueryClient with sensible defaults to reduce RPC spam
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 30 seconds - won't refetch during this time
      staleTime: 30_000,
      // Keep cached data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Don't refetch on window focus (causes RPC spam)
      refetchOnWindowFocus: false,
      // Don't refetch when reconnecting
      refetchOnReconnect: false,
      // Retry failed requests only once
      retry: 1,
    },
  },
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <FarcasterProvider>
          {children}
        </FarcasterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
