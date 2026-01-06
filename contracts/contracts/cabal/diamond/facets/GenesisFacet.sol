// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, GovernanceSettings, ActivityType } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "../../CabalNFT.sol";
import "../../CabalTBA.sol";
import "../../interfaces/IERC6551Registry.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GenesisFacet
 * @notice Initializes the genesis root cabal (CABAL0)
 * @dev CABAL0 is the root of all cabals. It has a public presale like any other cabal.
 *      All protocol fees (1% creation, 1% trading) flow to CABAL0's treasury.
 */
contract GenesisFacet {
    // ============ Constants ============
    
    bytes32 constant TBA_SALT = bytes32(0);
    uint256 constant MIN_CONTRIBUTION = 0.00001 ether;  // ~$0.03
    
    // ============ Events ============
    
    event GenesisInitialized(uint256 indexed cabalId, address tbaAddress);
    event GenesisContributed(uint256 indexed cabalId, address indexed contributor, uint256 amount);
    
    // ============ Errors ============
    
    error GenesisAlreadyInitialized();
    error GenesisNotInitialized();
    error InsufficientContribution();
    error TransferFailed();

    // ============ External Functions ============

    /**
     * @notice Initialize the genesis root cabal (CABAL0)
     * @dev Can only be called once. Creates CABAL0 with public presale.
     *      The creator's contribution becomes the first contribution.
     */
    function initializeGenesis() external payable returns (uint256 cabalId) {
        if (LibAppStorage.isGenesisInitialized()) revert GenesisAlreadyInitialized();
        if (msg.value < MIN_CONTRIBUTION) revert InsufficientContribution();
        
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
        
        // Auto-generate name and ticker for genesis cabal
        string memory name = "Cabal Genesis";
        string memory symbol = "CABAL0";
        
        // Initialize CABAL0 data
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        cabal.creator = msg.sender;
        cabal.name = name;
        cabal.symbol = symbol;
        cabal.image = "";
        cabal.tbaAddress = tbaAddress;
        cabal.phase = CabalPhase.Presale;
        cabal.createdAt = block.timestamp;
        
        // Root cabal has parentCabalId = 0 (self-referential for root)
        cabal.parentCabalId = 0;
        
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
        LibAppStorage.getCreatorCabals(msg.sender).push(cabalId);
        
        // Set as root cabal
        LibAppStorage.setRootCabalId(cabalId);
        LibAppStorage.setGenesisInitialized();
        
        // Auto-contribute the creation fee (creator becomes first contributor)
        cabal.contributors.push(msg.sender);
        LibAppStorage.setContribution(cabalId, msg.sender, msg.value);
        cabal.totalRaised = msg.value;
        
        // Forward ETH to TBA
        (bool success, ) = tbaAddress.call{value: msg.value}("");
        if (!success) revert TransferFailed();
        
        emit GenesisInitialized(cabalId, tbaAddress);
        emit GenesisContributed(cabalId, msg.sender, msg.value);
        
        // Log activity for the activity feed
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.CabalCreated, msg.value);
    }

    /**
     * @notice Contribute to the genesis cabal presale
     * @dev Anyone can contribute to CABAL0's presale
     */
    function contributeToGenesis() external payable {
        if (!LibAppStorage.isGenesisInitialized()) revert GenesisNotInitialized();
        if (msg.value < MIN_CONTRIBUTION) revert InsufficientContribution();
        
        uint256 cabalId = LibAppStorage.getRootCabalId();
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
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
        
        emit GenesisContributed(cabalId, msg.sender, msg.value);
        
        // Log activity for the activity feed
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.Contributed, msg.value);
    }
}
