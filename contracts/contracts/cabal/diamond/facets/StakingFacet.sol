// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, ActivityType } from "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/**
 * @title StakingFacet
 * @notice Handles staking/unstaking of Cabal tokens for voting power
 */
contract StakingFacet {
    // ============ Events ============
    
    event Staked(
        uint256 indexed cabalId,
        address indexed user,
        uint256 amount,
        uint256 newBalance
    );
    
    event Unstaked(
        uint256 indexed cabalId,
        address indexed user,
        uint256 amount,
        uint256 newBalance
    );

    // ============ Errors ============
    
    error CabalNotActive();
    error InsufficientBalance();
    error ZeroAmount();
    error TransferFailed();

    // ============ External Functions ============

    /**
     * @notice Stake tokens to gain voting power
     * @param cabalId The Cabal to stake in
     * @param amount Amount of tokens to stake
     */
    function stake(uint256 cabalId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        // Transfer tokens from user to TBA (treasury holds staked tokens)
        bool success = IERC20(cabal.tokenAddress).transferFrom(
            msg.sender,
            cabal.tbaAddress,
            amount
        );
        if (!success) revert TransferFailed();
        
        _stakeInternal(cabalId, amount, cabal);
    }

    /**
     * @notice Stake tokens with EIP-2612 permit (single transaction, no separate approval)
     * @param cabalId The Cabal to stake in
     * @param amount Amount of tokens to stake
     * @param deadline Permit signature deadline
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     */
    function stakeWithPermit(
        uint256 cabalId,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (amount == 0) revert ZeroAmount();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        // Execute permit to approve this contract
        IERC20Permit(cabal.tokenAddress).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        );
        
        // Transfer tokens from user to TBA
        bool success = IERC20(cabal.tokenAddress).transferFrom(
            msg.sender,
            cabal.tbaAddress,
            amount
        );
        if (!success) revert TransferFailed();
        
        _stakeInternal(cabalId, amount, cabal);
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal stake logic (shared by stake and stakeWithPermit)
     */
    function _stakeInternal(uint256 cabalId, uint256 amount, CabalData storage cabal) internal {
        // Update staked balance
        uint256 currentStake = LibAppStorage.getStakedBalance(cabalId, msg.sender);
        uint256 newBalance = currentStake + amount;
        LibAppStorage.setStakedBalance(cabalId, msg.sender, newBalance);
        
        // Update total staked
        cabal.totalStaked += amount;
        
        // Track that user has stake in this cabal (for indexing)
        if (currentStake == 0) {
            LibAppStorage.getUserStakedCabals(msg.sender).push(cabalId);
        }
        
        // Update delegated power if user has delegated
        address delegatee = LibAppStorage.getDelegatee(cabalId, msg.sender);
        if (delegatee != address(0)) {
            uint256 currentDelegatedPower = LibAppStorage.getDelegatedPower(cabalId, delegatee);
            LibAppStorage.setDelegatedPower(cabalId, delegatee, currentDelegatedPower + amount);
        }
        
        emit Staked(cabalId, msg.sender, amount, newBalance);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.Staked, amount);
    }

    /**
     * @notice Unstake tokens
     * @param cabalId The Cabal to unstake from
     * @param amount Amount of tokens to unstake
     */
    function unstake(uint256 cabalId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        uint256 currentStake = LibAppStorage.getStakedBalance(cabalId, msg.sender);
        if (amount > currentStake) revert InsufficientBalance();
        
        uint256 newBalance = currentStake - amount;
        LibAppStorage.setStakedBalance(cabalId, msg.sender, newBalance);
        
        // Update total staked
        cabal.totalStaked -= amount;
        
        // Update delegated power if user has delegated (safe subtraction to prevent revert)
        address delegatee = LibAppStorage.getDelegatee(cabalId, msg.sender);
        if (delegatee != address(0)) {
            uint256 currentDelegatedPower = LibAppStorage.getDelegatedPower(cabalId, delegatee);
            uint256 newDelegatedPower = currentDelegatedPower > amount ? currentDelegatedPower - amount : 0;
            LibAppStorage.setDelegatedPower(cabalId, delegatee, newDelegatedPower);
        }
        
        // Transfer tokens from TBA back to user
        bytes memory transferCalldata = abi.encodeWithSelector(
            IERC20.transfer.selector,
            msg.sender,
            amount
        );
        
        // Import CabalTBA for executeCall
        (bool success, ) = cabal.tbaAddress.call(
            abi.encodeWithSignature(
                "executeCall(address,uint256,bytes)",
                cabal.tokenAddress,
                0,
                transferCalldata
            )
        );
        if (!success) revert TransferFailed();
        
        emit Unstaked(cabalId, msg.sender, amount, newBalance);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.Unstaked, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get staked balance for a user
     */
    function getStakedBalance(uint256 cabalId, address user) external view returns (uint256) {
        return LibAppStorage.getStakedBalance(cabalId, user);
    }

    /**
     * @notice Get voting power for a user (auto-staked + manual stake + delegated power)
     */
    function getVotingPower(uint256 cabalId, address user) external view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Auto-staked tokens from presale (if not yet claimed)
        uint256 autoStaked = 0;
        if (!LibAppStorage.hasClaimed(cabalId, user) && cabal.totalRaised > 0) {
            uint256 contribution = LibAppStorage.getContribution(cabalId, user);
            autoStaked = (contribution * cabal.totalTokensReceived) / cabal.totalRaised;
        }
        
        uint256 ownStake = LibAppStorage.getStakedBalance(cabalId, user);
        uint256 delegatedToMe = LibAppStorage.getDelegatedPower(cabalId, user);

        // If user has delegated, they lose their own stake as voting power
        address delegatee = LibAppStorage.getDelegatee(cabalId, user);
        if (delegatee != address(0)) {
            return delegatedToMe; // Only delegated power, not own stake
        }

        return autoStaked + ownStake + delegatedToMe;
    }

    /**
     * @notice Get total staked in a Cabal
     */
    function getTotalStaked(uint256 cabalId) external view returns (uint256) {
        return LibAppStorage.getCabalData(cabalId).totalStaked;
    }

    /**
     * @notice Get all Cabals a user has staked in
     */
    function getUserStakedCabals(address user) external view returns (uint256[] memory) {
        return LibAppStorage.getUserStakedCabals(user);
    }
}
