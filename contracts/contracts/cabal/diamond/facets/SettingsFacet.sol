// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, GovernanceSettings, ClankerV4Settings } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "../../CabalTBA.sol";

/**
 * @title SettingsFacet
 * @notice Handles governance settings and admin functions
 */
contract SettingsFacet {
    // ============ Events ============
    
    event GovernanceSettingsUpdated(
        uint256 indexed cabalId,
        uint256 votingPeriod,
        uint256 quorumBps,
        uint256 majorityBps,
        uint256 proposalThreshold
    );
    
    event CabalPaused(uint256 indexed cabalId);
    event CabalUnpaused(uint256 indexed cabalId);
    
    event ContractAddressUpdated(string indexed name, address newAddress);
    event AllCabalsReset(uint256 previousCount);
    event CabalMetadataUpdated(uint256 indexed cabalId, string name, string symbol, string image);

    // ============ Errors ============
    
    error CabalNotActive();
    error OnlyTBA();
    error InvalidSettings();

    // ============ Governance Settings (called via proposal execution) ============

    /**
     * @notice Update governance settings for a Cabal
     * @dev This must be called by the TBA (via governance proposal)
     * @param cabalId The Cabal to update
     * @param newSettings The new governance settings
     */
    function updateGovernanceSettings(
        uint256 cabalId,
        GovernanceSettings calldata newSettings
    ) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Only TBA can call this (via executed proposal)
        if (msg.sender != cabal.tbaAddress) revert OnlyTBA();
        
        // Validate settings
        if (newSettings.votingPeriod == 0) revert InvalidSettings();
        if (newSettings.quorumBps > 10000) revert InvalidSettings();
        if (newSettings.majorityBps < 5000 || newSettings.majorityBps > 10000) revert InvalidSettings();
        
        cabal.settings = newSettings;
        
        emit GovernanceSettingsUpdated(
            cabalId,
            newSettings.votingPeriod,
            newSettings.quorumBps,
            newSettings.majorityBps,
            newSettings.proposalThreshold
        );
    }

    /**
     * @notice Pause a Cabal (emergency)
     * @dev Called by TBA via governance
     */
    function pauseCabal(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (msg.sender != cabal.tbaAddress) revert OnlyTBA();
        
        cabal.phase = CabalPhase.Paused;
        emit CabalPaused(cabalId);
    }

    /**
     * @notice Unpause a Cabal
     * @dev Called by TBA via governance
     */
    function unpauseCabal(uint256 cabalId) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (msg.sender != cabal.tbaAddress) revert OnlyTBA();
        
        cabal.phase = CabalPhase.Active;
        emit CabalUnpaused(cabalId);
    }

    // ============ View Functions ============

    /**
     * @notice Get governance settings for a Cabal
     */
    function getGovernanceSettings(uint256 cabalId) external view returns (GovernanceSettings memory) {
        return LibAppStorage.getCabalData(cabalId).settings;
    }

    // ============ Admin Functions (Diamond Owner) ============

    /**
     * @notice Initialize contract addresses
     * @dev Only callable by Diamond owner, typically during deployment
     */
    function initializeAddresses(
        address cabalNFT,
        address tbaImplementation,
        address erc6551Registry,
        address clankerFactory,
        address clankerFeeLocker,
        address weth
    ) external {
        LibDiamond.enforceIsContractOwner();
        
        AppStorage storage s = LibAppStorage.appStorage();
        s.cabalNFT = cabalNFT;
        s.tbaImplementation = tbaImplementation;
        s.erc6551Registry = erc6551Registry;
        s.clankerFactory = clankerFactory;
        s.clankerFeeLocker = clankerFeeLocker;
        s.weth = weth;
        
        emit ContractAddressUpdated("cabalNFT", cabalNFT);
        emit ContractAddressUpdated("tbaImplementation", tbaImplementation);
        emit ContractAddressUpdated("erc6551Registry", erc6551Registry);
        emit ContractAddressUpdated("clankerFactory", clankerFactory);
        emit ContractAddressUpdated("clankerFeeLocker", clankerFeeLocker);
        emit ContractAddressUpdated("weth", weth);
    }

    /**
     * @notice Initialize Clanker V4 specific addresses
     * @dev Only callable by Diamond owner. Uses separate storage slot to avoid collision.
     */
    function initializeClankerAddresses(
        address clankerHook,
        address clankerLocker,
        address clankerMevModule,
        address clankerDevBuyExtension
    ) external {
        LibDiamond.enforceIsContractOwner();
        
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        c.hook = clankerHook;
        c.locker = clankerLocker;
        c.mevModule = clankerMevModule;
        c.devBuyExtension = clankerDevBuyExtension;
        
        emit ContractAddressUpdated("clankerHook", clankerHook);
        emit ContractAddressUpdated("clankerLocker", clankerLocker);
        emit ContractAddressUpdated("clankerMevModule", clankerMevModule);
        emit ContractAddressUpdated("clankerDevBuyExtension", clankerDevBuyExtension);
    }

    /**
     * @notice Update a single contract address
     */
    function updateContractAddress(string calldata name, address newAddress) external {
        LibDiamond.enforceIsContractOwner();
        
        AppStorage storage s = LibAppStorage.appStorage();
        bytes32 nameHash = keccak256(bytes(name));
        
        if (nameHash == keccak256("cabalNFT")) s.cabalNFT = newAddress;
        else if (nameHash == keccak256("tbaImplementation")) s.tbaImplementation = newAddress;
        else if (nameHash == keccak256("erc6551Registry")) s.erc6551Registry = newAddress;
        else if (nameHash == keccak256("clankerFactory")) s.clankerFactory = newAddress;
        else if (nameHash == keccak256("clankerFeeLocker")) s.clankerFeeLocker = newAddress;
        else if (nameHash == keccak256("weth")) s.weth = newAddress;
        else {
            // Clanker V4 settings use separate storage
            ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
            if (nameHash == keccak256("clankerHook")) c.hook = newAddress;
            else if (nameHash == keccak256("clankerLocker")) c.locker = newAddress;
            else if (nameHash == keccak256("clankerMevModule")) c.mevModule = newAddress;
            else if (nameHash == keccak256("clankerDevBuyExtension")) c.devBuyExtension = newAddress;
        }
        
        emit ContractAddressUpdated(name, newAddress);
    }

    /**
     * @notice Reset all cabals - clears the tracking arrays
     * @dev Only callable by Diamond owner. Old cabal data stays in storage but is orphaned.
     */
    function resetAllCabals() external {
        LibDiamond.enforceIsContractOwner();
        
        AppStorage storage s = LibAppStorage.appStorage();
        
        uint256 previousCount = s.allCabalIds.length;
        
        // Clear the cabal IDs array
        delete s.allCabalIds;
        
        // Reset the counter to start fresh
        s.nextCabalId = 0;
        
        emit AllCabalsReset(previousCount);
    }
    
    /**
     * @notice Re-add a cabal to the index (owner only)
     * @dev Used to fix index after reset if cabal data still exists
     */
    function reindexCabal(uint256 cabalId) external {
        LibDiamond.enforceIsContractOwner();
        
        AppStorage storage s = LibAppStorage.appStorage();
        
        // Check cabal exists (has a TBA)
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        require(cabal.tbaAddress != address(0), "Cabal does not exist");
        
        // Check not already indexed
        for (uint256 i = 0; i < s.allCabalIds.length; i++) {
            if (s.allCabalIds[i] == cabalId) {
                revert("Already indexed");
            }
        }
        
        // Add to index
        s.allCabalIds.push(cabalId);
        
        // Update nextCabalId if needed
        if (cabalId >= s.nextCabalId) {
            s.nextCabalId = cabalId + 1;
        }
    }
    
    /**
     * @notice Emergency recovery of ETH from a cabal's TBA (owner only)
     * @dev Only use for recovery purposes - this bypasses normal governance
     */
    function recoverETHFromCabal(uint256 cabalId, address payable recipient, uint256 amount) external {
        LibDiamond.enforceIsContractOwner();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        require(cabal.tbaAddress != address(0), "Cabal does not exist");
        
        // Execute ETH transfer from TBA
        CabalTBA(payable(cabal.tbaAddress)).executeCall(recipient, amount, "");
    }
    
    /**
     * @notice Emergency recovery of tokens from a cabal's TBA (owner only)
     * @dev Only use for recovery purposes - this bypasses normal governance
     */
    function recoverTokensFromCabal(uint256 cabalId, address token, address recipient, uint256 amount) external {
        LibDiamond.enforceIsContractOwner();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        require(cabal.tbaAddress != address(0), "Cabal does not exist");
        
        // Execute token transfer from TBA
        CabalTBA(payable(cabal.tbaAddress)).executeCall(
            token,
            0,
            abi.encodeWithSignature("transfer(address,uint256)", recipient, amount)
        );
    }

    /**
     * @notice Get contract addresses
     */
    function getContractAddresses() external view returns (
        address cabalNFT,
        address tbaImplementation,
        address erc6551Registry,
        address clankerFactory,
        address clankerFeeLocker,
        address weth
    ) {
        AppStorage storage s = LibAppStorage.appStorage();
        return (
            s.cabalNFT,
            s.tbaImplementation,
            s.erc6551Registry,
            s.clankerFactory,
            s.clankerFeeLocker,
            s.weth
        );
    }

    /**
     * @notice Get Clanker V4 specific addresses
     */
    function getClankerAddresses() external view returns (
        address clankerHook,
        address clankerLocker,
        address clankerMevModule,
        address clankerDevBuyExtension
    ) {
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        return (
            c.hook,
            c.locker,
            c.mevModule,
            c.devBuyExtension
        );
    }

    /**
     * @notice Update cabal metadata (name, symbol, image) - admin only
     * @dev This updates the CabalData storage. Note: The on-chain ERC-20 token's 
     *      name() and symbol() cannot be changed after deployment.
     * @param cabalId The cabal to update
     * @param name New name for the cabal
     * @param symbol New symbol for the cabal
     * @param image New image URI for the cabal
     */
    function updateCabalMetadata(
        uint256 cabalId,
        string calldata name,
        string calldata symbol,
        string calldata image
    ) external {
        LibDiamond.enforceIsContractOwner();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        require(cabal.tbaAddress != address(0), "Cabal does not exist");
        
        cabal.name = name;
        cabal.symbol = symbol;
        cabal.image = image;
        
        emit CabalMetadataUpdated(cabalId, name, symbol, image);
    }
}
