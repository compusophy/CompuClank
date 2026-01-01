// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, GovernanceSettings } from "../libraries/LibAppStorage.sol";

/**
 * @title ViewFacet
 * @notice Read-only functions for querying Cabal data
 * @dev Contains unique batch queries - individual getters are in their respective facets
 */
contract ViewFacet {
    // ============ Structs for Return Types ============
    
    struct CabalInfo {
        uint256 id;
        address creator;
        string name;
        string symbol;
        string image;
        address tbaAddress;
        address tokenAddress;
        CabalPhase phase;
        uint256 createdAt;
        uint256 launchedAt;
        uint256 totalRaised;
        uint256 totalTokensReceived;
        uint256 totalStaked;
        uint256 contributorCount;
        GovernanceSettings settings;
        uint256 parentCabalId;  // Parent in hierarchy (0 for root/legacy)
    }

    struct CabalHierarchy {
        uint256 cabalId;
        uint256 parentId;
        uint256[] childIds;
        CabalPhase phase;
        string symbol;
    }

    struct TreeNode {
        uint256 cabalId;
        uint256 parentId;
    }

    // ============ Cabal Queries ============

    /**
     * @notice Get full Cabal info
     */
    function getCabal(uint256 cabalId) external view returns (CabalInfo memory) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        return CabalInfo({
            id: cabalId,
            creator: cabal.creator,
            name: cabal.name,
            symbol: cabal.symbol,
            image: cabal.image,
            tbaAddress: cabal.tbaAddress,
            tokenAddress: cabal.tokenAddress,
            phase: cabal.phase,
            createdAt: cabal.createdAt,
            launchedAt: cabal.launchedAt,
            totalRaised: cabal.totalRaised,
            totalTokensReceived: cabal.totalTokensReceived,
            totalStaked: cabal.totalStaked,
            contributorCount: cabal.contributors.length,
            settings: cabal.settings,
            parentCabalId: cabal.parentCabalId
        });
    }

    /**
     * @notice Get all Cabal IDs
     */
    function getAllCabals() external view returns (uint256[] memory) {
        return LibAppStorage.appStorage().allCabalIds;
    }

    /**
     * @notice Get total number of Cabals
     */
    function getTotalCabals() external view returns (uint256) {
        return LibAppStorage.appStorage().allCabalIds.length;
    }

    /**
     * @notice Get paginated Cabals with full info (newest first)
     * @param offset Number of cabals to skip from the newest
     * @param limit Maximum number of cabals to return
     * @return cabals Array of CabalInfo structs
     * @return total Total number of cabals (for calculating hasMore on frontend)
     */
    function getCabalsPaginated(uint256 offset, uint256 limit) external view returns (
        CabalInfo[] memory cabals,
        uint256 total
    ) {
        uint256[] storage allIds = LibAppStorage.appStorage().allCabalIds;
        total = allIds.length;
        
        // If offset is beyond total, return empty
        if (offset >= total) {
            return (new CabalInfo[](0), total);
        }
        
        // Calculate how many we can actually return
        uint256 remaining = total - offset;
        uint256 count = remaining < limit ? remaining : limit;
        
        cabals = new CabalInfo[](count);
        
        // Iterate backwards (newest first)
        // newest = allIds[total - 1], so with offset 0, start at total - 1
        // with offset 5, start at total - 1 - 5 = total - 6
        for (uint256 i = 0; i < count; i++) {
            uint256 reverseIndex = total - 1 - offset - i;
            uint256 cabalId = allIds[reverseIndex];
            CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
            
            cabals[i] = CabalInfo({
                id: cabalId,
                creator: cabal.creator,
                name: cabal.name,
                symbol: cabal.symbol,
                image: cabal.image,
                tbaAddress: cabal.tbaAddress,
                tokenAddress: cabal.tokenAddress,
                phase: cabal.phase,
                createdAt: cabal.createdAt,
                launchedAt: cabal.launchedAt,
                totalRaised: cabal.totalRaised,
                totalTokensReceived: cabal.totalTokensReceived,
                totalStaked: cabal.totalStaked,
                contributorCount: cabal.contributors.length,
                settings: cabal.settings,
                parentCabalId: cabal.parentCabalId
            });
        }
    }

    /**
     * @notice Get Cabals created by an address
     */
    function getCabalsByCreator(address creator) external view returns (uint256[] memory) {
        return LibAppStorage.getCreatorCabals(creator);
    }

    /**
     * @notice Get Cabals where user has stake
     */
    function getCabalsByStaker(address staker) external view returns (uint256[] memory) {
        return LibAppStorage.getUserStakedCabals(staker);
    }

    // ============ Contribution Queries (unique to this facet) ============

    /**
     * @notice Get user's contribution to a Cabal
     */
    function getContribution(uint256 cabalId, address user) external view returns (uint256) {
        return LibAppStorage.getContribution(cabalId, user);
    }

    /**
     * @notice Check if user has claimed tokens
     */
    function hasClaimed(uint256 cabalId, address user) external view returns (bool) {
        return LibAppStorage.hasClaimed(cabalId, user);
    }

    // ============ Batch Queries ============

    /**
     * @notice Get multiple Cabals at once
     */
    function getCabals(uint256[] calldata cabalIds) external view returns (CabalInfo[] memory) {
        CabalInfo[] memory infos = new CabalInfo[](cabalIds.length);
        
        for (uint256 i = 0; i < cabalIds.length; i++) {
            CabalData storage cabal = LibAppStorage.getCabalData(cabalIds[i]);
            infos[i] = CabalInfo({
                id: cabalIds[i],
                creator: cabal.creator,
                name: cabal.name,
                symbol: cabal.symbol,
                image: cabal.image,
                tbaAddress: cabal.tbaAddress,
                tokenAddress: cabal.tokenAddress,
                phase: cabal.phase,
                createdAt: cabal.createdAt,
                launchedAt: cabal.launchedAt,
                totalRaised: cabal.totalRaised,
                totalTokensReceived: cabal.totalTokensReceived,
                totalStaked: cabal.totalStaked,
                contributorCount: cabal.contributors.length,
                settings: cabal.settings,
                parentCabalId: cabal.parentCabalId
            });
        }

        return infos;
    }

    /**
     * @notice Get user's position in multiple Cabals
     */
    function getUserPositions(address user, uint256[] calldata cabalIds) external view returns (
        uint256[] memory contributions,
        uint256[] memory stakedBalances,
        uint256[] memory votingPowers,
        bool[] memory claimed
    ) {
        contributions = new uint256[](cabalIds.length);
        stakedBalances = new uint256[](cabalIds.length);
        votingPowers = new uint256[](cabalIds.length);
        claimed = new bool[](cabalIds.length);
        
        for (uint256 i = 0; i < cabalIds.length; i++) {
            uint256 cabalId = cabalIds[i];
            CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
            
            contributions[i] = LibAppStorage.getContribution(cabalId, user);
            stakedBalances[i] = LibAppStorage.getStakedBalance(cabalId, user);
            claimed[i] = LibAppStorage.hasClaimed(cabalId, user);

            // Auto-staked tokens from presale (if not yet claimed)
            uint256 autoStaked = 0;
            if (!claimed[i] && cabal.totalRaised > 0) {
                autoStaked = (contributions[i] * cabal.totalTokensReceived) / cabal.totalRaised;
            }
            
            uint256 ownStake = stakedBalances[i];
            uint256 delegatedToMe = LibAppStorage.getDelegatedPower(cabalId, user);
            address delegatee = LibAppStorage.getDelegatee(cabalId, user);
            votingPowers[i] = delegatee != address(0) ? delegatedToMe : autoStaked + ownStake + delegatedToMe;
        }
    }

    // ============ Hierarchy Queries ============

    /**
     * @notice Get hierarchy info for a single cabal
     * @param cabalId The cabal to get hierarchy for
     * @return hierarchy Parent ID and child IDs
     */
    function getCabalHierarchy(uint256 cabalId) external view returns (CabalHierarchy memory hierarchy) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        hierarchy = CabalHierarchy({
            cabalId: cabalId,
            parentId: cabal.parentCabalId,
            childIds: cabal.childCabalIds,
            phase: cabal.phase,
            symbol: cabal.symbol
        });
    }

    /**
     * @notice Get the full tree structure (all cabals with their parent IDs)
     * @return nodes Array of TreeNode structs containing all cabals
     * @dev Optimized for graph visualization - minimal data per node
     */
    function getFullTree() external view returns (TreeNode[] memory nodes) {
        uint256[] storage allIds = LibAppStorage.appStorage().allCabalIds;
        nodes = new TreeNode[](allIds.length);
        
        for (uint256 i = 0; i < allIds.length; i++) {
            uint256 cabalId = allIds[i];
            CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
            
            nodes[i] = TreeNode({
                cabalId: cabalId,
                parentId: cabal.parentCabalId
            });
        }
    }

    /**
     * @notice Get only hierarchical cabals (CABAL0 and its descendants)
     * @return ids Array of cabal IDs that are part of the fractal hierarchy
     * @dev Excludes legacy cabals (those with parentCabalId=0 that aren't CABAL0)
     */
    function getHierarchicalCabalIds() external view returns (uint256[] memory ids) {
        if (!LibAppStorage.isGenesisInitialized()) {
            return new uint256[](0);
        }
        
        uint256 rootId = LibAppStorage.getRootCabalId();
        uint256[] storage allIds = LibAppStorage.appStorage().allCabalIds;
        
        // First pass: count hierarchical cabals
        uint256 count = 0;
        for (uint256 i = 0; i < allIds.length; i++) {
            uint256 cabalId = allIds[i];
            CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
            // Include if: is root cabal OR has a parent (part of hierarchy)
            if (cabalId == rootId || cabal.parentCabalId > 0) {
                count++;
            }
        }
        
        // Second pass: collect hierarchical cabal IDs
        ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allIds.length; i++) {
            uint256 cabalId = allIds[i];
            CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
            if (cabalId == rootId || cabal.parentCabalId > 0) {
                ids[idx++] = cabalId;
            }
        }
    }

    /**
     * @notice Get root cabal ID (CABAL0)
     */
    function getRootCabalId() external view returns (uint256) {
        return LibAppStorage.getRootCabalId();
    }

    /**
     * @notice Check if genesis has been initialized
     */
    function isGenesisInitialized() external view returns (bool) {
        return LibAppStorage.isGenesisInitialized();
    }

    /**
     * @notice Get the protocol treasury address (CABAL0's TBA)
     */
    function getProtocolTreasury() external view returns (address) {
        if (!LibAppStorage.isGenesisInitialized()) return address(0);
        uint256 rootId = LibAppStorage.getRootCabalId();
        return LibAppStorage.getCabalData(rootId).tbaAddress;
    }

    /**
     * @notice Get children of a cabal
     * @param cabalId The parent cabal
     * @return childIds Array of child cabal IDs
     */
    function getChildCabals(uint256 cabalId) external view returns (uint256[] memory childIds) {
        return LibAppStorage.getCabalData(cabalId).childCabalIds;
    }

    /**
     * @notice Get parent of a cabal
     * @param cabalId The child cabal
     * @return parentId Parent cabal ID (0 for root)
     */
    function getParentCabal(uint256 cabalId) external view returns (uint256 parentId) {
        return LibAppStorage.getCabalData(cabalId).parentCabalId;
    }
}
