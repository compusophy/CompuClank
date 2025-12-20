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
        uint256 totalRaised;
        uint256 totalTokensReceived;
        uint256 totalStaked;
        uint256 contributorCount;
        GovernanceSettings settings;
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
            totalRaised: cabal.totalRaised,
            totalTokensReceived: cabal.totalTokensReceived,
            totalStaked: cabal.totalStaked,
            contributorCount: cabal.contributors.length,
            settings: cabal.settings
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
                totalRaised: cabal.totalRaised,
                totalTokensReceived: cabal.totalTokensReceived,
                totalStaked: cabal.totalStaked,
                contributorCount: cabal.contributors.length,
                settings: cabal.settings
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
            contributions[i] = LibAppStorage.getContribution(cabalId, user);
            stakedBalances[i] = LibAppStorage.getStakedBalance(cabalId, user);
            
            uint256 ownStake = stakedBalances[i];
            uint256 delegatedToMe = LibAppStorage.getDelegatedPower(cabalId, user);
            address delegatee = LibAppStorage.getDelegatee(cabalId, user);
            votingPowers[i] = delegatee != address(0) ? delegatedToMe : ownStake + delegatedToMe;
            
            claimed[i] = LibAppStorage.hasClaimed(cabalId, user);
        }
    }
}
