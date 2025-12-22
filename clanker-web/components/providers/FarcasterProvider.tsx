'use client';

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { useConnect, useAccount } from 'wagmi';

type FarcasterContextType = {
  isInMiniApp: boolean;
  isReady: boolean;
  context: typeof sdk.context | null;
};

const FarcasterContext = createContext<FarcasterContextType>({
  isInMiniApp: false,
  isReady: false,
  context: null,
});

export function useFarcaster() {
  return useContext(FarcasterContext);
}

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<typeof sdk.context | null>(null);
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  // Auto-connect to Farcaster wallet when in Mini App context
  const autoConnect = useCallback(() => {
    if (!isConnected) {
      // Find the Farcaster Mini App connector
      const farcasterConnector = connectors.find(
        (c) => c.id === 'farcasterMiniApp' || c.name?.toLowerCase().includes('farcaster')
      );
      if (farcasterConnector) {
        connect({ connector: farcasterConnector });
      }
    }
  }, [isConnected, connectors, connect]);

  useEffect(() => {
    const initFarcaster = async () => {
      try {
        // Check if we're in a Mini App context
        const inMiniApp = await sdk.isInMiniApp();
        setIsInMiniApp(inMiniApp);

        if (inMiniApp) {
          // Get the context which has user info, etc.
          setContext(sdk.context);

          // Auto-connect the embedded wallet
          autoConnect();

          // Tell Farcaster we're ready to display (hides splash screen)
          await sdk.actions.ready();
          setIsReady(true);

          // Enable back navigation for web-based navigation
          try {
            await sdk.back.enableWebNavigation();
          } catch {
            // Back navigation might not be available in all contexts
          }
        } else {
          // Not in Mini App, just mark as ready
          setIsReady(true);
        }
      } catch (error) {
        console.error('Error initializing Farcaster SDK:', error);
        // Even on error, mark as ready so the app can still function
        setIsReady(true);
      }
    };

    initFarcaster();
  }, [autoConnect]);

  return (
    <FarcasterContext.Provider value={{ isInMiniApp, isReady, context }}>
      {children}
    </FarcasterContext.Provider>
  );
}
