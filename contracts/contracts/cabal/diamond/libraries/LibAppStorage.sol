// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ============ Enums ============

enum CabalPhase {
    Presale,    // Accepting contributions
    Active,     // Token deployed, governance active
    Paused,     // Governance paused (emergency)
    Closed      // Dissolved - inert, read-only
}

enum ProposalState {
    Pending,
    Active,
    Succeeded,
    Defeated,
    Executed,
    Cancelled
}

enum ActivityType {
    CabalCreated,
    Contributed,
    VotedLaunch,
    Launched,
    Claimed,
    Staked,
    Unstaked,
    Bought,
    Sold,
    ProposalCreated,
    ProposalVoted,
    ProposalExecuted,
    Delegated,
    Undelegated,
    FeeClaimed
}

// ============ Structs ============

struct GovernanceSettings {
    uint256 votingPeriod;       // Blocks for voting (e.g., 50400 = ~1 week on Base)
    uint256 quorumBps;          // Basis points (e.g., 1000 = 10% of staked supply)
    uint256 majorityBps;        // Basis points (e.g., 5100 = 51%)
    uint256 proposalThreshold;  // Min voting power to create proposal
}

struct Proposal {
    uint256 id;
    address proposer;
    address[] targets;
    uint256[] values;
    bytes[] calldatas;
    string description;
    uint256 forVotes;
    uint256 againstVotes;
    uint256 startBlock;
    uint256 endBlock;
    bool executed;
    bool cancelled;
}

struct Activity {
    uint256 cabalId;
    address actor;
    ActivityType activityType;
    uint256 amount;      // ETH or token amount (context-dependent)
    uint256 timestamp;
}

struct CabalData {
    // Metadata (DO NOT REORDER - storage layout must be stable)
    address creator;
    string name;
    string symbol;
    string image;
    address tbaAddress;
    address tokenAddress;
    CabalPhase phase;
    
    // Presale (DO NOT REORDER)
    uint256 totalRaised;
    uint256 totalTokensReceived;
    address[] contributors;
    
    // Governance (DO NOT REORDER)
    GovernanceSettings settings;
    uint256 nextProposalId;
    uint256 totalStaked;
    
    // Timestamps (ADDED AT END to preserve storage layout)
    uint256 createdAt;      // block.timestamp when presale created
    uint256 launchedAt;     // block.timestamp when finalized to Active (0 if still presale)
    
    // Launch voting (ADDED AT END to preserve storage layout)
    uint256 launchVotesFor;     // ETH-weighted votes for launch
    uint256 launchVotesAgainst; // ETH-weighted votes against launch
    
    // Launch timer (ADDED AT END to preserve storage layout)
    uint256 launchApprovedAt;   // block.timestamp when launch vote threshold was met (0 if not yet)
    
    // Hierarchy (ADDED AT END to preserve storage layout)
    uint256 parentCabalId;      // Parent cabal ID (0 for root cabal)
    uint256[] childCabalIds;    // Array of child cabal IDs spawned by this cabal
}

struct AppStorage {
    // Contract references (DO NOT REORDER - storage layout must be stable)
    address cabalNFT;           // slot 0
    address tbaImplementation;  // slot 1
    address erc6551Registry;    // slot 2
    address clankerFactory;     // slot 3
    address clankerFeeLocker;   // slot 4
    address weth;               // slot 5
    
    // Cabal tracking (DO NOT MOVE - these were in original deployment)
    uint256 nextCabalId;        // slot 6
    uint256[] allCabalIds;      // slot 7
    
    // Mappings (stored separately due to Solidity limitations)
    // Access via LibAppStorage helper functions
}

// Separate storage for Clanker V4 addresses (added post-deployment)
struct ClankerV4Settings {
    address hook;
    address locker;
    address mevModule;
    address devBuyExtension;
}

// Ring buffer for global activity feed (10 most recent)
struct ActivityRingBuffer {
    Activity[10] activities;
    uint256 nextIndex;      // Next write position (0-9)
    uint256 totalCount;     // Total activities ever logged
}

