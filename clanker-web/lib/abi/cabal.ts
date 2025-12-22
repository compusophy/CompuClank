// CABAL Diamond ABI - Combined from all facets
// This is a simplified ABI for frontend use

export const CABAL_ABI = [
  // ============ CabalCreationFacet ============
  {
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "image", type: "string" },
      {
        name: "settings",
        type: "tuple",
        components: [
          { name: "votingPeriod", type: "uint256" },
          { name: "quorumBps", type: "uint256" },
          { name: "majorityBps", type: "uint256" },
          { name: "proposalThreshold", type: "uint256" },
        ],
      },
    ],
    name: "createCabal",
    outputs: [{ name: "cabalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "contribute",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "finalizeCabal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "claimTokens",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ StakingFacet ============
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    name: "stakeWithPermit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ DelegationFacet ============
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "delegatee", type: "address" },
    ],
    name: "delegate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "undelegate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ GovernanceFacet ============
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
    ],
    name: "createProposal",
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
    ],
    name: "executeProposal",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ TreasuryFacet ============
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "token", type: "address" },
    ],
    name: "claimLPFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ ViewFacet ============
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getCabal",
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "image", type: "string" },
          { name: "tbaAddress", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "phase", type: "uint8" },
          { name: "totalRaised", type: "uint256" },
          { name: "totalTokensReceived", type: "uint256" },
          { name: "totalStaked", type: "uint256" },
          { name: "contributorCount", type: "uint256" },
          {
            name: "settings",
            type: "tuple",
            components: [
              { name: "votingPeriod", type: "uint256" },
              { name: "quorumBps", type: "uint256" },
              { name: "majorityBps", type: "uint256" },
              { name: "proposalThreshold", type: "uint256" },
            ],
          },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllCabals",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalCabals",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "creator", type: "address" }],
    name: "getCabalsByCreator",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "getContribution",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "getStakedBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "getVotingPower",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getTreasuryETHBalance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "getClaimable",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getContributors",
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "hasClaimed",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ============ SettingsFacet (Admin) ============
  {
    inputs: [
      { name: "clankerHook", type: "address" },
      { name: "clankerLocker", type: "address" },
      { name: "clankerMevModule", type: "address" },
      { name: "clankerDevBuyExtension", type: "address" },
    ],
    name: "initializeClankerAddresses",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getClankerAddresses",
    outputs: [
      { name: "clankerHook", type: "address" },
      { name: "clankerLocker", type: "address" },
      { name: "clankerMevModule", type: "address" },
      { name: "clankerDevBuyExtension", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getContractAddresses",
    outputs: [
      { name: "cabalNFT", type: "address" },
      { name: "tbaImplementation", type: "address" },
      { name: "erc6551Registry", type: "address" },
      { name: "clankerFactory", type: "address" },
      { name: "clankerFeeLocker", type: "address" },
      { name: "weth", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ============ SwapFacet ============
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
    ],
    name: "buyTokens",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
    name: "buyTokensWithHookData",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "tokenAmount", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
    ],
    name: "sellTokens",
    outputs: [{ name: "ethOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "tokenAmount", type: "uint256" },
      { name: "minEthOut", type: "uint256" },
      { name: "hookData", type: "bytes" },
    ],
    name: "sellTokensWithHookData",
    outputs: [{ name: "ethOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "ethAmount", type: "uint256" },
    ],
    name: "quoteBuy",
    outputs: [{ name: "tokenAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "tokenAmount", type: "uint256" },
    ],
    name: "quoteSell",
    outputs: [{ name: "ethAmount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getPoolKey",
    outputs: [
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "hooks", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "hasActivePool",
    outputs: [{ name: "hasPool", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ============ Events ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
      { indexed: false, name: "tbaAddress", type: "address" },
    ],
    name: "CabalCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "contributor", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "totalRaised", type: "uint256" },
    ],
    name: "Contributed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: false, name: "tokenAddress", type: "address" },
      { indexed: false, name: "totalRaised", type: "uint256" },
      { indexed: false, name: "titheAmount", type: "uint256" },
      { indexed: false, name: "devBuyAmount", type: "uint256" },
    ],
    name: "CabalFinalized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "buyer", type: "address" },
      { indexed: false, name: "ethAmount", type: "uint256" },
      { indexed: false, name: "tokensReceived", type: "uint256" },
    ],
    name: "TokensBought",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "tokenAmount", type: "uint256" },
      { indexed: false, name: "ethReceived", type: "uint256" },
    ],
    name: "TokensSold",
    type: "event",
  },
] as const;

// Cabal phase enum
export enum CabalPhase {
  Presale = 0,
  Active = 1,
  Paused = 2,
}

// Types
export interface GovernanceSettings {
  votingPeriod: bigint;
  quorumBps: bigint;
  majorityBps: bigint;
  proposalThreshold: bigint;
}

export interface CabalInfo {
  id: bigint;
  creator: `0x${string}`;
  name: string;
  symbol: string;
  image: string;
  tbaAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  phase: CabalPhase;
  totalRaised: bigint;
  totalTokensReceived: bigint;
  totalStaked: bigint;
  contributorCount: bigint;
  settings: GovernanceSettings;
}
