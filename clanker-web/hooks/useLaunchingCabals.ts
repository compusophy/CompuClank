"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { CABAL_ABI, CabalInfo, CabalPhase } from "@/lib/abi/cabal";
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config";

interface UseLaunchingCabalsReturn {
  launchingCabalIds: Set<string>;
  isLoading: boolean;
}

/**
 * Hook to detect which presale cabals are in "launching" state
 * (launchApprovedAt > 0, meaning vote threshold met and timer started)
 */
export function useLaunchingCabals(cabals: CabalInfo[]): UseLaunchingCabalsReturn {
  // Only need to check presale cabals
  const presaleCabals = useMemo(
    () => cabals.filter((c) => c.phase === CabalPhase.Presale),
    [cabals]
  );

  // Build contract calls to get launch vote status for each presale cabal
  const contracts = useMemo(() => {
    if (!presaleCabals.length || !CABAL_DIAMOND_ADDRESS) return [];

    const diamondAddress = CABAL_DIAMOND_ADDRESS;

    return presaleCabals.map((cabal) => ({
      address: diamondAddress,
      abi: CABAL_ABI,
      functionName: "getLaunchVoteStatus",
      args: [cabal.id] as const,
    }));
  }, [presaleCabals]);

  // Execute all reads
  const { data, isLoading } = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: contracts.length > 0,
    },
  });

  // Process results to find launching cabals
  const launchingCabalIds = useMemo(() => {
    const ids = new Set<string>();

    if (!data || !presaleCabals.length) {
      return ids;
    }

    presaleCabals.forEach((cabal, index) => {
      const result = data[index];
      if (result?.status === "success") {
        // getLaunchVoteStatus returns: [votesFor, votesAgainst, totalRaised, majorityRequired, majorityMet, launchApprovedAt, launchableAt]
        const launchApprovedAt = (result.result as any)[5] as bigint;
        if (launchApprovedAt > 0n) {
          ids.add(cabal.id.toString());
        }
      }
    });

    return ids;
  }, [data, presaleCabals]);

  return {
    launchingCabalIds,
    isLoading,
  };
}