// Storage positions for mappings
library LibAppStorage {
    bytes32 constant APP_STORAGE_POSITION = keccak256("cabal.app.storage");
    bytes32 constant CLANKER_V4_POSITION = keccak256("cabal.clanker.v4.settings");
    bytes32 constant CABAL_DATA_POSITION = keccak256("cabal.data.mapping");
    bytes32 constant CONTRIBUTIONS_POSITION = keccak256("cabal.contributions.mapping");
    bytes32 constant CLAIMED_POSITION = keccak256("cabal.claimed.mapping");
    bytes32 constant STAKED_POSITION = keccak256("cabal.staked.mapping");
    bytes32 constant DELEGATION_POSITION = keccak256("cabal.delegation.mapping");
    bytes32 constant DELEGATED_POWER_POSITION = keccak256("cabal.delegated.power.mapping");
    bytes32 constant PROPOSALS_POSITION = keccak256("cabal.proposals.mapping");
    bytes32 constant HAS_VOTED_POSITION = keccak256("cabal.has.voted.mapping");
    bytes32 constant CREATOR_CABALS_POSITION = keccak256("cabal.creator.cabals.mapping");
    bytes32 constant USER_STAKED_CABALS_POSITION = keccak256("cabal.user.staked.cabals.mapping");
    bytes32 constant LAUNCH_VOTED_POSITION = keccak256("cabal.launch.voted.mapping");
    bytes32 constant LAUNCH_VOTE_WEIGHT_POSITION = keccak256("cabal.launch.vote.weight.mapping");
    bytes32 constant ACTIVITY_BUFFER_POSITION = keccak256("cabal.activity.buffer");
    bytes32 constant ROOT_CABAL_ID_POSITION = keccak256("cabal.root.id");
    bytes32 constant GENESIS_INITIALIZED_POSITION = keccak256("cabal.genesis.initialized");

    function appStorage() internal pure returns (AppStorage storage s) {
        bytes32 position = APP_STORAGE_POSITION;
        assembly {
            s.slot := position
        }
    }

    function clankerV4Settings() internal pure returns (ClankerV4Settings storage s) {
        bytes32 position = CLANKER_V4_POSITION;
        assembly {
            s.slot := position
        }
    }

    // ============ Cabal Data ============
    
    function getCabalData(uint256 cabalId) internal pure returns (CabalData storage) {
        bytes32 position = keccak256(abi.encodePacked(CABAL_DATA_POSITION, cabalId));
        CabalData storage data;
        assembly {
            data.slot := position
        }
        return data;
    }

    // ============ Contributions ============
    
    function getContribution(uint256 cabalId, address user) internal view returns (uint256) {
        bytes32 position = keccak256(abi.encodePacked(CONTRIBUTIONS_POSITION, cabalId, user));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value;
    }

    function setContribution(uint256 cabalId, address user, uint256 amount) internal {
        bytes32 position = keccak256(abi.encodePacked(CONTRIBUTIONS_POSITION, cabalId, user));
        assembly {
            sstore(position, amount)
        }
    }

    // ============ Claimed Status ============
    
    function hasClaimed(uint256 cabalId, address user) internal view returns (bool) {
        bytes32 position = keccak256(abi.encodePacked(CLAIMED_POSITION, cabalId, user));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value == 1;
    }

    function setClaimed(uint256 cabalId, address user) internal {
        bytes32 position = keccak256(abi.encodePacked(CLAIMED_POSITION, cabalId, user));
        assembly {
            sstore(position, 1)
        }
    }

    // ============ Staking ============
    
    function getStakedBalance(uint256 cabalId, address user) internal view returns (uint256) {
        bytes32 position = keccak256(abi.encodePacked(STAKED_POSITION, cabalId, user));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value;
    }

    function setStakedBalance(uint256 cabalId, address user, uint256 amount) internal {
        bytes32 position = keccak256(abi.encodePacked(STAKED_POSITION, cabalId, user));
        assembly {
            sstore(position, amount)
        }
    }

    // ============ Delegation ============
    
    function getDelegatee(uint256 cabalId, address delegator) internal view returns (address) {
        bytes32 position = keccak256(abi.encodePacked(DELEGATION_POSITION, cabalId, delegator));
        address value;
        assembly {
            value := sload(position)
        }
        return value;
    }

    function setDelegatee(uint256 cabalId, address delegator, address delegatee) internal {
        bytes32 position = keccak256(abi.encodePacked(DELEGATION_POSITION, cabalId, delegator));
        assembly {
            sstore(position, delegatee)
        }
    }

    function getDelegatedPower(uint256 cabalId, address delegatee) internal view returns (uint256) {
        bytes32 position = keccak256(abi.encodePacked(DELEGATED_POWER_POSITION, cabalId, delegatee));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value;
    }

    function setDelegatedPower(uint256 cabalId, address delegatee, uint256 power) internal {
        bytes32 position = keccak256(abi.encodePacked(DELEGATED_POWER_POSITION, cabalId, delegatee));
        assembly {
            sstore(position, power)
        }
    }

    // ============ Proposals ============
    
    function getProposal(uint256 cabalId, uint256 proposalId) internal pure returns (Proposal storage) {
        bytes32 position = keccak256(abi.encodePacked(PROPOSALS_POSITION, cabalId, proposalId));
        Proposal storage proposal;
        assembly {
            proposal.slot := position
        }
        return proposal;
    }

    function hasVoted(uint256 cabalId, uint256 proposalId, address voter) internal view returns (bool) {
        bytes32 position = keccak256(abi.encodePacked(HAS_VOTED_POSITION, cabalId, proposalId, voter));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value == 1;
    }

    function setHasVoted(uint256 cabalId, uint256 proposalId, address voter) internal {
        bytes32 position = keccak256(abi.encodePacked(HAS_VOTED_POSITION, cabalId, proposalId, voter));
        assembly {
            sstore(position, 1)
        }
    }

    // ============ Index Mappings ============
    
    function getCreatorCabals(address creator) internal pure returns (uint256[] storage) {
        bytes32 position = keccak256(abi.encodePacked(CREATOR_CABALS_POSITION, creator));
        uint256[] storage arr;
        assembly {
            arr.slot := position
        }
        return arr;
    }

    function getUserStakedCabals(address user) internal pure returns (uint256[] storage) {
        bytes32 position = keccak256(abi.encodePacked(USER_STAKED_CABALS_POSITION, user));
        uint256[] storage arr;
        assembly {
            arr.slot := position
        }
        return arr;
    }

    // ============ Launch Voting ============
    // Vote values: 0 = not voted, 1 = voted YES, 2 = voted NO
    
    function getLaunchVote(uint256 cabalId, address user) internal view returns (uint256) {
        bytes32 position = keccak256(abi.encodePacked(LAUNCH_VOTED_POSITION, cabalId, user));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value;
    }

    function hasVotedLaunch(uint256 cabalId, address user) internal view returns (bool) {
        return getLaunchVote(cabalId, user) != 0;
    }

    function setLaunchVote(uint256 cabalId, address user, bool support, uint256 weight) internal {
        bytes32 votePosition = keccak256(abi.encodePacked(LAUNCH_VOTED_POSITION, cabalId, user));
        bytes32 weightPosition = keccak256(abi.encodePacked(LAUNCH_VOTE_WEIGHT_POSITION, cabalId, user));
        uint256 value = support ? 1 : 2; // 1 = YES, 2 = NO
        assembly {
            sstore(votePosition, value)
            sstore(weightPosition, weight)
        }
    }
    
    function getLaunchVoteWeight(uint256 cabalId, address user) internal view returns (uint256) {
        bytes32 position = keccak256(abi.encodePacked(LAUNCH_VOTE_WEIGHT_POSITION, cabalId, user));
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value;
    }
    
    function clearLaunchVote(uint256 cabalId, address user) internal {
        bytes32 votePosition = keccak256(abi.encodePacked(LAUNCH_VOTED_POSITION, cabalId, user));
        bytes32 weightPosition = keccak256(abi.encodePacked(LAUNCH_VOTE_WEIGHT_POSITION, cabalId, user));
        assembly {
            sstore(votePosition, 0)
            sstore(weightPosition, 0)
        }
    }

    // ============ Activity Ring Buffer ============

    function activityBuffer() internal pure returns (ActivityRingBuffer storage s) {
        bytes32 position = ACTIVITY_BUFFER_POSITION;
        assembly {
            s.slot := position
        }
    }

    function logActivity(uint256 cabalId, address actor, ActivityType activityType, uint256 amount) internal {
        ActivityRingBuffer storage buffer = activityBuffer();
        
        buffer.activities[buffer.nextIndex] = Activity({
            cabalId: cabalId,
            actor: actor,
            activityType: activityType,
            amount: amount,
            timestamp: block.timestamp
        });
        
        buffer.nextIndex = (buffer.nextIndex + 1) % 10;
        buffer.totalCount++;
    }

    function getRecentActivities() internal view returns (Activity[10] memory activities, uint256 count) {
        ActivityRingBuffer storage buffer = activityBuffer();
        count = buffer.totalCount < 10 ? buffer.totalCount : 10;
        
        // Return in reverse chronological order (newest first)
        for (uint256 i = 0; i < count; i++) {
            // Calculate index: start from most recent and go backwards
            uint256 idx = (buffer.nextIndex + 9 - i) % 10;
            activities[i] = buffer.activities[idx];
        }
    }

    // ============ Genesis/Root Cabal ============

    function getRootCabalId() internal view returns (uint256) {
        bytes32 position = ROOT_CABAL_ID_POSITION;
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value;
    }

    function setRootCabalId(uint256 cabalId) internal {
        bytes32 position = ROOT_CABAL_ID_POSITION;
        assembly {
            sstore(position, cabalId)
        }
    }

    function isGenesisInitialized() internal view returns (bool) {
        bytes32 position = GENESIS_INITIALIZED_POSITION;
        uint256 value;
        assembly {
            value := sload(position)
        }
        return value == 1;
    }

    function setGenesisInitialized() internal {
        bytes32 position = GENESIS_INITIALIZED_POSITION;
        assembly {
            sstore(position, 1)
        }
    }

    // ============ Hierarchy Helpers ============

    function addChildCabal(uint256 parentCabalId, uint256 childCabalId) internal {
        CabalData storage parent = getCabalData(parentCabalId);
        parent.childCabalIds.push(childCabalId);
    }

    function getChildCabals(uint256 cabalId) internal view returns (uint256[] memory) {
        return getCabalData(cabalId).childCabalIds;
    }

    function getParentCabalId(uint256 cabalId) internal view returns (uint256) {
        return getCabalData(cabalId).parentCabalId;
    }

    function isRootCabal(uint256 cabalId) internal view returns (bool) {
        return cabalId == getRootCabalId();
    }
}
