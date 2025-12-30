// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, GovernanceSettings, ClankerV4Settings } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "../../CabalNFT.sol";
import "../../CabalTBA.sol";
import "../../interfaces/IERC6551Registry.sol";
import "../../interfaces/IClankerFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
 */
contract CabalCreationFacet {
    // ============ Constants ============
    
    // Protocol fee recipient
    address constant PROTOCOL_FEE_RECIPIENT = 0x0487f15eA5E1e3358C22D3c21b927FbFC006EA05;
    
    // 1/33/33/33 Split: 1% protocol fee, 33% ETH to treasury, 33% tokens to treasury, 33% tokens to contributors
    uint256 constant PROTOCOL_FEE_BPS = 100;      // 1% protocol fee
    uint256 constant TREASURY_ETH_BPS = 3300;     // 33% stays as ETH in treasury
    uint256 constant TREASURY_TOKEN_BPS = 5000;   // 50% of devBuy tokens go to treasury (= 33% of total)
    uint256 constant BPS_DENOMINATOR = 10000;     // 1% + 33% + 66% devBuy = 100%
    bytes32 constant TBA_SALT = bytes32(0);
    
    // Minimum amounts to prevent spam
    uint256 constant MIN_CREATION_FEE = 0.001 ether;
    uint256 constant MIN_CONTRIBUTION = 0.001 ether;
    
    // Launch voting threshold - absolute majority of total raised capital
    uint256 constant LAUNCH_MAJORITY_BPS = 5100;  // 51% of totalRaised must vote YES
    
    // Launch timer - delay after vote threshold met before finalization
    uint256 constant LAUNCH_DELAY = 24 hours;
    
    // Default pool config (standard Clanker settings)
    int24 constant DEFAULT_TICK = -230400; // ~10 ETH market cap
    int24 constant DEFAULT_TICK_SPACING = 200;

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
    
    event TokensClaimed(
        uint256 indexed cabalId,
        address indexed claimant,
        uint256 amount
    );
    
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
    error AlreadyClaimed();
    error NoContribution();
    error InsufficientCreationFee();
    error InsufficientContribution();
    error VoteUnchanged();
    error LaunchMajorityNotMet();
    error LaunchTimerNotElapsed();
    error ContributionsLocked();
    error TransferFailed();
    error DeploymentFailed();

    // ============ External Functions ============

    /**
     * @notice Create a new Cabal with presale
     * @param name Token name
     * @param symbol Token symbol
     * @param image Token image URI
     * @param settings Initial governance settings
     * @return cabalId The ID of the new Cabal
     * @dev Requires minimum 0.001 ETH which becomes the creator's initial contribution
     */
    function createCabal(
        string calldata name,
        string calldata symbol,
        string calldata image,
        GovernanceSettings calldata settings
    ) external payable returns (uint256 cabalId) {
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
        
        // Initialize Cabal data
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        cabal.creator = msg.sender;
        cabal.name = name;
        cabal.symbol = symbol;
        cabal.image = image;
        cabal.tbaAddress = tbaAddress;
        cabal.phase = CabalPhase.Presale;
        cabal.createdAt = block.timestamp;
        cabal.settings = settings;
        
        // Track in indexes
        s.nextCabalId = cabalId + 1;
        s.allCabalIds.push(cabalId);
        LibAppStorage.getCreatorCabals(msg.sender).push(cabalId);
        
        // Auto-contribute the creation fee (creator becomes first contributor)
        cabal.contributors.push(msg.sender);
        LibAppStorage.setContribution(cabalId, msg.sender, msg.value);
        cabal.totalRaised = msg.value;
        
        // Forward ETH to TBA
        (bool success, ) = tbaAddress.call{value: msg.value}("");
        if (!success) revert TransferFailed();
        
        emit CabalCreated(cabalId, msg.sender, name, symbol, tbaAddress);
        emit Contributed(cabalId, msg.sender, msg.value, msg.value);
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

        // Block contributions during launch window (after vote threshold met)
        if (cabal.launchApprovedAt > 0) revert ContributionsLocked();

        // Track contribution
        uint256 existing = LibAppStorage.getContribution(cabalId, msg.sender);
        if (existing == 0) {
            cabal.contributors.push(msg.sender);
        }
        
        // If user already voted, reset their vote (contribution weight changed)
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
        
        LibAppStorage.setContribution(cabalId, msg.sender, existing + msg.value);
        cabal.totalRaised += msg.value;

        // Forward ETH to TBA
        (bool success, ) = cabal.tbaAddress.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit Contributed(cabalId, msg.sender, msg.value, cabal.totalRaised);
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
        uint256 totalRaised = cabal.totalRaised;
        
        // Calculate split amounts for event
        uint256 protocolFee = (totalRaised * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 remaining = totalRaised - protocolFee;
        uint256 treasuryEth = (remaining * TREASURY_ETH_BPS) / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);
        uint256 devBuyAmount = remaining - treasuryEth;
        
        // Deploy token and get contributor tokens amount (also sends protocol fee)
        (address tokenAddress, uint256 contributorTokens) = _deployTokenAndSplit(cabal);

        // Update state
        cabal.tokenAddress = tokenAddress;
        cabal.totalTokensReceived = contributorTokens;
        cabal.totalStaked = contributorTokens;
        cabal.phase = CabalPhase.Active;
        cabal.launchedAt = block.timestamp;

        emit ProtocolFeeCollected(cabalId, protocolFee);
        emit CabalFinalized(cabalId, tokenAddress, totalRaised, treasuryEth, devBuyAmount);
    }
    
    /**
     * @dev Deploy token via Clanker and return split amounts - separated to reduce stack depth
     */
    function _deployTokenAndSplit(CabalData storage cabal) internal returns (address tokenAddress, uint256 contributorTokens) {
        AppStorage storage s = LibAppStorage.appStorage();
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();

        // Send 1% protocol fee first
        uint256 protocolFee = (cabal.totalRaised * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        CabalTBA(payable(cabal.tbaAddress)).executeCall(PROTOCOL_FEE_RECIPIENT, protocolFee, "");
        
        // Calculate amounts after protocol fee
        uint256 remaining = cabal.totalRaised - protocolFee;
        uint256 treasuryEth = (remaining * TREASURY_ETH_BPS) / (BPS_DENOMINATOR - PROTOCOL_FEE_BPS);
        uint256 devBuyAmount = remaining - treasuryEth;

        IClankerFactory.DeploymentConfig memory config = _buildDeploymentConfig(
            cabal.name, cabal.symbol, cabal.image, cabal.tbaAddress, devBuyAmount, s, c
        );

        bytes memory result = CabalTBA(payable(cabal.tbaAddress)).executeCall(
            s.clankerFactory,
            devBuyAmount,
            abi.encodeWithSelector(IClankerFactory.deployToken.selector, config)
        );

        if (result.length < 32) revert DeploymentFailed();
        tokenAddress = abi.decode(result, (address));

        uint256 tokensReceived = IERC20(tokenAddress).balanceOf(cabal.tbaAddress);
        contributorTokens = tokensReceived - (tokensReceived * TREASURY_TOKEN_BPS) / BPS_DENOMINATOR;
    }

    /**
     * @notice Claim tokens from a Cabal (unstake + withdraw)
     * @param cabalId The Cabal to claim from
     * @dev Auto-finalizes if launch timer has elapsed. Claiming removes voting power.
     */
    function claimTokens(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Lazy finalization: if timer elapsed but not yet finalized, do it now
        _tryAutoFinalize(cabalId, cabal);
        
        if (LibAppStorage.hasClaimed(cabalId, msg.sender)) revert AlreadyClaimed();
        
        uint256 contribution = LibAppStorage.getContribution(cabalId, msg.sender);
        if (contribution == 0) revert NoContribution();
        
        // Calculate proportional tokens
        uint256 tokenAmount = (contribution * cabal.totalTokensReceived) / cabal.totalRaised;
        
        // Mark as claimed
        LibAppStorage.setClaimed(cabalId, msg.sender);
        
        // Reduce totalStaked and transfer
        unchecked { cabal.totalStaked -= tokenAmount; }
        
        CabalTBA(payable(cabal.tbaAddress)).executeCall(
            cabal.tokenAddress,
            0,
            abi.encodeWithSelector(IERC20.transfer.selector, msg.sender, tokenAmount)
        );
        
        emit TokensClaimed(cabalId, msg.sender, tokenAmount);
    }
    
    /**
     * @dev Try to auto-finalize if conditions are met
     */
    function _tryAutoFinalize(uint256 cabalId, CabalData storage cabal) internal {
        if (cabal.phase != CabalPhase.Presale) return;
        if (cabal.launchApprovedAt == 0) revert CabalNotActive();
        if (block.timestamp < cabal.launchApprovedAt + LAUNCH_DELAY) revert LaunchTimerNotElapsed();
        _finalizeCabal(cabalId, cabal);
    }

    // ============ View Functions ============

    /**
     * @notice Get claimable token amount for a user
     */
    function getClaimable(uint256 cabalId, address user) external view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        if (cabal.phase != CabalPhase.Active) return 0;
        if (LibAppStorage.hasClaimed(cabalId, user)) return 0;
        
        uint256 contribution = LibAppStorage.getContribution(cabalId, user);
        if (contribution == 0) return 0;
        
        return (contribution * cabal.totalTokensReceived) / cabal.totalRaised;
    }

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
        ClankerV4Settings storage c
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
        // poolData contains hook configuration (fees, etc.)
        IClankerFactory.PoolConfig memory poolConfig = IClankerFactory.PoolConfig({
            hook: c.hook,
            pairedToken: s.weth,
            tickIfToken0IsClanker: DEFAULT_TICK,
            tickSpacing: DEFAULT_TICK_SPACING,
            poolData: hex"00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000027100000000000000000000000000000000000000000000000000000000000002710"
        });
        
        // Locker config - TBA gets 100% of LP rewards
        address[] memory rewardAdmins = new address[](1);
        rewardAdmins[0] = tbaAddress;
        
        address[] memory rewardRecipients = new address[](1);
        rewardRecipients[0] = tbaAddress;
        
        uint16[] memory rewardBps = new uint16[](1);
        rewardBps[0] = 10000; // 100%
        
        // Standard LP positions (5 positions like Clanker SDK default)
        int24[] memory tickLower = new int24[](5);
        int24[] memory tickUpper = new int24[](5);
        uint16[] memory positionBps = new uint16[](5);
        
        tickLower[0] = -230400; tickUpper[0] = -214000; positionBps[0] = 1000;
        tickLower[1] = -214000; tickUpper[1] = -155000; positionBps[1] = 5000;
        tickLower[2] = -202000; tickUpper[2] = -155000; positionBps[2] = 1500;
        tickLower[3] = -155000; tickUpper[3] = -120000; positionBps[3] = 2000;
        tickLower[4] = -141000; tickUpper[4] = -120000; positionBps[4] = 500;
        
        // lockerData contains locker-specific configuration
        IClankerFactory.LockerConfig memory lockerConfig = IClankerFactory.LockerConfig({
            locker: c.locker,
            rewardAdmins: rewardAdmins,
            rewardRecipients: rewardRecipients,
            rewardBps: rewardBps,
            tickLower: tickLower,
            tickUpper: tickUpper,
            positionBps: positionBps,
            lockerData: hex"0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001"
        });
        
        // MEV module config with standard parameters
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
                extensionBps: 0,
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
