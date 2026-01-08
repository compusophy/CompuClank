// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, GovernanceSettings, ClankerV4Settings, ActivityType } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "../../CabalNFT.sol";
import "../../CabalTBA.sol";
import "../../interfaces/IERC6551Registry.sol";
import "../../interfaces/IClankerFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// DevBuy extension data structure (must match IClankerUniv4EthDevBuy)
// IMPORTANT: Field order matters for ABI encoding!
struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct Univ4EthDevBuyExtensionData {
    PoolKey pairedTokenPoolKey;           // FIRST - for non-WETH pairs (unused for WETH)
    uint128 pairedTokenAmountOutMinimum;  // SECOND - min tokens from intermediate swap
    address recipient;                     // LAST - where tokens go
}

/**
 * @title CabalCreationFacet
 * @notice Handles Cabal creation, presale contributions, finalization, and token claims
 * @dev In the fractal DAO architecture, cabals can only be created via governance proposals.
 *      All protocol fees (1%) go to CABAL0's treasury (the root cabal).
 */
contract CabalCreationFacet {
    // ============ Constants ============
    
    // Fee structure for BOTH launch fees (presale) AND trading fees (locker):
    // - Protocol fee: 1% to CABAL0 (root) - SEPARATE from ancestor fees
    // - Ancestor fee: 1% per ancestor INCLUDING root
    // - So root gets 2% total (1% protocol + 1% ancestor) from all descendants
    uint256 constant PROTOCOL_FEE_BPS = 100;      // 1% protocol fee to CABAL0
    uint256 constant ANCESTOR_FEE_BPS = 100;      // 1% per ancestor in the chain (including root)
    uint256 constant TREASURY_ETH_BPS = 5000;     // 50% of remaining stays as ETH in treasury
    uint256 constant TREASURY_TOKEN_BPS = 5000;   // 50% of devBuy tokens go to treasury, 50% to stakers
    uint256 constant BPS_DENOMINATOR = 10000;
    bytes32 constant TBA_SALT = bytes32(0);
    
    // Governance delay after launch before proposals can be created/executed
    uint256 constant GOVERNANCE_DELAY = 10 minutes;
    
    // Minimum amounts to prevent spam
    uint256 constant MIN_CREATION_FEE = 0.00001 ether;  // ~$0.03
    uint256 constant MIN_CONTRIBUTION = 0.00001 ether;  // ~$0.03
    uint256 constant MIN_LAUNCH_AMOUNT = 0.001 ether;   // Minimum ETH needed for Clanker to deploy token
    
    // Launch voting threshold - absolute majority of total raised capital
    uint256 constant LAUNCH_MAJORITY_BPS = 5100;  // 51% of totalRaised must vote YES
    
    // Launch timer - delay after vote threshold met before finalization (TESTING: reduced)
    uint256 constant LAUNCH_DELAY = 10 minutes;
    
    // Default pool config (standard Clanker settings)
    int24 constant DEFAULT_TICK = -230400; // ~10 ETH market cap
    int24 constant DEFAULT_TICK_SPACING = 200;
    
    // Maximum children per cabal (hierarchical naming limit)
    uint256 constant MAX_CHILDREN = 8;

    // ============ Events ============
    
    event CabalCreated(
        uint256 indexed cabalId,
        address indexed creator,
        string name,
        string symbol,
        address tbaAddress
    );
    
    event Contributed(
        uint256 indexed cabalId,
        address indexed contributor,
        uint256 amount,
        uint256 totalRaised
    );
    
    event CabalFinalized(
        uint256 indexed cabalId,
        address tokenAddress,
        uint256 totalRaised,
        uint256 titheAmount,
        uint256 devBuyAmount
    );
    
    event ProtocolFeeCollected(
        uint256 indexed cabalId,
        uint256 amount
    );
    
    event AncestorFeeCollected(
        uint256 indexed cabalId,
        address indexed ancestor,
        uint256 amount
    );
    
    // NOTE: TokensClaimed event removed - tokens are now auto-staked at launch
    
    event LaunchVoteCast(
        uint256 indexed cabalId,
        address indexed voter,
        bool support,
        uint256 weight
    );
    
    event LaunchVoteReset(
        uint256 indexed cabalId,
        address indexed voter
    );
    
    event LaunchApproved(
        uint256 indexed cabalId,
        uint256 launchableAt
    );

    // ============ Errors ============
    
    error CabalNotInPresale();
    error CabalNotActive();
    error NoContribution();
    error InsufficientCreationFee();
    error InsufficientContribution();
    error VoteUnchanged();
    error LaunchMajorityNotMet();
    error LaunchTimerNotElapsed();
    error InsufficientFundsForLaunch();
    error TransferFailed();
    error DeploymentFailed();
    error GenesisNotInitialized();
    error NotCalledViaDiamond();
    error InvalidParentCabal();
    error CabalClosed();
    error TooManyChildren();

    // ============ External Functions ============

    /**
     * @notice Create a new child Cabal with presale (called via governance proposal)
     * @param parentCabalId The parent cabal that is spawning this child
     * @return cabalId The ID of the new Cabal
     * @dev Can only be called via diamond (governance proposal execution).
     *      Name and symbol are auto-generated based on cabal ID.
     *      Parent cabal's treasury provides the initial contribution.
     */
    function createChildCabal(uint256 parentCabalId) external payable returns (uint256 cabalId) {
        // Must be called via diamond (governance proposal execution)
        if (msg.sender != address(this)) revert NotCalledViaDiamond();
        
        // Genesis must be initialized
        if (!LibAppStorage.isGenesisInitialized()) revert GenesisNotInitialized();
        
        // Parent must exist and be active
        CabalData storage parent = LibAppStorage.getCabalData(parentCabalId);
        if (parent.tbaAddress == address(0)) revert InvalidParentCabal();
        if (parent.phase == CabalPhase.Closed) revert CabalClosed();
        if (parent.childCabalIds.length >= MAX_CHILDREN) revert TooManyChildren();
        
        if (msg.value < MIN_CREATION_FEE) revert InsufficientCreationFee();
        
        AppStorage storage s = LibAppStorage.appStorage();
        
        // Mint NFT to Diamond (this contract)
        cabalId = CabalNFT(s.cabalNFT).mint(address(this));
        
        // Create TBA for this NFT
        address tbaAddress = IERC6551Registry(s.erc6551Registry).createAccount(
            s.tbaImplementation,
            TBA_SALT,
            block.chainid,
            s.cabalNFT,
            cabalId
        );
        
        // Auto-generate name and ticker
        // If parent uses new hierarchical scheme (name starts with "C"), append child index
        // Otherwise, use legacy "CABAL{id}" format
        string memory name;
        string memory symbol;
        
        bytes memory parentName = bytes(parent.name);
        if (parentName.length > 0 && parentName[0] == 'C' && parentName.length < 10) {
            // New hierarchical scheme: C0 -> C01, C01 -> C011, etc.
            // Child index is 1-based (1-8)
            uint256 childIndex = parent.childCabalIds.length + 1;
            string memory indexStr = Strings.toString(childIndex);
            name = string(abi.encodePacked(parent.name, indexStr));
            symbol = string(abi.encodePacked("$", name));
        } else {
            // Legacy naming: CABAL0, CABAL1, etc.
            string memory idStr = Strings.toString(cabalId);
            name = string(abi.encodePacked("CABAL", idStr));
            symbol = string(abi.encodePacked("CABAL", idStr));
        }
        
        // Initialize Cabal data with default settings
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        cabal.creator = parent.tbaAddress; // Parent TBA is the "creator"
        cabal.name = name;
        cabal.symbol = symbol;
        cabal.image = "";
        cabal.tbaAddress = tbaAddress;
        cabal.phase = CabalPhase.Presale;
        cabal.createdAt = block.timestamp;
        
        // Set parent-child relationship
        cabal.parentCabalId = parentCabalId;
        LibAppStorage.addChildCabal(parentCabalId, cabalId);
        
        // Default governance settings
        cabal.settings = GovernanceSettings({
            votingPeriod: 50400,      // ~1 week on Base (2s blocks)
            quorumBps: 1000,          // 10%
            majorityBps: 5100,        // 51%
            proposalThreshold: 0      // Anyone can propose
        });
        
        // Track in indexes
        s.nextCabalId = cabalId + 1;
        s.allCabalIds.push(cabalId);
        
        // Parent TBA becomes first contributor
        cabal.contributors.push(parent.tbaAddress);
        LibAppStorage.setContribution(cabalId, parent.tbaAddress, msg.value);
        cabal.totalRaised = msg.value;
        
        // Forward ETH to child TBA
        (bool success, ) = tbaAddress.call{value: msg.value}("");
        if (!success) revert TransferFailed();
        
        emit CabalCreated(cabalId, parent.tbaAddress, name, symbol, tbaAddress);
        emit Contributed(cabalId, parent.tbaAddress, msg.value, msg.value);
        
        LibAppStorage.logActivity(cabalId, parent.tbaAddress, ActivityType.CabalCreated, msg.value);
    }

    /**
     * @notice Contribute ETH to a Cabal presale
     * @param cabalId The Cabal to contribute to
     * @dev Requires minimum 0.001 ETH per contribution
     */
    function contribute(uint256 cabalId) external payable {
        if (msg.value < MIN_CONTRIBUTION) revert InsufficientContribution();

        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Presale) revert CabalNotInPresale();

        // Track contribution
        uint256 existing = LibAppStorage.getContribution(cabalId, msg.sender);
        if (existing == 0) {
            cabal.contributors.push(msg.sender);
        }
        
        // Only reset votes if launch NOT yet approved (voting still matters)
        // During launch window (24hr countdown), voting is done - just accept contributions
        if (cabal.launchApprovedAt == 0) {
            uint256 currentVote = LibAppStorage.getLaunchVote(cabalId, msg.sender);
            if (currentVote != 0) {
                // Remove old vote using STORED weight (not current contribution)
                uint256 oldWeight = LibAppStorage.getLaunchVoteWeight(cabalId, msg.sender);
                if (currentVote == 1) {
                    cabal.launchVotesFor -= oldWeight;
                } else {
                    cabal.launchVotesAgainst -= oldWeight;
                }
                // Clear vote - user must vote again with new weight
                LibAppStorage.clearLaunchVote(cabalId, msg.sender);
                emit LaunchVoteReset(cabalId, msg.sender);
            }
        }
        
        LibAppStorage.setContribution(cabalId, msg.sender, existing + msg.value);
        cabal.totalRaised += msg.value;

        // Forward ETH to TBA
        (bool success, ) = cabal.tbaAddress.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit Contributed(cabalId, msg.sender, msg.value, cabal.totalRaised);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.Contributed, msg.value);
    }

    /**
     * @notice Vote on whether to launch the token (can change vote)
     * @param cabalId The Cabal to vote on
     * @param support True to vote YES for launch, false to vote NO
     * @dev Voting power is based on ETH contribution amount.
     *      Users can change their vote at any time before launch.
     *      When 51% threshold is met, a 24-hour timer starts.
     *      After timer elapses, anyone can call finalizeCabal().
     */
    function voteLaunch(uint256 cabalId, bool support) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Presale) revert CabalNotInPresale();
        
        uint256 contribution = LibAppStorage.getContribution(cabalId, msg.sender);
        if (contribution == 0) revert NoContribution();
        
        // Check current vote and apply change
        _applyVoteChange(cabalId, cabal, contribution, support);
        
        emit LaunchVoteCast(cabalId, msg.sender, support, contribution);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.VotedLaunch, contribution);
        
        // Start launch timer when threshold first reached
        if (cabal.launchApprovedAt == 0) {
            uint256 majorityRequired = (cabal.totalRaised * LAUNCH_MAJORITY_BPS) / BPS_DENOMINATOR;
            if (cabal.launchVotesFor >= majorityRequired) {
                cabal.launchApprovedAt = block.timestamp;
                emit LaunchApproved(cabalId, block.timestamp + LAUNCH_DELAY);
            }
        }
    }
    
    /**
     * @dev Internal helper to apply vote changes
     *      Uses stored vote weight to prevent underflow when contribution has changed
     */
    function _applyVoteChange(
        uint256 cabalId,
        CabalData storage cabal,
        uint256 contribution,
        bool support
    ) internal {
        // Get current vote: 0 = not voted, 1 = YES, 2 = NO
        uint256 cv = LibAppStorage.getLaunchVote(cabalId, msg.sender);

        // Revert if trying to vote the same way
        if (cv == (support ? 1 : 2)) revert VoteUnchanged();

        // Remove old vote using STORED weight (not current contribution)
        if (cv == 1) {
            uint256 oldWeight = LibAppStorage.getLaunchVoteWeight(cabalId, msg.sender);
            cabal.launchVotesFor -= oldWeight;
        } else if (cv == 2) {
            uint256 oldWeight = LibAppStorage.getLaunchVoteWeight(cabalId, msg.sender);
            cabal.launchVotesAgainst -= oldWeight;
        }

        // Add new vote with current contribution as weight
        if (support) {
            cabal.launchVotesFor += contribution;
        } else {
            cabal.launchVotesAgainst += contribution;
        }

        // Store vote direction AND weight
        LibAppStorage.setLaunchVote(cabalId, msg.sender, support, contribution);
    }

    /**
     * @notice Finalize a Cabal after launch timer has elapsed
     * @param cabalId The Cabal to finalize
     * @dev Anyone can call once 24 hours have passed since launch was approved.
     */
    function finalizeCabal(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Presale) revert CabalNotInPresale();
        
        // Check launch was approved (vote threshold met)
        if (cabal.launchApprovedAt == 0) revert LaunchMajorityNotMet();
        
        // Check 24 hour timer has elapsed
        if (block.timestamp < cabal.launchApprovedAt + LAUNCH_DELAY) revert LaunchTimerNotElapsed();
        
        // Check minimum ETH raised for Clanker deployment
        if (cabal.totalRaised < MIN_LAUNCH_AMOUNT) revert InsufficientFundsForLaunch();
        
        _finalizeCabal(cabalId, cabal);
    }
    
    /**
     * @dev Internal finalization logic - deploy token via Clanker
     *      33/33/33 Split:
     *      - 33% ETH stays in treasury
     *      - 67% used for devBuy, resulting tokens split:
     *        - 50% to treasury (just held, no voting power)
     *        - 50% auto-staked to contributors (voting power, claim to unstake+withdraw)
     */
    function _finalizeCabal(uint256 cabalId, CabalData storage cabal) internal {
        // Deploy token and get contributor tokens amount (sends protocol + ancestry fees)
        (address tokenAddress, uint256 contributorTokens, uint256 treasuryEth, uint256 devBuyAmount) = 
            _deployTokenAndSplit(cabalId, cabal);

        // Update state
        cabal.tokenAddress = tokenAddress;
        cabal.totalTokensReceived = contributorTokens;
        cabal.phase = CabalPhase.Active;
        cabal.launchedAt = block.timestamp;
        cabal.governanceStartsAt = block.timestamp + GOVERNANCE_DELAY;
        
        // Auto-stake tokens for each contributor based on their contribution
        uint256 totalRaised = cabal.totalRaised;
        for (uint256 i = 0; i < cabal.contributors.length; i++) {
            address contributor = cabal.contributors[i];
            uint256 contribution = LibAppStorage.getContribution(cabalId, contributor);
            uint256 tokenAmount = (contribution * contributorTokens) / totalRaised;
            
            // Set their staked balance (auto-staked)
            LibAppStorage.setStakedBalance(cabalId, contributor, tokenAmount);
            
            // Track that user has stake in this cabal (for indexing)
            LibAppStorage.getUserStakedCabals(contributor).push(cabalId);
        }
        cabal.totalStaked = contributorTokens;

        emit CabalFinalized(cabalId, tokenAddress, totalRaised, treasuryEth, devBuyAmount);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.Launched, totalRaised);
    }

    /**
     * @dev Deploy token via Clanker and return split amounts - separated to reduce stack depth
     */
    function _deployTokenAndSplit(uint256 cabalId, CabalData storage cabal) internal returns (
        address tokenAddress, 
        uint256 contributorTokens,
        uint256 treasuryEth,
        uint256 devBuyAmount
    ) {
        AppStorage storage s = LibAppStorage.appStorage();
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        uint256 totalRaised = cabal.totalRaised;

        // 1. Send 1% protocol fee to CABAL0's treasury (root cabal)
        uint256 protocolFee = (totalRaised * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        address protocolTreasury = LibAppStorage.getCabalData(LibAppStorage.getRootCabalId()).tbaAddress;
        CabalTBA(payable(cabal.tbaAddress)).executeCall(protocolTreasury, protocolFee, "");
        emit ProtocolFeeCollected(cabalId, protocolFee);
        
        // 2. Send 1% to each ancestor (parent, grandparent, etc. up to but not including root)
        address[] memory ancestors = _getAncestorChain(cabalId);
        uint256 ancestorFee = (totalRaised * ANCESTOR_FEE_BPS) / BPS_DENOMINATOR;
        uint256 totalAncestorFees = ancestorFee * ancestors.length;
        
        for (uint256 i = 0; i < ancestors.length; i++) {
            CabalTBA(payable(cabal.tbaAddress)).executeCall(ancestors[i], ancestorFee, "");
            emit AncestorFeeCollected(cabalId, ancestors[i], ancestorFee);
        }
        
        // 3. Calculate remaining after all fees
        uint256 remaining = totalRaised - protocolFee - totalAncestorFees;
        
        // 4. Split remaining: 50% treasury ETH, 50% dev buy
        treasuryEth = (remaining * TREASURY_ETH_BPS) / BPS_DENOMINATOR;
        devBuyAmount = remaining - treasuryEth;

        IClankerFactory.DeploymentConfig memory config = _buildDeploymentConfig(
            cabal.name, cabal.symbol, cabal.image, cabal.tbaAddress, devBuyAmount, s, c, cabalId
        );

        // Deploy token - send devBuyAmount ETH for the devBuy extension
        bytes memory result = CabalTBA(payable(cabal.tbaAddress)).executeCall(
            s.clankerFactory,
            devBuyAmount,
            abi.encodeWithSelector(IClankerFactory.deployToken.selector, config)
        );

        if (result.length < 32) revert DeploymentFailed();
        tokenAddress = abi.decode(result, (address));

        // Check TBA token balance from devBuy
        uint256 tokensReceived = IERC20(tokenAddress).balanceOf(cabal.tbaAddress);
        // Split: 50% to treasury (held), 50% to contributors (staked for voting)
        contributorTokens = tokensReceived - (tokensReceived * TREASURY_TOKEN_BPS) / BPS_DENOMINATOR;
    }

    // NOTE: claimTokens() has been removed. Tokens are now auto-staked at launch.
    // Users should use StakingFacet.unstake() to withdraw their tokens.

    /**
     * @dev Try to auto-finalize if conditions are met
     */
    function _tryAutoFinalize(uint256 cabalId, CabalData storage cabal) internal {
        if (cabal.phase != CabalPhase.Presale) return;
        if (cabal.launchApprovedAt == 0) revert CabalNotActive();
        if (block.timestamp < cabal.launchApprovedAt + LAUNCH_DELAY) revert LaunchTimerNotElapsed();
        _finalizeCabal(cabalId, cabal);
    }

    /**
     * @dev Get the ancestor chain for a cabal (excluding root since it gets protocol fee separately)
     * @param cabalId The cabal to get ancestors for
     * @return ancestors Array of ancestor TBA addresses, from parent to root (empty for root/direct children of root)
     */
    function _getAncestorChain(uint256 cabalId) internal view returns (address[] memory ancestors) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Count ALL ancestors including root (root gets 1% of ALL descendant trading fees)
        uint256 count = 0;
        uint256 currentId = cabal.parentCabalId;
        while (currentId != 0) {
            count++;
            currentId = LibAppStorage.getCabalData(currentId).parentCabalId;
        }
        
        // Build the array - all ancestors get trading fee cuts
        ancestors = new address[](count);
        currentId = cabal.parentCabalId;
        for (uint256 i = 0; i < count; i++) {
            CabalData storage ancestor = LibAppStorage.getCabalData(currentId);
            ancestors[i] = ancestor.tbaAddress;
            currentId = ancestor.parentCabalId;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Reset stale launch voting state (admin only)
     * @param cabalId The cabal to reset voting for
     * @dev Use this to clear stuck proposals that can't be finalized
     */
    function adminResetLaunchVoting(uint256 cabalId) external {
        LibDiamond.enforceIsContractOwner();
        LibAppStorage.resetLaunchVoting(cabalId);
    }

    // ============ View Functions ============

    // NOTE: getClaimable() has been removed. Tokens are now auto-staked at launch.
    // Use StakingFacet.getStakedBalance() to see user's staked tokens.

    /**
     * @notice Get all contributors for a Cabal
     */
    function getContributors(uint256 cabalId) external view returns (address[] memory) {
        return LibAppStorage.getCabalData(cabalId).contributors;
    }

    /**
     * @notice Get the current status of launch voting
     * @param cabalId The Cabal to check
     * @return votesFor ETH-weighted votes for launch
     * @return votesAgainst ETH-weighted votes against launch
     * @return totalRaised Total ETH raised (denominator for majority calculation)
     * @return majorityRequired Amount of votesFor needed (51% of totalRaised)
     * @return majorityMet Whether absolute majority has been reached (launch can proceed)
     */
    function getLaunchVoteStatus(uint256 cabalId) external view returns (
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 totalRaised,
        uint256 majorityRequired,
        bool majorityMet,
        uint256 launchApprovedAt,
        uint256 launchableAt
    ) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);

        votesFor = cabal.launchVotesFor;
        votesAgainst = cabal.launchVotesAgainst;
        totalRaised = cabal.totalRaised;

        // Absolute majority: votesFor must be >= 51% of totalRaised
        majorityRequired = (totalRaised * LAUNCH_MAJORITY_BPS) / BPS_DENOMINATOR;
        majorityMet = votesFor >= majorityRequired;
        
        // Launch timer info
        launchApprovedAt = cabal.launchApprovedAt;
        launchableAt = launchApprovedAt > 0 ? launchApprovedAt + LAUNCH_DELAY : 0;
    }

    /**
     * @notice Check if a user has voted on launch
     * @param cabalId The Cabal to check
     * @param user The user address to check
     * @return Whether the user has voted
     */
    function hasVotedLaunch(uint256 cabalId, address user) external view returns (bool) {
        return LibAppStorage.hasVotedLaunch(cabalId, user);
    }

    /**
     * @notice Get a user's current launch vote direction
     * @param cabalId The Cabal to check
     * @param user The user address to check
     * @return vote 0 = not voted, 1 = voted YES, 2 = voted NO
     */
    function getLaunchVote(uint256 cabalId, address user) external view returns (uint256 vote) {
        return LibAppStorage.getLaunchVote(cabalId, user);
    }

    // ============ Internal Functions ============

    /**
     * @dev Build the full Clanker V4 DeploymentConfig
     */
    function _buildDeploymentConfig(
        string memory name,
        string memory symbol,
        string memory image,
        address tbaAddress,
        uint256 devBuyAmount,
        AppStorage storage s,
        ClankerV4Settings storage c,
        uint256 cabalId
    ) internal view returns (IClankerFactory.DeploymentConfig memory) {
        // Token config
        IClankerFactory.TokenConfig memory tokenConfig = IClankerFactory.TokenConfig({
            tokenAdmin: tbaAddress,
            name: name,
            symbol: symbol,
            salt: bytes32(0),
            image: image,
            metadata: "",
            context: '{"interface":"CABAL"}',
            originatingChainId: block.chainid
        });
        
        // Pool config (pair with WETH)
        // poolData copied from clanker-sdk v4 output (Jan 2026)
        // Contains: { extension=0, extensionData=[], feeData=[10000, 10000] } for static 1% fees
        IClankerFactory.PoolConfig memory poolConfig = IClankerFactory.PoolConfig({
            hook: c.hook,
            pairedToken: s.weth,
            tickIfToken0IsClanker: DEFAULT_TICK,
            tickSpacing: DEFAULT_TICK_SPACING,
            poolData: hex"00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000002710"
        });
        
        // Locker config - single reward recipient, single LP position
        // Matches clanker-sdk default config (Jan 2026)
        address[] memory rewardAdmins = new address[](1);
        address[] memory rewardRecipients = new address[](1);
        uint16[] memory rewardBps = new uint16[](1);
        
        rewardAdmins[0] = tbaAddress;
        rewardRecipients[0] = tbaAddress;
        rewardBps[0] = 10000; // 100%
        
        // LP positions - single full-range position matching SDK
        int24[] memory tickLower = new int24[](1);
        int24[] memory tickUpper = new int24[](1);
        uint16[] memory positionBps = new uint16[](1);
        tickLower[0] = -230400; tickUpper[0] = -120000; positionBps[0] = 10000;
        
        // lockerData from clanker-sdk (last byte is 00 not 01)
        IClankerFactory.LockerConfig memory lockerConfig = IClankerFactory.LockerConfig({
            locker: c.locker,
            rewardAdmins: rewardAdmins,
            rewardRecipients: rewardRecipients,
            rewardBps: rewardBps,
            tickLower: tickLower,
            tickUpper: tickUpper,
            positionBps: positionBps,
            lockerData: hex"0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
        });
        
        // MEV module config from clanker-sdk (different values than before)
        // Values: startingFee=666777, endingFee=666777, secondsToDecay=15
        IClankerFactory.MevModuleConfig memory mevConfig = IClankerFactory.MevModuleConfig({
            mevModule: c.mevModule,
            mevModuleData: hex"00000000000000000000000000000000000000000000000000000000000a2c99000000000000000000000000000000000000000000000000000000000000a2c9000000000000000000000000000000000000000000000000000000000000000f"
        });
        
        // Extension config for devBuy - buys tokens with raised ETH
        // For WETH pairs, pairedTokenPoolKey is not used but must be provided
        IClankerFactory.ExtensionConfig[] memory extensions;
        if (devBuyAmount > 0 && c.devBuyExtension != address(0)) {
            extensions = new IClankerFactory.ExtensionConfig[](1);
            
            // Create the DevBuy extension data struct
            // Field order: pairedTokenPoolKey, pairedTokenAmountOutMinimum, recipient
            Univ4EthDevBuyExtensionData memory devBuyData = Univ4EthDevBuyExtensionData({
                pairedTokenPoolKey: PoolKey({
                    currency0: address(0),
                    currency1: address(0),
                    fee: 0,
                    tickSpacing: 0,
                    hooks: address(0)
                }),
                pairedTokenAmountOutMinimum: 0,
                recipient: tbaAddress
            });
            
            extensions[0] = IClankerFactory.ExtensionConfig({
                extension: c.devBuyExtension,
                msgValue: devBuyAmount,
                extensionBps: 0,  // We don't need token allocation from supply, we buy from pool
                extensionData: abi.encode(devBuyData)
            });
        } else {
            extensions = new IClankerFactory.ExtensionConfig[](0);
        }
        
        return IClankerFactory.DeploymentConfig({
            tokenConfig: tokenConfig,
            poolConfig: poolConfig,
            lockerConfig: lockerConfig,
            mevModuleConfig: mevConfig,
            extensionConfigs: extensions
        });
    }
}
