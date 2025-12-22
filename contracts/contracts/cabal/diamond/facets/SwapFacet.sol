// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { LibAppStorage, AppStorage, CabalData, CabalPhase, ClankerV4Settings } from "../libraries/LibAppStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Uniswap V4 imports
import { Commands } from "@uniswap/universal-router/contracts/libraries/Commands.sol";
import { Actions } from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import { IV4Router } from "@uniswap/v4-periphery/src/interfaces/IV4Router.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { Currency } from "@uniswap/v4-core/src/types/Currency.sol";
import { IHooks } from "@uniswap/v4-core/src/interfaces/IHooks.sol";

/**
 * @title IUniversalRouter
 */
interface IUniversalRouter {
    function execute(
        bytes calldata commands,
        bytes[] calldata inputs,
        uint256 deadline
    ) external payable;
}

/**
 * @title IPermit2
 */
interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

/**
 * @title IWETH
 */
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SwapFacet
 * @notice Handles token swaps via Uniswap V4 for Cabal tokens
 * @dev Uses Universal Router with official Uniswap V4 encoding pattern
 */
contract SwapFacet {
    // ============ Constants ============
    
    // Universal Router on Base
    address constant UNIVERSAL_ROUTER = 0x6fF5693b99212Da76ad316178A184AB56D299b43;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    // ActionConstants from Uniswap V4
    address constant MSG_SENDER = address(1);
    address constant ADDRESS_THIS = address(2);
    
    // Dynamic Fee Flag (0x800000)
    uint24 constant DEFAULT_FEE = 8388608; 
    int24 constant DEFAULT_TICK_SPACING = 200;

    // ============ Events ============
    
    event TokensBought(uint256 indexed cabalId, address indexed buyer, uint256 ethAmount, uint256 tokensReceived);
    event TokensSold(uint256 indexed cabalId, address indexed seller, uint256 tokenAmount, uint256 ethReceived);

    // ============ Errors ============
    
    error CabalNotActive();
    error ZeroAmount();
    error InsufficientBalance();
    error SlippageExceeded();
    error InvalidToken();

    // ============ Buy Function ============

    /**
     * @notice Buy Cabal tokens with ETH
     * @param cabalId The Cabal ID to buy tokens from
     * @param minAmountOut Minimum tokens expected (slippage protection)
     */
    function buyTokens(
        uint256 cabalId,
        uint256 minAmountOut
    ) external payable returns (uint256 amountOut) {
        return buyTokensWithHookData(cabalId, minAmountOut, bytes(""));
    }

    /**
     * @notice Buy Cabal tokens with hook data
     */
    function buyTokensWithHookData(
        uint256 cabalId,
        uint256 minAmountOut,
        bytes memory hookData
    ) public payable returns (uint256 amountOut) {
        if (msg.value == 0) revert ZeroAmount();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.tokenAddress == address(0)) revert InvalidToken();
        
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        
        uint256 tokensBefore = IERC20(cabal.tokenAddress).balanceOf(address(this));
        
        _executeBuySwap(cabal.tokenAddress, c.hook, uint128(msg.value), uint128(minAmountOut), hookData);
        
        uint256 tokensAfter = IERC20(cabal.tokenAddress).balanceOf(address(this));
        amountOut = tokensAfter - tokensBefore;
        
        if (amountOut < minAmountOut) revert SlippageExceeded();
        
        // Transfer tokens to buyer
        IERC20(cabal.tokenAddress).transfer(msg.sender, amountOut);
        
        emit TokensBought(cabalId, msg.sender, msg.value, amountOut);
    }

    // ============ Sell Function ============

    /**
     * @notice Sell Cabal tokens for ETH
     */
    function sellTokens(
        uint256 cabalId,
        uint256 tokenAmount,
        uint256 minEthOut
    ) external returns (uint256 ethOut) {
        return sellTokensWithHookData(cabalId, tokenAmount, minEthOut, bytes(""));
    }

    /**
     * @notice Sell Cabal tokens with hook data
     */
    function sellTokensWithHookData(
        uint256 cabalId,
        uint256 tokenAmount,
        uint256 minEthOut,
        bytes memory hookData
    ) public returns (uint256 ethOut) {
        if (tokenAmount == 0) revert ZeroAmount();
        
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        if (cabal.phase != CabalPhase.Active) revert CabalNotActive();
        if (cabal.tokenAddress == address(0)) revert InvalidToken();
        
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        
        // Transfer tokens from seller
        IERC20(cabal.tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
        
        // Approve tokens to Permit2, then Permit2 to Universal Router
        IERC20(cabal.tokenAddress).approve(PERMIT2, tokenAmount);
        IPermit2(PERMIT2).approve(cabal.tokenAddress, UNIVERSAL_ROUTER, uint160(tokenAmount), uint48(block.timestamp + 300));
        
        uint256 ethBefore = address(this).balance;
        
        _executeSellSwap(cabal.tokenAddress, c.hook, uint128(tokenAmount), uint128(minEthOut), hookData);
        
        ethOut = address(this).balance - ethBefore;
        
        if (ethOut < minEthOut) revert SlippageExceeded();
        
        // Transfer ETH to seller
        (bool success, ) = msg.sender.call{value: ethOut}("");
        require(success, "ETH transfer failed");
        
        emit TokensSold(cabalId, msg.sender, tokenAmount, ethOut);
    }

    // ============ Internal Swap Functions ============

    /**
     * @notice Execute a buy swap (ETH -> Token) using Uniswap V4 Universal Router
     * @dev Uses WRAP_ETH command, then V4_SWAP with SETTLE (payerIsUser=false)
     */
    function _executeBuySwap(
        address token,
        address hook,
        uint128 amountIn,
        uint128 minAmountOut,
        bytes memory hookData
    ) internal {
        // Determine pool ordering (currency0 must be < currency1)
        bool isWethCurrency0 = WETH < token;
        
        // Build PoolKey using official types
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(isWethCurrency0 ? WETH : token),
            currency1: Currency.wrap(isWethCurrency0 ? token : WETH),
            fee: DEFAULT_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: IHooks(hook)
        });
        
        // For buying token with ETH:
        // - If WETH is currency0, we swap currency0 -> currency1 (zeroForOne = true)
        // - If WETH is currency1, we swap currency1 -> currency0 (zeroForOne = false)
        bool zeroForOne = isWethCurrency0;

        // ========== Build V4_SWAP Input ==========
        // Actions sequence for ETH -> Token swap:
        // 1. SWAP_EXACT_IN_SINGLE - perform the swap
        // 2. SETTLE - settle the WETH input (payerIsUser=false means use router's balance)
        // 3. TAKE_ALL - take the token output
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE),
            uint8(Actions.TAKE_ALL)
        );

        // Prepare parameters for each action
        bytes[] memory params = new bytes[](3);
        
        // Param 0: ExactInputSingleParams for SWAP_EXACT_IN_SINGLE
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                hookData: hookData
            })
        );
        
        // Param 1: SETTLE - (currency, amount, payerIsUser)
        // payerIsUser=false means use router's balance (WETH from WRAP_ETH)
        params[1] = abi.encode(
            Currency.wrap(WETH),
            uint256(amountIn),
            false  // payerIsUser = false (router pays from its own balance)
        );
        
        // Param 2: TAKE_ALL - (currency, minAmount)
        // We're receiving the token (the output currency)
        params[2] = abi.encode(
            Currency.wrap(token),
            minAmountOut
        );

        // ========== Build Universal Router Commands ==========
        // Commands: WRAP_ETH (wrap native ETH to WETH in router), V4_SWAP, SWEEP
        bytes memory commands = abi.encodePacked(
            uint8(Commands.WRAP_ETH),
            uint8(Commands.V4_SWAP),
            uint8(Commands.SWEEP)
        );

        // Build inputs array (one per command)
        bytes[] memory inputs = new bytes[](3);
        
        // Input 0: WRAP_ETH - (recipient, amount)
        // Recipient is ADDRESS_THIS (router) which will hold WETH for the swap
        inputs[0] = abi.encode(ADDRESS_THIS, uint256(amountIn));
        
        // Input 1: V4_SWAP - (actions, params)
        inputs[1] = abi.encode(actions, params);
        
        // Input 2: SWEEP - (token, recipient, amountMin)
        // Sweep output tokens from router to caller (Diamond)
        inputs[2] = abi.encode(token, MSG_SENDER, uint256(0));

        // Execute with native ETH
        IUniversalRouter(UNIVERSAL_ROUTER).execute{value: amountIn}(
            commands,
            inputs,
            block.timestamp + 300
        );
    }

    /**
     * @notice Execute a sell swap (Token -> ETH) using Uniswap V4 Universal Router
     * @dev Uses V4_SWAP with SETTLE_ALL (for user's tokens via Permit2), then UNWRAP_WETH
     */
    function _executeSellSwap(
        address token,
        address hook,
        uint128 amountIn,
        uint128 minAmountOut,
        bytes memory hookData
    ) internal {
        // Determine pool ordering
        bool isWethCurrency0 = WETH < token;
        
        // Build PoolKey
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(isWethCurrency0 ? WETH : token),
            currency1: Currency.wrap(isWethCurrency0 ? token : WETH),
            fee: DEFAULT_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: IHooks(hook)
        });
        
        // For selling token for ETH:
        // - If WETH is currency0, we swap currency1 -> currency0 (zeroForOne = false)
        // - If WETH is currency1, we swap currency0 -> currency1 (zeroForOne = true)
        bool zeroForOne = !isWethCurrency0;

        // ========== Build V4_SWAP Input ==========
        // Actions sequence for Token -> ETH swap:
        // 1. SWAP_EXACT_IN_SINGLE - perform the swap  
        // 2. SETTLE_ALL - settle the token input (pulled from user via Permit2)
        // 3. TAKE_ALL - take the WETH output
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE),
            uint8(Actions.SETTLE_ALL),
            uint8(Actions.TAKE_ALL)
        );

        bytes[] memory params = new bytes[](3);
        
        // Param 0: ExactInputSingleParams for SWAP_EXACT_IN_SINGLE
        params[0] = abi.encode(
            IV4Router.ExactInputSingleParams({
                poolKey: poolKey,
                zeroForOne: zeroForOne,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                hookData: hookData
            })
        );
        
        // Param 1: SETTLE_ALL - paying with token (maxAmount)
        params[1] = abi.encode(
            Currency.wrap(token),
            amountIn
        );
        
        // Param 2: TAKE_ALL - receiving WETH (minAmount)
        params[2] = abi.encode(
            Currency.wrap(WETH),
            minAmountOut
        );

        // ========== Build Universal Router Commands ==========
        // Commands: V4_SWAP, UNWRAP_WETH
        bytes memory commands = abi.encodePacked(
            uint8(Commands.V4_SWAP),
            uint8(Commands.UNWRAP_WETH)
        );

        bytes[] memory inputs = new bytes[](2);
        
        // Input 0: V4_SWAP
        inputs[0] = abi.encode(actions, params);
        
        // Input 1: UNWRAP_WETH - (recipient, amountMin)
        // Unwrap WETH and send ETH to caller (Diamond)
        inputs[1] = abi.encode(MSG_SENDER, uint256(0));

        // Execute (no ETH value for sell)
        IUniversalRouter(UNIVERSAL_ROUTER).execute(
            commands,
            inputs,
            block.timestamp + 300
        );
    }

    // ============ View Functions ============

    function getPoolKey(uint256 cabalId) external view returns (
        address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks
    ) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        ClankerV4Settings storage c = LibAppStorage.clankerV4Settings();
        
        bool isWeth0 = WETH < cabal.tokenAddress;
        return (
            isWeth0 ? WETH : cabal.tokenAddress,
            isWeth0 ? cabal.tokenAddress : WETH,
            DEFAULT_FEE,
            DEFAULT_TICK_SPACING,
            c.hook
        );
    }

    function hasActivePool(uint256 cabalId) external view returns (bool) {
        CabalData storage cabal = LibAppStorage.getCabalData(cabalId);
        return cabal.phase == CabalPhase.Active && cabal.tokenAddress != address(0);
    }

    // Stub functions to maintain ABI compatibility
    function quoteBuy(uint256, uint256) external pure returns (uint256) {
        return 0;
    }

    function quoteSell(uint256, uint256) external pure returns (uint256) {
        return 0;
    }
    
    // TEMPORARY ADMIN FUNCTION
    function setCabalToken(uint256 cabalId, address token) external {
        LibAppStorage.getCabalData(cabalId).tokenAddress = token;
        LibAppStorage.getCabalData(cabalId).phase = CabalPhase.Active;
    }
    
    receive() external payable {}
}
