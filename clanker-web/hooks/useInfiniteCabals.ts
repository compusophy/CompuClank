"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useReadContract } from "wagmi";
import { CABAL_ABI, CabalInfo } from "@/lib/abi/cabal";
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config";

const PAGE_SIZE = 12; // Load 12 cabals at a time

interface UseInfiniteCabalsReturn {
  cabals: CabalInfo[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  total: number;
  loadMore: () => void;
  refresh: () => void;
  /** Ref to attach to a sentinel element for auto-loading */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function useInfiniteCabals(): UseInfiniteCabalsReturn {
  const [cabals, setCabals] = useState<CabalInfo[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch current page
  const { data, isLoading, refetch } = useReadContract({
    address: CABAL_DIAMOND_ADDRESS,
    abi: CABAL_ABI,
    functionName: "getCabalsPaginated",
    args: [BigInt(offset), BigInt(PAGE_SIZE)],
    query: {
      enabled: !!CABAL_DIAMOND_ADDRESS,
    },
  });

  // Process fetched data
  useEffect(() => {
    if (data) {
      const [fetchedCabals, total] = data as [CabalInfo[], bigint];
      
      if (offset === 0) {
        // First page - replace all
        setCabals(fetchedCabals);
      } else {
        // Subsequent pages - append, avoiding duplicates
        setCabals((prev) => {
          const existingIds = new Set(prev.map((c) => c.id.toString()));
          const newCabals = fetchedCabals.filter(
            (c) => !existingIds.has(c.id.toString())
          );
          return [...prev, ...newCabals];
        });
      }

      // Check if there are more cabals to load
      const loadedCount = offset + fetchedCabals.length;
      setHasMore(loadedCount < Number(total));
      setIsLoadingMore(false);
    }
  }, [data, offset]);

  // Load more cabals
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || isLoadingMore) return;
    setIsLoadingMore(true);
    setOffset((prev) => prev + PAGE_SIZE);
  }, [hasMore, isLoading, isLoadingMore]);

  // Refresh from the beginning
  const refresh = useCallback(() => {
    setOffset(0);
    setHasMore(true);
    setCabals([]);
    refetch();
  }, [refetch]);

  // Intersection Observer for auto-loading
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // When sentinel is visible and we have more to load
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMore();
        }
      },
      {
        rootMargin: "200px", // Start loading before user reaches the bottom
        threshold: 0,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  // Get total from data
  const total = data ? Number((data as [CabalInfo[], bigint])[1]) : 0;

  return {
    cabals,
    isLoading: isLoading && offset === 0,
    isLoadingMore,
    hasMore,
    total,
    loadMore,
    refresh,
    sentinelRef,
  };
}
