// CABAL Diamond ABI - Combined from all facets
// This is a simplified ABI for frontend use

export const CABAL_ABI = [
  // ============ CabalCreationFacet ============
  {
    inputs: [],
    name: "createCabal",
    outputs: [{ name: "cabalId", type: "uint256" }],
    stateMutability: "payable",
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
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    name: "voteLaunch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getLaunchVoteStatus",
    outputs: [
      { name: "votesFor", type: "uint256" },
      { name: "votesAgainst", type: "uint256" },
      { name: "totalRaised", type: "uint256" },
      { name: "majorityRequired", type: "uint256" },
      { name: "majorityMet", type: "bool" },
      { name: "launchApprovedAt", type: "uint256" },
      { name: "launchableAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "hasVotedLaunch",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    name: "getLaunchVote",
    outputs: [{ name: "vote", type: "uint256" }],
    stateMutability: "view",
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
          { name: "createdAt", type: "uint256" },
          { name: "launchedAt", type: "uint256" },
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
          { name: "parentCabalId", type: "uint256" },
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
    name: "getHierarchicalCabalIds",
    outputs: [{ name: "ids", type: "uint256[]" }],
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
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    name: "getCabalsPaginated",
    outputs: [
      {
        name: "cabals",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "image", type: "string" },
          { name: "tbaAddress", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "phase", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "launchedAt", type: "uint256" },
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
          { name: "parentCabalId", type: "uint256" },
        ],
      },
      { name: "total", type: "uint256" },
    ],
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
  {
    inputs: [],
    name: "resetAllCabals",
    outputs: [],
    stateMutability: "nonpayable",
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
      { indexed: true, name: "voter", type: "address" },
      { indexed: false, name: "support", type: "bool" },
      { indexed: false, name: "weight", type: "uint256" },
    ],
    name: "LaunchVoteCast",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "voter", type: "address" },
    ],
    name: "LaunchVoteReset",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "ProtocolFeeCollected",
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
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: "previousCount", type: "uint256" },
    ],
    name: "AllCabalsReset",
    type: "event",
  },

  // ============ Proposal View Functions ============
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getNextProposalId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
    ],
    name: "getProposal",
    outputs: [
      { name: "id", type: "uint256" },
      { name: "proposer", type: "address" },
      { name: "forVotes", type: "uint256" },
      { name: "againstVotes", type: "uint256" },
      { name: "startBlock", type: "uint256" },
      { name: "endBlock", type: "uint256" },
      { name: "executed", type: "bool" },
      { name: "cancelled", type: "bool" },
      { name: "description", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
    ],
    name: "getProposalState",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "proposalId", type: "uint256" },
      { name: "voter", type: "address" },
    ],
    name: "hasVoted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // ============ ActivityFacet ============
  {
    inputs: [],
    name: "getRecentActivities",
    outputs: [
      {
        name: "activities",
        type: "tuple[10]",
        components: [
          { name: "cabalId", type: "uint256" },
          { name: "actor", type: "address" },
          { name: "activityType", type: "uint8" },
          { name: "amount", type: "uint256" },
          { name: "timestamp", type: "uint256" },
        ],
      },
      { name: "count", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalActivityCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // ============ GenesisFacet ============
  {
    inputs: [],
    name: "initializeGenesis",
    outputs: [{ name: "cabalId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "contributeToGenesis",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "isGenesisInitialized",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getRootCabalId",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getProtocolTreasury",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  // ============ Hierarchy (ViewFacet) ============
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getCabalHierarchy",
    outputs: [
      {
        name: "hierarchy",
        type: "tuple",
        components: [
          { name: "cabalId", type: "uint256" },
          { name: "parentId", type: "uint256" },
          { name: "childIds", type: "uint256[]" },
          { name: "phase", type: "uint8" },
          { name: "symbol", type: "string" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getFullTree",
    outputs: [
      {
        name: "nodes",
        type: "tuple[]",
        components: [
          { name: "cabalId", type: "uint256" },
          { name: "parentId", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getChildCabals",
    outputs: [{ name: "childIds", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getParentCabal",
    outputs: [{ name: "parentId", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalIds", type: "uint256[]" }],
    name: "getCabals",
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "image", type: "string" },
          { name: "tbaAddress", type: "address" },
          { name: "tokenAddress", type: "address" },
          { name: "phase", type: "uint8" },
          { name: "createdAt", type: "uint256" },
          { name: "launchedAt", type: "uint256" },
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
          { name: "parentCabalId", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ============ DissolutionFacet ============
  {
    inputs: [{ name: "childCabalId", type: "uint256" }],
    name: "dissolveChild",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "canDissolve",
    outputs: [
      { name: "canDissolve", type: "bool" },
      { name: "reason", type: "string" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cabalId", type: "uint256" }],
    name: "getDissolutionInfo",
    outputs: [
      { name: "parentId", type: "uint256" },
      { name: "childCount", type: "uint256" },
      { name: "totalStaked", type: "uint256" },
      { name: "ethBalance", type: "uint256" },
      { name: "tokenBalance", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ============ Governance Preset Proposals ============
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "ethContribution", type: "uint256" },
      { name: "description", type: "string" },
    ],
    name: "proposeCreateChildCabal",
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "targetCabalId", type: "uint256" },
      { name: "ethAmount", type: "uint256" },
      { name: "description", type: "string" },
    ],
    name: "proposeContributeToPresale",
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "childCabalId", type: "uint256" },
      { name: "description", type: "string" },
    ],
    name: "proposeDissolveChild",
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "cabalId", type: "uint256" },
      { name: "targetCabalId", type: "uint256" },
      { name: "ethAmount", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "description", type: "string" },
    ],
    name: "proposeBuyTokens",
    outputs: [{ name: "proposalId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ============ Dissolution Events ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "parentCabalId", type: "uint256" },
    ],
    name: "DissolutionStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: false, name: "totalStakers", type: "uint256" },
      { indexed: false, name: "ethDistributed", type: "uint256" },
      { indexed: false, name: "tokensDistributed", type: "uint256" },
    ],
    name: "CabalDissolved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "staker", type: "address" },
      { indexed: false, name: "ethAmount", type: "uint256" },
      { indexed: false, name: "tokenAmount", type: "uint256" },
    ],
    name: "StakerPayout",
    type: "event",
  },

  // ============ Genesis Events ============
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: false, name: "tbaAddress", type: "address" },
    ],
    name: "GenesisInitialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "cabalId", type: "uint256" },
      { indexed: true, name: "contributor", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
    name: "GenesisContributed",
    type: "event",
  },

] as const;

// Cabal phase enum
export enum CabalPhase {
  Presale = 0,
  Active = 1,
  Paused = 2,
  Closed = 3,
}

// Proposal state enum
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Succeeded = 2,
  Defeated = 3,
  Executed = 4,
  Cancelled = 5,
}

// Activity type enum
export enum ActivityType {
  CabalCreated = 0,
  Contributed = 1,
  VotedLaunch = 2,
  Launched = 3,
  Claimed = 4,
  Staked = 5,
  Unstaked = 6,
  Bought = 7,
  Sold = 8,
  ProposalCreated = 9,
  ProposalVoted = 10,
  ProposalExecuted = 11,
  Delegated = 12,
  Undelegated = 13,
  FeeClaimed = 14,
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
  createdAt: bigint;
  launchedAt: bigint;
  totalRaised: bigint;
  totalTokensReceived: bigint;
  totalStaked: bigint;
  contributorCount: bigint;
  settings: GovernanceSettings;
  parentCabalId: bigint;
}
