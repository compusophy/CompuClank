// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase } from "../libraries/LibAppStorage.sol";

/**
 * @title DelegationFacet
 * @notice Handles delegation of voting power
 */
contract DelegationFacet {
    // ============ Events ============
    
    event DelegateChanged(
        uint256 indexed cabalId,
        address indexed delegator,
        address indexed fromDelegate,
        address toDelegate
    );
    
    event DelegatedPowerChanged(
        uint256 indexed cabalId,
        address indexed delegatee,
        uint256 previousPower,
        uint256 newPower
    );

    // ============ Errors ============
    
    error CabalNotActive();
    error CannotDelegateToSelf();
    error CannotDelegateToZero();
    error AlreadyDelegatedToThis();

    // ============ External Functions ============

    /**
     * @notice Delegate voting power to another address
     * @param cabalId The Cabal to delegate in
     * @param delegatee The address to delegate to
     */
    function delegate(uint256 cabalId, address delegatee) external {
        if (delegatee == address(0)) revert CannotDelegateToZero();
        if (delegatee == msg.sender) revert CannotDelegateToSelf();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        address currentDelegatee = LibAppStorage.getDelegatee(cabalId, msg.sender);
        if (currentDelegatee == delegatee) revert AlreadyDelegatedToThis();
        
        uint256 delegatorStake = LibAppStorage.getStakedBalance(cabalId, msg.sender);
        
        // Remove power from old delegatee
        if (currentDelegatee != address(0)) {
            uint256 oldPower = LibAppStorage.getDelegatedPower(cabalId, currentDelegatee);
            uint256 newOldPower = oldPower > delegatorStake ? oldPower - delegatorStake : 0;
            LibAppStorage.setDelegatedPower(cabalId, currentDelegatee, newOldPower);
            
            emit DelegatedPowerChanged(cabalId, currentDelegatee, oldPower, newOldPower);
        }
        
        // Add power to new delegatee
        uint256 newDelegateePower = LibAppStorage.getDelegatedPower(cabalId, delegatee);
        uint256 updatedPower = newDelegateePower + delegatorStake;
        LibAppStorage.setDelegatedPower(cabalId, delegatee, updatedPower);
        
        // Update delegation
        LibAppStorage.setDelegatee(cabalId, msg.sender, delegatee);
        
        emit DelegateChanged(cabalId, msg.sender, currentDelegatee, delegatee);
        emit DelegatedPowerChanged(cabalId, delegatee, newDelegateePower, updatedPower);
    }

    /**
     * @notice Remove delegation (self-delegate)
     * @param cabalId The Cabal to undelegate in
     */
    function undelegate(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        address currentDelegatee = LibAppStorage.getDelegatee(cabalId, msg.sender);
        if (currentDelegatee == address(0)) {
            return; // Not delegated, nothing to do
        }
        
        uint256 delegatorStake = LibAppStorage.getStakedBalance(cabalId, msg.sender);
        
        // Remove power from delegatee
        uint256 oldPower = LibAppStorage.getDelegatedPower(cabalId, currentDelegatee);
        uint256 newPower = oldPower > delegatorStake ? oldPower - delegatorStake : 0;
        LibAppStorage.setDelegatedPower(cabalId, currentDelegatee, newPower);
        
        // Clear delegation
        LibAppStorage.setDelegatee(cabalId, msg.sender, address(0));
        
        emit DelegateChanged(cabalId, msg.sender, currentDelegatee, address(0));
        emit DelegatedPowerChanged(cabalId, currentDelegatee, oldPower, newPower);
    }

    // ============ View Functions ============

    /**
     * @notice Get the delegatee for a user
     */
    function getDelegatee(uint256 cabalId, address delegator) external view returns (address) {
        return LibAppStorage.getDelegatee(cabalId, delegator);
    }

    /**
     * @notice Get the delegated power received by an address
     */
    function getDelegatedPower(uint256 cabalId, address delegatee) external view returns (uint256) {
        return LibAppStorage.getDelegatedPower(cabalId, delegatee);
    }

    /**
     * @notice Check if an address has delegated their power
     */
    function hasDelegated(uint256 cabalId, address user) external view returns (bool) {
        return LibAppStorage.getDelegatee(cabalId, user) != address(0);
    }
}
