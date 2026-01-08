// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, Proposal, ProposalState, GovernanceSettings, ActivityType } from "../libraries/LibAppStorage.sol";

/**
 * @title GovernanceFacet
 * @notice Handles proposals, voting, and execution
 * @dev Includes preset proposal types for common actions in the fractal DAO
 */
contract GovernanceFacet {
    // ============ Constants ============
    
    uint256 constant BPS_DENOMINATOR = 10000;
    // NOTE: Governance delay is now stored in cabal.governanceStartsAt (set at launch)

    // ============ Enums ============
    
    enum ProposalType {
        Custom,             // 0: Free-form proposal
        CreateChildCabal,   // 1: Spawn a new child cabal
        ContributeToPresale,// 2: Contribute ETH to another cabal's presale
        DissolveChild,      // 3: Dissolve a child cabal
        Trade               // 4: Buy/sell tokens
    }

    // ============ Events ============
    
    event ProposalCreated(
        uint256 indexed cabalId,
        uint256 indexed proposalId,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        bytes[] calldatas,
        string description,
        uint256 startBlock,
        uint256 endBlock
    );
    
    event VoteCast(
        uint256 indexed cabalId,
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    
    event ProposalExecuted(
        uint256 indexed cabalId,
        uint256 indexed proposalId
    );
    
    event ProposalCancelled(
        uint256 indexed cabalId,
        uint256 indexed proposalId
    );

    // ============ Errors ============
    
    error CabalNotActive();
    error CabalClosed();
    error ProposalCooldownNotElapsed();
    error InsufficientVotingPower();
    error ProposalNotActive();
    error AlreadyVoted();
    error ProposalNotSucceeded();
    error ProposalAlreadyExecuted();
    error NotProposer();
    error ExecutionFailed();
    error ArrayLengthMismatch();
    error ProposalAlreadyActive();
    error NotChildCabal();
    error InvalidTargetCabal();

    // ============ External Functions ============

    /**
     * @notice Create a new proposal
     * @param cabalId The Cabal to propose in
     * @param targets Target addresses for calls
     * @param values ETH values for calls
     * @param calldatas Calldata for calls
     * @param description Description of the proposal
     * @return proposalId The ID of the new proposal
     */
    function createProposal(
        uint256 cabalId,
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata calldatas,
        string calldata description
    ) external returns (uint256 proposalId) {
        if (targets.length != values.length || values.length != calldatas.length) {
            revert ArrayLengthMismatch();
        }
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        // Check governance delay has elapsed after launch
        if (block.timestamp < cabal.governanceStartsAt) revert ProposalCooldownNotElapsed();
        
        // One proposal at a time - check if previous proposal is still active
        if (cabal.nextProposalId > 0) {
            ProposalState prevState = _getProposalState(cabalId, cabal.nextProposalId - 1);
            if (prevState == ProposalState.Active || prevState == ProposalState.Pending) {
                revert ProposalAlreadyActive();
            }
        }
        
        // Check proposer has enough voting power
        uint256 votingPower = _getVotingPower(cabalId, msg.sender);
        if (votingPower < cabal.settings.proposalThreshold) revert InsufficientVotingPower();
        
        proposalId = cabal.nextProposalId++;
        
        Proposal storage proposal = LibAppStorage.getProposal(cabalId, proposalId);
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.description = description;
        proposal.startBlock = block.number;
        proposal.endBlock = block.number + cabal.settings.votingPeriod;
        
        emit ProposalCreated(
            cabalId,
            proposalId,
            msg.sender,
            targets,
            values,
            calldatas,
            description,
            proposal.startBlock,
            proposal.endBlock
        );
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.ProposalCreated, proposalId);
    }

    /**
     * @notice Vote on a proposal
     * @param cabalId The Cabal
     * @param proposalId The proposal to vote on
     * @param support True for yes, false for no
     */
    function vote(uint256 cabalId, uint256 proposalId, bool support) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        Proposal storage proposal = LibAppStorage.getProposal(cabalId, proposalId);
        
        if (block.number < proposal.startBlock || block.number > proposal.endBlock) {
            revert ProposalNotActive();
        }
        
        if (LibAppStorage.hasVoted(cabalId, proposalId, msg.sender)) {
            revert AlreadyVoted();
        }
        
        uint256 weight = _getVotingPower(cabalId, msg.sender);
        if (weight == 0) revert InsufficientVotingPower();
        
        LibAppStorage.setHasVoted(cabalId, proposalId, msg.sender);
        
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }
        
        emit VoteCast(cabalId, proposalId, msg.sender, support, weight);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.ProposalVoted, weight);
    }

    /**
     * @notice Execute a successful proposal
     * @param cabalId The Cabal
     * @param proposalId The proposal to execute
     */
    function executeProposal(uint256 cabalId, uint256 proposalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        Proposal storage proposal = LibAppStorage.getProposal(cabalId, proposalId);
        
        if (proposal.executed) revert ProposalAlreadyExecuted();
        
        ProposalState state = _getProposalState(cabalId, proposalId);
        if (state != ProposalState.Succeeded) revert ProposalNotSucceeded();
        
        proposal.executed = true;
        
        // Execute all actions via TBA
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = cabal.tbaAddress.call(
                abi.encodeWithSignature(
                    "executeCall(address,uint256,bytes)",
                    proposal.targets[i],
                    proposal.values[i],
                    proposal.calldatas[i]
                )
            );
            if (!success) revert ExecutionFailed();
        }
        
        emit ProposalExecuted(cabalId, proposalId);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.ProposalExecuted, proposalId);
    }

    /**
     * @notice Cancel a proposal (only proposer)
     * @param cabalId The Cabal
     * @param proposalId The proposal to cancel
     */
    function cancelProposal(uint256 cabalId, uint256 proposalId) external {
        Proposal storage proposal = LibAppStorage.getProposal(cabalId, proposalId);
        if (msg.sender != proposal.proposer) revert NotProposer();
        if (proposal.executed) revert ProposalAlreadyExecuted();
        
        proposal.cancelled = true;
        
        emit ProposalCancelled(cabalId, proposalId);
    }

    // ============ Preset Proposal Functions ============

    /**
     * @notice Create a proposal to spawn a new child cabal
     * @param cabalId The parent cabal proposing the child creation
     * @param ethContribution The ETH amount from treasury to contribute to child's presale
     * @param description Description of why this child cabal should be created
     * @return proposalId The ID of the new proposal
     */
    function proposeCreateChildCabal(
        uint256 cabalId,
        uint256 ethContribution,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = ethContribution;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("createChildCabal(uint256)", cabalId);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to contribute to another cabal's presale
     * @param cabalId The cabal proposing the contribution
     * @param targetCabalId The cabal to contribute to
     * @param ethAmount The ETH amount to contribute
     * @param description Description of why this contribution should be made
     * @return proposalId The ID of the new proposal
     */
    function proposeContributeToPresale(
        uint256 cabalId,
        uint256 targetCabalId,
        uint256 ethAmount,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        // Verify target exists and is in presale
        CabalData storage target = LibAppStorage.getCabalData(targetCabalId);
        if (target.tbaAddress == address(0)) revert InvalidTargetCabal();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = ethAmount;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("contribute(uint256)", targetCabalId);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to dissolve a child cabal
     * @param cabalId The parent cabal proposing the dissolution
     * @param childCabalId The child cabal to dissolve
     * @param description Description of why this child should be dissolved
     * @return proposalId The ID of the new proposal
     */
    function proposeDissolveChild(
        uint256 cabalId,
        uint256 childCabalId,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        // Verify child is actually a child of this cabal
        CabalData storage child = LibAppStorage.getCabalData(childCabalId);
        if (child.parentCabalId != cabalId) revert NotChildCabal();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("dissolveChild(uint256)", childCabalId);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to buy tokens from another cabal
     * @param cabalId The cabal proposing the trade
     * @param targetCabalId The cabal whose tokens to buy
     * @param ethAmount The ETH amount to spend
     * @param minAmountOut Minimum tokens expected (slippage protection)
     * @param description Description of why this trade should be made
     * @return proposalId The ID of the new proposal
     */
    function proposeBuyTokens(
        uint256 cabalId,
        uint256 targetCabalId,
        uint256 ethAmount,
        uint256 minAmountOut,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = ethAmount;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("buyTokens(uint256,uint256)", targetCabalId, minAmountOut);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to sell tokens from another cabal
     * @param cabalId The cabal proposing the trade
     * @param targetCabalId The cabal whose tokens to sell
     * @param tokenAmount The token amount to sell
     * @param minEthOut Minimum ETH expected (slippage protection)
     * @param description Description of why this trade should be made
     * @return proposalId The ID of the new proposal
     */
    function proposeSellTokens(
        uint256 cabalId,
        uint256 targetCabalId,
        uint256 tokenAmount,
        uint256 minEthOut,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0; // No ETH sent for sell
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("sellTokens(uint256,uint256,uint256)", targetCabalId, tokenAmount, minEthOut);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to stake tokens in another cabal
     * @param cabalId The cabal proposing the stake
     * @param targetCabalId The cabal to stake tokens in
     * @param tokenAmount The token amount to stake
     * @param description Description of why this stake should be made
     * @return proposalId The ID of the new proposal
     */
    function proposeStake(
        uint256 cabalId,
        uint256 targetCabalId,
        uint256 tokenAmount,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("stake(uint256,uint256)", targetCabalId, tokenAmount);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to unstake tokens from another cabal
     * @param cabalId The cabal proposing the unstake
     * @param targetCabalId The cabal to unstake tokens from
     * @param tokenAmount The token amount to unstake
     * @param description Description of why this unstake should be made
     * @return proposalId The ID of the new proposal
     */
    function proposeUnstake(
        uint256 cabalId,
        uint256 targetCabalId,
        uint256 tokenAmount,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("unstake(uint256,uint256)", targetCabalId, tokenAmount);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to vote in another cabal's governance
     * @param cabalId The cabal proposing to vote
     * @param targetCabalId The cabal to vote in
     * @param targetProposalId The proposal ID to vote on
     * @param support True to vote FOR, false to vote AGAINST
     * @param description Description of why this vote should be cast
     * @return proposalId The ID of the new proposal
     * @dev NOTE: The target proposal may expire before this proposal passes.
     *      Execution will fail if the target proposal is no longer active.
     */
    function proposeVote(
        uint256 cabalId,
        uint256 targetCabalId,
        uint256 targetProposalId,
        bool support,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("castVote(uint256,uint256,bool)", targetCabalId, targetProposalId, support);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    /**
     * @notice Create a proposal to delegate voting power in another cabal
     * @param cabalId The cabal proposing to delegate
     * @param targetCabalId The cabal to delegate voting power in
     * @param delegatee The address to delegate to (can be user or another TBA)
     * @param description Description of why this delegation should be made
     * @return proposalId The ID of the new proposal
     */
    function proposeDelegate(
        uint256 cabalId,
        uint256 targetCabalId,
        address delegatee,
        string calldata description
    ) external returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.phase == CabalPhase.Closed) revert CabalClosed();
        
        address[] memory targets = new address[](1);
        targets[0] = address(this);
        
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature("delegate(uint256,address)", targetCabalId, delegatee);
        
        return _createProposalInternal(cabalId, targets, values, calldatas, description);
    }

    // ============ View Functions ============

    /**
     * @notice Get proposal state
     */
    function getProposalState(uint256 cabalId, uint256 proposalId) external view returns (ProposalState) {
        return _getProposalState(cabalId, proposalId);
    }

    /**
     * @notice Get proposal details
     */
    function getProposal(uint256 cabalId, uint256 proposalId) external view returns (
        uint256 id,
        address proposer,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startBlock,
        uint256 endBlock,
        bool executed,
        bool cancelled,
        string memory description
    ) {
        Proposal storage p = LibAppStorage.getProposal(cabalId, proposalId);
        return (
            p.id,
            p.proposer,
            p.forVotes,
            p.againstVotes,
            p.startBlock,
            p.endBlock,
            p.executed,
            p.cancelled,
            p.description
        );
    }

    /**
     * @notice Check if user has voted on proposal
     */
    function hasVoted(uint256 cabalId, uint256 proposalId, address voter) external view returns (bool) {
        return LibAppStorage.hasVoted(cabalId, proposalId, voter);
    }

    /**
     * @notice Get next proposal ID for a Cabal
     */
    function getNextProposalId(uint256 cabalId) external view returns (uint256) {
        return LibAppStorage.getCabalData(cabalId).nextProposalId;
    }

    // ============ Internal Functions ============

    function _getProposalState(uint256 cabalId, uint256 proposalId) internal view returns (ProposalState) {
        Proposal storage proposal = LibAppStorage.getProposal(cabalId, proposalId);
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        if (proposal.cancelled) return ProposalState.Cancelled;
        if (proposal.executed) return ProposalState.Executed;
        if (block.number <= proposal.endBlock) return ProposalState.Active;
        
        // Check if passed
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 quorumVotes = (cabal.totalStaked * cabal.settings.quorumBps) / BPS_DENOMINATOR;
        
        if (totalVotes < quorumVotes) return ProposalState.Defeated;
        
        uint256 majorityVotes = (totalVotes * cabal.settings.majorityBps) / BPS_DENOMINATOR;
        if (proposal.forVotes >= majorityVotes) {
            return ProposalState.Succeeded;
        }
        
        return ProposalState.Defeated;
    }

    function _getVotingPower(uint256 cabalId, address user) internal view returns (uint256) {
        // Tokens are now auto-staked at launch, so just use staked balance
        uint256 ownStake = LibAppStorage.getStakedBalance(cabalId, user);
        
        // Delegated power from others
        uint256 delegatedToMe = LibAppStorage.getDelegatedPower(cabalId, user);

        // If user has delegated their power, they only have delegated power from others
        address delegatee = LibAppStorage.getDelegatee(cabalId, user);
        if (delegatee != address(0)) {
            return delegatedToMe;
        }

        return ownStake + delegatedToMe;
    }

    /**
     * @dev Internal helper to create proposal (shared by standard and preset methods)
     */
    function _createProposalInternal(
        uint256 cabalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string calldata description
    ) internal returns (uint256 proposalId) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Check governance delay has elapsed after launch
        if (block.timestamp < cabal.governanceStartsAt) revert ProposalCooldownNotElapsed();
        
        // One proposal at a time - check if previous proposal is still active
        if (cabal.nextProposalId > 0) {
            ProposalState prevState = _getProposalState(cabalId, cabal.nextProposalId - 1);
            if (prevState == ProposalState.Active || prevState == ProposalState.Pending) {
                revert ProposalAlreadyActive();
            }
        }
        
        // Check proposer has enough voting power
        uint256 votingPower = _getVotingPower(cabalId, msg.sender);
        if (votingPower < cabal.settings.proposalThreshold) revert InsufficientVotingPower();
        
        proposalId = cabal.nextProposalId++;
        
        Proposal storage proposal = LibAppStorage.getProposal(cabalId, proposalId);
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.description = description;
        proposal.startBlock = block.number;
        proposal.endBlock = block.number + cabal.settings.votingPeriod;
        
        emit ProposalCreated(
            cabalId,
            proposalId,
            msg.sender,
            targets,
            values,
            calldatas,
            description,
            proposal.startBlock,
            proposal.endBlock
        );
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.ProposalCreated, proposalId);
    }
}
