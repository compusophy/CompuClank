"use client";

import { useMemo } from "react";
import { useReadContracts, useAccount } from "wagmi";
import { erc20Abi } from "viem";
import { CABAL_ABI, CabalInfo, CabalPhase } from "@/lib/abi/cabal";
import { CABAL_DIAMOND_ADDRESS } from "@/lib/wagmi-config";

export interface UserCabalPosition {
  cabalId: bigint;
  isCreator: boolean;
  stakedBalance: bigint;
  tokenBalance: bigint;
  contribution: bigint;
  isOwned: boolean; // true if user has any position
}

interface UseUserCabalPositionsReturn {
  positions: Map<string, UserCabalPosition>;
  isLoading: boolean;
  ownedCabalIds: Set<string>;
}

export function useUserCabalPositions(cabals: CabalInfo[]): UseUserCabalPositionsReturn {
  const { address } = useAccount();

  // Build the contract calls for each cabal
  const contracts = useMemo(() => {
    if (!address || !cabals.length || !CABAL_DIAMOND_ADDRESS) return [];

    // Store in local const for TypeScript narrowing
    const diamondAddress = CABAL_DIAMOND_ADDRESS;

    const calls: {
      address: `0x${string}`;
      abi: typeof CABAL_ABI | typeof erc20Abi;
      functionName: string;
      args: readonly unknown[];
    }[] = [];

    cabals.forEach((cabal) => {
      // Get staked balance (for active cabals)
      if (cabal.phase === CabalPhase.Active) {
        calls.push({
          address: diamondAddress,
          abi: CABAL_ABI,
          functionName: "getStakedBalance",
          args: [cabal.id, address] as const,
        });
      } else {
        // Placeholder for presale cabals (no staking)
        calls.push({
          address: diamondAddress,
          abi: CABAL_ABI,
          functionName: "getContribution", // Will be overwritten, just needs valid call
          args: [cabal.id, address] as const,
        });
      }

      // Get contribution (for all cabals, useful for presale)
      calls.push({
        address: diamondAddress,
        abi: CABAL_ABI,
        functionName: "getContribution",
        args: [cabal.id, address] as const,
      });

      // Get token balance (for active cabals with token address)
      if (cabal.phase === CabalPhase.Active && cabal.tokenAddress !== "0x0000000000000000000000000000000000000000") {
        calls.push({
          address: cabal.tokenAddress,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address] as const,
        });
      } else {
        // Placeholder - use contribution call for presale
        calls.push({
          address: diamondAddress,
          abi: CABAL_ABI,
          functionName: "getContribution",
          args: [cabal.id, address] as const,
        });
      }
    });

    return calls;
  }, [address, cabals]);

  // Execute all reads in a single multicall
  const { data, isLoading } = useReadContracts({
    contracts: contracts as any,
    query: {
      enabled: !!address && contracts.length > 0,
    },
  });

  // Process results into a map
  const { positions, ownedCabalIds } = useMemo(() => {
    const positionMap = new Map<string, UserCabalPosition>();
    const ownedIds = new Set<string>();

    if (!address || !data || !cabals.length) {
      return { positions: positionMap, ownedCabalIds: ownedIds };
    }

    cabals.forEach((cabal, index) => {
      const baseIndex = index * 3; // 3 calls per cabal
      
      const stakedResult = data[baseIndex];
      const contributionResult = data[baseIndex + 1];
      const tokenBalanceResult = data[baseIndex + 2];

      const stakedBalance = cabal.phase === CabalPhase.Active && stakedResult?.status === "success" 
        ? (stakedResult.result as bigint) 
        : 0n;
      
      const contribution = contributionResult?.status === "success" 
        ? (contributionResult.result as bigint) 
        : 0n;
      
      const tokenBalance = cabal.phase === CabalPhase.Active && tokenBalanceResult?.status === "success" 
        ? (tokenBalanceResult.result as bigint) 
        : 0n;

      const isCreator = cabal.creator.toLowerCase() === address.toLowerCase();
      
      // User "owns" a cabal if they:
      // - Created it
      // - Have staked tokens
      // - Hold the token
      // - Contributed to presale
      const isOwned = isCreator || stakedBalance > 0n || tokenBalance > 0n || contribution > 0n;

      const position: UserCabalPosition = {
        cabalId: cabal.id,
        isCreator,
        stakedBalance,
        tokenBalance,
        contribution,
        isOwned,
      };

      positionMap.set(cabal.id.toString(), position);
      
      if (isOwned) {
        ownedIds.add(cabal.id.toString());
      }
    });

    return { positions: positionMap, ownedCabalIds: ownedIds };
  }, [address, data, cabals]);

  return {
    positions,
    isLoading,
    ownedCabalIds,
  };
}
