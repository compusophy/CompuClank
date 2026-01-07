// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, ActivityType } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "../../CabalNFT.sol";
import "../../CabalTBA.sol";
import "../../interfaces/IERC6551Registry.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ChildCreationFacet
 * @notice Simple voting for active cabals to create child cabals
 * @dev Mirrors the launch voting pattern - stake-weighted votes, 51% threshold, timer, then finalize
 */
contract ChildCreationFacet {
    // ============ Constants ============
    
    uint256 constant BPS_DENOMINATOR = 10000;
    uint256 constant CHILD_CREATION_MAJORITY_BPS = 5100;  // 51% of totalStaked must vote YES
    uint256 constant CHILD_CREATION_DELAY = 10 minutes;   // Timer after vote passes (TESTING)
    uint256 constant MIN_CREATION_FEE = 0.00001 ether;    // Minimum ETH for child's initial contribution
    bytes32 constant TBA_SALT = bytes32(0);

    // ============ Events ============
    
    event ChildCreationVoteCast(
        uint256 indexed cabalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    
    event ChildCreationApproved(
        uint256 indexed cabalId,
        uint256 finalizableAt
    );
    
    event ChildCreationVoteReset(
        uint256 indexed cabalId,
        address indexed voter
    );
    
    event ChildCabalCreated(
        uint256 indexed parentCabalId,
        uint256 indexed childCabalId,
        address childTbaAddress
    );

    // ============ Errors ============
    
    error CabalNotActive();
    error NoVotingPower();
    error VoteUnchanged();
    error ChildCreationNotApproved();
    error ChildCreationTimerNotElapsed();
    error InsufficientTreasuryBalance();
    error TransferFailed();

    // ============ External Functions ============

    /**
     * @notice Vote on whether to create a child cabal
     * @param cabalId The parent cabal voting on child creation
     * @param support True to vote YES, false to vote NO
     * @dev Voting power is based on staked token balance.
     *      Users can change their vote at any time.
     *      When 51% threshold is met, a 10-minute timer starts.
     */
    function voteCreateChild(uint256 cabalId, bool support) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        // Get voting power (staked balance)
        uint256 votingPower = _getVotingPower(cabalId, msg.sender);
        if (votingPower == 0) revert NoVotingPower();
        
        // Apply vote change
        _applyVoteChange(cabalId, cabal, votingPower, support);
        
        emit ChildCreationVoteCast(cabalId, msg.sender, support, votingPower);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.ProposalVoted, votingPower);
        
        // Start timer when threshold first reached
        if (LibAppStorage.getChildCreationApprovedAt(cabalId) == 0) {
            uint256 votesFor = LibAppStorage.getChildCreationVotesFor(cabalId);
            uint256 majorityRequired = (cabal.totalStaked * CHILD_CREATION_MAJORITY_BPS) / BPS_DENOMINATOR;
            if (votesFor >= majorityRequired) {
                LibAppStorage.setChildCreationApprovedAt(cabalId, block.timestamp);
                emit ChildCreationApproved(cabalId, block.timestamp + CHILD_CREATION_DELAY);
            }
        }
    }

    /**
     * @notice Finalize child creation after timer has elapsed
     * @param cabalId The parent cabal creating the child
     * @dev Anyone can call once timer has passed. Creates child and resets voting state.
     */
    function finalizeChildCreation(uint256 cabalId) external returns (uint256 childCabalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        // Check vote was approved
        uint256 approvedAt = LibAppStorage.getChildCreationApprovedAt(cabalId);
        if (approvedAt == 0) revert ChildCreationNotApproved();
        
        // Check timer has elapsed
        if (block.timestamp < approvedAt + CHILD_CREATION_DELAY) revert ChildCreationTimerNotElapsed();
        
        // Check treasury has enough ETH (need to check TBA balance)
        uint256 tbaBalance = cabal.tbaAddress.balance;
        if (tbaBalance < MIN_CREATION_FEE) revert InsufficientTreasuryBalance();
        
        // Use minimum fee for child creation
        uint256 contributionAmount = MIN_CREATION_FEE;
        
        // Create the child cabal
        childCabalId = _createChildCabal(cabalId, cabal, contributionAmount);
        
        // Reset voting state for next potential child creation
        LibAppStorage.resetChildCreationVoting(cabalId);
        
        emit ChildCabalCreated(cabalId, childCabalId, LibAppStorage.getCabalData(childCabalId).tbaAddress);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.CabalCreated, childCabalId);
    }

    // ============ View Functions ============

    /**
     * @notice Get the current status of child creation voting
     */
    function getChildCreationVoteStatus(uint256 cabalId) external view returns (
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 totalStaked,
        uint256 majorityRequired,
        bool majorityMet,
        uint256 approvedAt,
        uint256 finalizableAt
    ) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        votesFor = LibAppStorage.getChildCreationVotesFor(cabalId);
        votesAgainst = LibAppStorage.getChildCreationVotesAgainst(cabalId);
        totalStaked = cabal.totalStaked;
        
        majorityRequired = (totalStaked * CHILD_CREATION_MAJORITY_BPS) / BPS_DENOMINATOR;
        majorityMet = votesFor >= majorityRequired;
        
        approvedAt = LibAppStorage.getChildCreationApprovedAt(cabalId);
        finalizableAt = approvedAt > 0 ? approvedAt + CHILD_CREATION_DELAY : 0;
    }

    /**
     * @notice Check if user has voted on child creation
     */
    function hasVotedChildCreation(uint256 cabalId, address user) external view returns (bool) {
        return LibAppStorage.hasVotedChildCreation(cabalId, user);
    }

    /**
     * @notice Get a user's current child creation vote direction
     * @return vote 0 = not voted, 1 = voted YES, 2 = voted NO
     */
    function getChildCreationVote(uint256 cabalId, address user) external view returns (uint256 vote) {
        return LibAppStorage.getChildCreationVote(cabalId, user);
    }

    // ============ Admin Functions ============

    /**
     * @notice Reset stale child creation voting state (admin only)
     * @param cabalId The cabal to reset voting for
     * @dev Use this to clear stuck proposals that can't be finalized
     */
    function adminResetChildCreationVoting(uint256 cabalId) external {
        LibDiamond.enforceIsContractOwner();
        LibAppStorage.resetChildCreationVoting(cabalId);
        emit ChildCreationVoteReset(cabalId, msg.sender);
    }

    // ============ Internal Functions ============

    function _getVotingPower(uint256 cabalId, address user) internal view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Auto-staked tokens from presale (if not yet claimed)
        uint256 autoStaked = 0;
        if (!LibAppStorage.hasClaimed(cabalId, user) && cabal.totalRaised > 0) {
            uint256 contribution = LibAppStorage.getContribution(cabalId, user);
            autoStaked = (contribution * cabal.totalTokensReceived) / cabal.totalRaised;
        }
        
        // Manually staked tokens
        uint256 ownStake = LibAppStorage.getStakedBalance(cabalId, user);
        
        // Delegated power from others
        uint256 delegatedToMe = LibAppStorage.getDelegatedPower(cabalId, user);

        // If user has delegated their power, they only have delegated power from others
        address delegatee = LibAppStorage.getDelegatee(cabalId, user);
        if (delegatee != address(0)) {
            return delegatedToMe;
        }

        return autoStaked + ownStake + delegatedToMe;
    }

    function _applyVoteChange(
        uint256 cabalId,
        CabalData storage,
        uint256 votingPower,
        bool support
    ) internal {
        // getChildCreationVote now handles nonce checking - returns 0 if vote is from previous round
        uint256 currentVote = LibAppStorage.getChildCreationVote(cabalId, msg.sender);
        
        // Revert if trying to vote the same way
        if (currentVote == (support ? 1 : 2)) revert VoteUnchanged();
        
        // Remove old vote using stored weight (only if user has voted in current round)
        if (currentVote != 0) {
            uint256 currentVotesFor = LibAppStorage.getChildCreationVotesFor(cabalId);
            uint256 currentVotesAgainst = LibAppStorage.getChildCreationVotesAgainst(cabalId);
            
            if (currentVote == 1) {
                uint256 oldWeight = LibAppStorage.getChildCreationVoteWeight(cabalId, msg.sender);
                LibAppStorage.setChildCreationVotesFor(cabalId, currentVotesFor - oldWeight);
            } else if (currentVote == 2) {
                uint256 oldWeight = LibAppStorage.getChildCreationVoteWeight(cabalId, msg.sender);
                LibAppStorage.setChildCreationVotesAgainst(cabalId, currentVotesAgainst - oldWeight);
            }
        }
        
        // Add new vote
        if (support) {
            uint256 updatedFor = LibAppStorage.getChildCreationVotesFor(cabalId);
            LibAppStorage.setChildCreationVotesFor(cabalId, updatedFor + votingPower);
        } else {
            uint256 updatedAgainst = LibAppStorage.getChildCreationVotesAgainst(cabalId);
            LibAppStorage.setChildCreationVotesAgainst(cabalId, updatedAgainst + votingPower);
        }
        
        // Store vote direction, weight, and current nonce
        LibAppStorage.setChildCreationVote(cabalId, msg.sender, support, votingPower);
    }

    function _createChildCabal(
        uint256 parentCabalId,
        CabalData storage parent,
        uint256 contributionAmount
    ) internal returns (uint256 childCabalId) {
        AppStorage storage s = LibAppStorage.appStorage();
        
        // Mint NFT to Diamond
        childCabalId = CabalNFT(s.cabalNFT).mint(address(this));
        
        // Create TBA for this NFT
        address childTbaAddress = IERC6551Registry(s.erc6551Registry).createAccount(
            s.tbaImplementation,
            TBA_SALT,
            block.chainid,
            s.cabalNFT,
            childCabalId
        );
        
        // Auto-generate name and ticker
        string memory idStr = Strings.toString(childCabalId);
        string memory name = string(abi.encodePacked("Cabal ", idStr));
        string memory symbol = string(abi.encodePacked("CABAL", idStr));
        
        // Initialize child cabal data
        CabalData storage child = LibAppStorage.getCabalData(childCabalId);
        child.creator = parent.tbaAddress;
        child.name = name;
        child.symbol = symbol;
        child.image = "";
        child.tbaAddress = childTbaAddress;
        child.phase = CabalPhase.Presale;
        child.createdAt = block.timestamp;
        
        // Set parent-child relationship
        child.parentCabalId = parentCabalId;
        LibAppStorage.addChildCabal(parentCabalId, childCabalId);
        
        // Default governance settings
        child.settings.votingPeriod = 50400;
        child.settings.quorumBps = 1000;
        child.settings.majorityBps = 5100;
        child.settings.proposalThreshold = 0;
        
        // Track in indexes
        s.nextCabalId = childCabalId + 1;
        s.allCabalIds.push(childCabalId);
        
        // Parent TBA becomes first contributor
        child.contributors.push(parent.tbaAddress);
        LibAppStorage.setContribution(childCabalId, parent.tbaAddress, contributionAmount);
        child.totalRaised = contributionAmount;
        
        // Transfer ETH from parent TBA to child TBA
        bytes memory result = CabalTBA(payable(parent.tbaAddress)).executeCall(
            childTbaAddress,
            contributionAmount,
            ""
        );
        // executeCall returns empty bytes for simple ETH transfer, that's fine
        
        return childCabalId;
    }
}
