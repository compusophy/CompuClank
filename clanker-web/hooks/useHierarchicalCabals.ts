"use client";

import { useMemo } from "react";
import { useReadContract } from "wagmi";
import { CABAL_ABI, CabalInfo } from "@/lib/abi/cabal";
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config";

interface UseHierarchicalCabalsReturn {
  cabals: CabalInfo[];
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Hook to fetch only hierarchical cabals (CABAL0 and its descendants).
 * Excludes legacy cabals that were created before the fractal DAO update.
 */
export function useHierarchicalCabals(): UseHierarchicalCabalsReturn {
  // Get hierarchical cabal IDs only (CABAL0 and descendants)
  const { 
    data: hierarchicalIds, 
    isLoading: isLoadingIds,
    refetch: refetchIds 
  } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getHierarchicalCabalIds",
    query: {
      enabled: !!CABAL_DIAMOND_ADDRESS,
    },
  });

  // Get full info for hierarchical cabals
  const { 
    data: cabalsData, 
    isLoading: isLoadingCabals,
    refetch: refetchCabals 
  } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabals",
    args: hierarchicalIds ? [hierarchicalIds as readonly bigint[]] : undefined,
    query: {
      enabled: !!hierarchicalIds && (hierarchicalIds as readonly bigint[]).length > 0,
    },
  });

  // Sort cabals by ID descending (newest first)
  const sortedCabals = useMemo(() => {
    if (!cabalsData) return [];
    const cabals = [...(cabalsData as CabalInfo[])];
    cabals.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
    return cabals;
  }, [cabalsData]);

  const refresh = () => {
    refetchIds();
    refetchCabals();
  };

  return {
    cabals: sortedCabals,
    isLoading: isLoadingIds || isLoadingCabals,
    refresh,
  };
}
