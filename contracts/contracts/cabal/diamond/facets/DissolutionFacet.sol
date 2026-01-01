// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase } from "../libraries/LibAppStorage.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";
import "../../CabalTBA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWETH
 */
interface IWETH {
    function withdraw(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title DissolutionFacet
 * @notice Handles cabal dissolution - parent cabals can dissolve their children
 * @dev Dissolution is cascade - dissolving a cabal dissolves all its descendants.
 *      Treasury assets are distributed proportionally to stakers.
 */
contract DissolutionFacet {
    // ============ Constants ============
    
    address constant WETH = 0x4200000000000000000000000000000000000006;

    // ============ Events ============
    
    event DissolutionStarted(uint256 indexed cabalId, uint256 indexed parentCabalId);
    event CabalDissolved(uint256 indexed cabalId, uint256 totalStakers, uint256 ethDistributed, uint256 tokensDistributed);
    event StakerPayout(uint256 indexed cabalId, address indexed staker, uint256 ethAmount, uint256 tokenAmount);

    // ============ Errors ============
    
    error NotCalledViaDiamond();
    error CannotDissolveRootCabal();
    error InvalidParentCabal();
    error CabalAlreadyClosed();
    error NoStakers();
    error TransferFailed();

    // ============ External Functions ============

    /**
     * @notice Dissolve a child cabal (called via parent's governance proposal)
     * @param childCabalId The cabal to dissolve
     * @dev Can only be called via diamond (governance proposal execution from parent).
     *      Cascades to all descendants. Distributes treasury to stakers.
     */
    function dissolveChild(uint256 childCabalId) external {
        // Must be called via diamond (governance proposal execution)
        if (msg.sender != address(this)) revert NotCalledViaDiamond();
        
        CabalData storage child = LibAppStorage.getCabalData(childCabalId);
        
        // Cannot dissolve root cabal
        if (LibAppStorage.isRootCabal(childCabalId)) revert CannotDissolveRootCabal();
        
        // Already closed
        if (child.phase == CabalPhase.Closed) revert CabalAlreadyClosed();
        
        uint256 parentId = child.parentCabalId;
        emit DissolutionStarted(childCabalId, parentId);
        
        // Cascade dissolve all descendants (depth-first)
        _cascadeDissolve(childCabalId);
    }

    /**
     * @dev Recursively dissolve a cabal and all its children
     */
    function _cascadeDissolve(uint256 cabalId) internal {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        // Skip if already closed
        if (cabal.phase == CabalPhase.Closed) return;
        
        // First, dissolve all children (depth-first)
        uint256[] memory children = cabal.childCabalIds;
        for (uint256 i = 0; i < children.length; i++) {
            _cascadeDissolve(children[i]);
        }
        
        // Now dissolve this cabal
        _dissolve(cabalId, cabal);
    }

    /**
     * @dev Dissolve a single cabal - distribute treasury to stakers
     */
    function _dissolve(uint256 cabalId, CabalData storage cabal) internal {
        // Get treasury balances
        address tba = cabal.tbaAddress;
        address token = cabal.tokenAddress;
        
        uint256 ethBalance = tba.balance;
        uint256 tokenBalance = token != address(0) ? IERC20(token).balanceOf(tba) : 0;
        
        // Also check for WETH and unwrap it
        uint256 wethBalance = IWETH(WETH).balanceOf(tba);
        if (wethBalance > 0) {
            // Unwrap WETH to ETH via TBA
            CabalTBA(payable(tba)).executeCall(
                WETH,
                0,
                abi.encodeWithSelector(IWETH.withdraw.selector, wethBalance)
            );
            ethBalance += wethBalance;
        }
        
        uint256 totalStaked = cabal.totalStaked;
        uint256 stakerCount = 0;
        
        // Distribute to stakers proportionally
        if (totalStaked > 0) {
            address[] memory contributors = cabal.contributors;
            
            for (uint256 i = 0; i < contributors.length; i++) {
                address staker = contributors[i];
                uint256 stakedBalance = LibAppStorage.getStakedBalance(cabalId, staker);
                
                if (stakedBalance > 0) {
                    stakerCount++;
                    
                    // Calculate proportional share
                    uint256 ethShare = (ethBalance * stakedBalance) / totalStaked;
                    uint256 tokenShare = (tokenBalance * stakedBalance) / totalStaked;
                    
                    // Transfer ETH share
                    if (ethShare > 0) {
                        CabalTBA(payable(tba)).executeCall(staker, ethShare, "");
                    }
                    
                    // Transfer token share
                    if (tokenShare > 0 && token != address(0)) {
                        CabalTBA(payable(tba)).executeCall(
                            token,
                            0,
                            abi.encodeWithSelector(IERC20.transfer.selector, staker, tokenShare)
                        );
                    }
                    
                    emit StakerPayout(cabalId, staker, ethShare, tokenShare);
                    
                    // Clear staked balance
                    LibAppStorage.setStakedBalance(cabalId, staker, 0);
                }
            }
        }
        
        // Mark as closed
        cabal.phase = CabalPhase.Closed;
        cabal.totalStaked = 0;
        
        emit CabalDissolved(cabalId, stakerCount, ethBalance, tokenBalance);
    }

    // ============ View Functions ============

    /**
     * @notice Check if a cabal can be dissolved by its parent
     * @param cabalId The cabal to check
     * @return canDo Whether the cabal can be dissolved
     * @return reason Reason if cannot dissolve
     */
    function canDissolve(uint256 cabalId) external view returns (bool canDo, string memory reason) {
        if (LibAppStorage.isRootCabal(cabalId)) {
            return (false, "Cannot dissolve root cabal");
        }
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        if (cabal.phase == CabalPhase.Closed) {
            return (false, "Already closed");
        }
        
        if (cabal.tbaAddress == address(0)) {
            return (false, "Cabal does not exist");
        }
        
        return (true, "");
    }

    /**
     * @notice Get dissolution info for a cabal
     * @param cabalId The cabal to check
     */
    function getDissolutionInfo(uint256 cabalId) external view returns (
        uint256 parentId,
        uint256 childCount,
        uint256 totalStaked,
        uint256 ethBalance,
        uint256 tokenBalance
    ) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        
        parentId = cabal.parentCabalId;
        childCount = cabal.childCabalIds.length;
        totalStaked = cabal.totalStaked;
        ethBalance = cabal.tbaAddress.balance;
        
        if (cabal.tokenAddress != address(0)) {
            tokenBalance = IERC20(cabal.tokenAddress).balanceOf(cabal.tbaAddress);
        }
    }
}
