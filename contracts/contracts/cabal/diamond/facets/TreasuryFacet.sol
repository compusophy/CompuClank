// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, ActivityType } from "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IClankerFeeLocker
 * @notice Interface for Clanker's fee locker contract
 */
interface IClankerFeeLocker {
    function claim(address feeOwner, address token) external;
    function availableFees(address feeOwner, address token) external view returns (uint256);
}

/**
 * @title TreasuryFacet
 * @notice Handles treasury operations, LP fee claiming, and predefined proposal helpers
 */
contract TreasuryFacet {
    // ============ Events ============
    
    event LPFeesClaimed(
        uint256 indexed cabalId,
        address indexed token,
        uint256 amount
    );

    // ============ Errors ============
    
    error CabalNotActive();
    error ClaimFailed();

    // ============ LP Fee Functions (Permissionless) ============

    /**
     * @notice Claim LP fees from Clanker FeeLocker
     * @param cabalId The Cabal to claim for
     * @param token The token to claim (e.g., WETH)
     * @dev Anyone can call this - fees go to TBA
     */
    function claimLPFees(uint256 cabalId, address token) external {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        
        AppStorage storage s = LibAppStorage.appStorage();
        
        // Get current balance before claim
        uint256 balanceBefore = IERC20(token).balanceOf(cabal.tbaAddress);
        
        // TBA calls FeeLocker.claim(tbaAddress, token)
        bytes memory claimCalldata = abi.encodeWithSelector(
            IClankerFeeLocker.claim.selector,
            cabal.tbaAddress,
            token
        );
        
        (bool success, ) = cabal.tbaAddress.call(
            abi.encodeWithSignature(
                "executeCall(address,uint256,bytes)",
                s.clankerFeeLocker,
                0,
                claimCalldata
            )
        );
        if (!success) revert ClaimFailed();
        
        // Calculate claimed amount
        uint256 balanceAfter = IERC20(token).balanceOf(cabal.tbaAddress);
        uint256 claimed = balanceAfter - balanceBefore;
        
        emit LPFeesClaimed(cabalId, token, claimed);
        
        LibAppStorage.logActivity(cabalId, msg.sender, ActivityType.FeeClaimed, claimed);
    }

    /**
     * @notice Get claimable LP fees
     * @param cabalId The Cabal
     * @param token The token to check
     */
    function getClaimableLPFees(uint256 cabalId, address token) external view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        AppStorage storage s = LibAppStorage.appStorage();
        
        return IClankerFeeLocker(s.clankerFeeLocker).availableFees(cabal.tbaAddress, token);
    }

    // ============ View Functions ============

    /**
     * @notice Get ETH balance in treasury
     */
    function getTreasuryETHBalance(uint256 cabalId) external view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        return cabal.tbaAddress.balance;
    }

    /**
     * @notice Get token balance in treasury
     */
    function getTreasuryTokenBalance(uint256 cabalId, address token) external view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        return IERC20(token).balanceOf(cabal.tbaAddress);
    }

    /**
     * @notice Get the Cabal's own token balance (excluding staked)
     */
    function getOwnTokenBalance(uint256 cabalId) external view returns (uint256) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.tokenAddress == address(0)) return 0;
        
        uint256 totalInTBA = IERC20(cabal.tokenAddress).balanceOf(cabal.tbaAddress);
        // Subtract staked tokens (which are held in TBA)
        return totalInTBA > cabal.totalStaked ? totalInTBA - cabal.totalStaked : 0;
    }

    // ============ Proposal Helpers ============
    // These functions help build calldata for common governance actions
    // They are called off-chain to construct proposals

    /**
     * @notice Build calldata for buying a token on DEX
     * @dev This is a helper - actual swap implementation depends on DEX
     */
    function buildBuyTokenCalldata(
        address router,
        address, /* tokenOut */
        uint256 ethAmount,
        uint256 minAmountOut,
        uint256 deadline
    ) external pure returns (address target, uint256 value, bytes memory data) {
        // Simplified - actual implementation would use Uniswap/DEX router
        target = router;
        value = ethAmount;
        data = abi.encodeWithSignature(
            "swapExactETHForTokens(uint256,address[],address,uint256)",
            minAmountOut,
            new address[](0), // path would be set
            address(0), // to would be TBA
            deadline
        );
    }

    /**
     * @notice Build calldata for contributing to another Cabal's presale
     * @param diamond The CABAL diamond address
     * @param targetCabalId The Cabal to invest in
     */
    function buildInvestInPresaleCalldata(
        address diamond,
        uint256 targetCabalId,
        uint256 ethAmount
    ) external pure returns (address target, uint256 value, bytes memory data) {
        target = diamond;
        value = ethAmount;
        data = abi.encodeWithSignature(
            "contribute(uint256)",
            targetCabalId
        );
    }

    /**
     * @notice Build calldata for transferring ETH
     */
    function buildTransferETHCalldata(
        address to,
        uint256 amount
    ) external pure returns (address target, uint256 value, bytes memory data) {
        target = to;
        value = amount;
        data = "";
    }

    /**
     * @notice Build calldata for transferring tokens
     */
    function buildTransferTokenCalldata(
        address token,
        address to,
        uint256 amount
    ) external pure returns (address target, uint256 value, bytes memory data) {
        target = token;
        value = 0;
        data = abi.encodeWithSelector(
            IERC20.transfer.selector,
            to,
            amount
        );
    }
}
