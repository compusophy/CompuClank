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
    
    uint256 constant TITHE_BPS = 1000; // 10% stays in treasury
    uint256 constant BPS_DENOMINATOR = 10000;
    bytes32 constant TBA_SALT = bytes32(0);
    
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
    
    event TokensClaimed(
        uint256 indexed cabalId,
        address indexed claimant,
        uint256 amount
    );

    // ============ Errors ============
    
    error CabalNotInPresale();
    error CabalNotActive();
    error NotCabalCreator();
    error AlreadyClaimed();
    error NoContribution();
    error ZeroContribution();
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
     */
    function createCabal(
        string calldata name,
        string calldata symbol,
        string calldata image,
        GovernanceSettings calldata settings
    ) external returns (uint256 cabalId) {
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
        
        emit CabalCreated(cabalId, msg.sender, name, symbol, tbaAddress);
    }

    /**
     * @notice Contribute ETH to a Cabal presale
     * @param cabalId The Cabal to contribute to
     */
    function contribute(uint256 cabalId) external payable {
        if (msg.value == 0) revert ZeroContribution();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Presale) revert CabalNotInPresale();
        
        // Track contribution
        uint256 existing = LibAppStorage.getContribution(cabalId, msg.sender);
        if (existing == 0) {
            cabal.contributors.push(msg.sender);
        }
        LibAppStorage.setContribution(cabalId, msg.sender, existing + msg.value);
        cabal.totalRaised += msg.value;
        
        // Forward ETH to TBA
        (bool success, ) = cabal.tbaAddress.call{value: msg.value}("");
        if (!success) revert TransferFailed();
        
        emit Contributed(cabalId, msg.sender, msg.value, cabal.totalRaised);
    }

    /**
     * @notice Finalize a Cabal presale - deploy token via Clanker
     * @param cabalId The Cabal to finalize
     * @dev Only callable by the Cabal creator
     *      10% of raised ETH stays as tithe, 90% goes to devBuy
     *      TBA is set as reward recipient for LP fees
     */
    function finalizeCabal(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Presale) revert CabalNotInPresale();
        if (msg.sender != cabal.creator) revert NotCabalCreator();
        
        AppStorage storage s = LibAppStorage.appStorage();
        
        uint256 totalRaised = cabal.totalRaised;
        uint256 titheAmount = (totalRaised * TITHE_BPS) / BPS_DENOMINATOR;
        uint256 devBuyAmount = totalRaised - titheAmount;
        
        // Get Clanker V4 settings from separate storage
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        
        // Build the full Clanker V4 deployment config
        IClankerFactory.DeploymentConfig memory config = _buildDeploymentConfig(
            cabal.name,
            cabal.symbol,
            cabal.image,
            cabal.tbaAddress,
            devBuyAmount,
            s,
            c
        );
        
        // Encode the deployToken call
        bytes memory deployCalldata = abi.encodeWithSelector(
            IClankerFactory.deployToken.selector,
            config
        );
        
        // Execute deployment from TBA (sends devBuyAmount as msg.value for devBuy)
        bytes memory result = CabalTBA(payable(cabal.tbaAddress)).executeCall(
            s.clankerFactory,
            devBuyAmount,
            deployCalldata
        );
        
        // Decode token address from result
        if (result.length < 32) revert DeploymentFailed();
        address tokenAddress = abi.decode(result, (address));
        
        // Get token balance received from devBuy
        uint256 tokensReceived = IERC20(tokenAddress).balanceOf(cabal.tbaAddress);
        
        // Update state
        cabal.tokenAddress = tokenAddress;
        cabal.totalTokensReceived = tokensReceived;
        cabal.phase = CabalPhase.Active;
        cabal.launchedAt = block.timestamp;
        
        emit CabalFinalized(cabalId, tokenAddress, totalRaised, titheAmount, devBuyAmount);
    }

    /**
     * @notice Claim tokens from a finalized Cabal
     * @param cabalId The Cabal to claim from
     */
    function claimTokens(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (LibAppStorage.hasClaimed(cabalId, msg.sender)) revert AlreadyClaimed();
        
        uint256 contribution = LibAppStorage.getContribution(cabalId, msg.sender);
        if (contribution == 0) revert NoContribution();
        
        // Calculate proportional tokens
        uint256 tokenAmount = (contribution * cabal.totalTokensReceived) / cabal.totalRaised;
        
        // Mark as claimed
        LibAppStorage.setClaimed(cabalId, msg.sender);
        
        // Transfer tokens from TBA to claimant
        bytes memory transferCalldata = abi.encodeWithSelector(
            IERC20.transfer.selector,
            msg.sender,
            tokenAmount
        );
        
        CabalTBA(payable(cabal.tbaAddress)).executeCall(
            cabal.tokenAddress,
            0,
            transferCalldata
        );
        
        emit TokensClaimed(cabalId, msg.sender, tokenAmount);
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
