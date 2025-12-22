// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISwapFacet
 * @notice Interface for the SwapFacet - Uniswap V4 token swaps
 */
interface ISwapFacet {
    // ============ Events ============
    
    event TokensBought(
        uint256 indexed cabalId,
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokensReceived
    );
    
    event TokensSold(
        uint256 indexed cabalId,
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethReceived
    );

    // ============ Errors ============
    
    error CabalNotActive();
    error ZeroAmount();
    error InsufficientBalance();
    error SwapFailed();
    error SlippageExceeded();
    error InvalidToken();

    // ============ Buy/Sell Functions ============

    /**
     * @notice Buy Cabal tokens with ETH
     * @param cabalId The Cabal to buy tokens from
     * @param minAmountOut Minimum tokens to receive (slippage protection)
     * @return amountOut The amount of tokens received
     */
    function buyTokens(
        uint256 cabalId,
        uint256 minAmountOut
    ) external payable returns (uint256 amountOut);

    /**
     * @notice Buy Cabal tokens with ETH, passing custom hook data
     * @param cabalId The Cabal to buy tokens from
     * @param minAmountOut Minimum tokens to receive (slippage protection)
     * @param hookData Custom data to pass to the pool's hook contract (beforeSwap/afterSwap)
     * @return amountOut The amount of tokens received
     */
    function buyTokensWithHookData(
        uint256 cabalId,
        uint256 minAmountOut,
        bytes calldata hookData
    ) external payable returns (uint256 amountOut);

    /**
     * @notice Sell Cabal tokens for ETH
     * @param cabalId The Cabal to sell tokens from
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH to receive (slippage protection)
     * @return ethOut The amount of ETH received
     */
    function sellTokens(
        uint256 cabalId,
        uint256 tokenAmount,
        uint256 minEthOut
    ) external returns (uint256 ethOut);

    /**
     * @notice Sell Cabal tokens for ETH, passing custom hook data
     * @param cabalId The Cabal to sell tokens from
     * @param tokenAmount Amount of tokens to sell
     * @param minEthOut Minimum ETH to receive (slippage protection)
     * @param hookData Custom data to pass to the pool's hook contract (beforeSwap/afterSwap)
     * @return ethOut The amount of ETH received
     */
    function sellTokensWithHookData(
        uint256 cabalId,
        uint256 tokenAmount,
        uint256 minEthOut,
        bytes calldata hookData
    ) external returns (uint256 ethOut);

    // ============ Quote Functions ============

    /**
     * @notice Get a quote for buying tokens with ETH
     * @param cabalId The Cabal to get quote for
     * @param ethAmount Amount of ETH to spend
     * @return tokenAmount Expected tokens to receive
     */
    function quoteBuy(uint256 cabalId, uint256 ethAmount) external returns (uint256 tokenAmount);

    /**
     * @notice Get a quote for selling tokens
     * @param cabalId The Cabal to get quote for
     * @param tokenAmount Amount of tokens to sell
     * @return ethAmount Expected ETH to receive
     */
    function quoteSell(uint256 cabalId, uint256 tokenAmount) external returns (uint256 ethAmount);

    // ============ View Functions ============

    /**
     * @notice Get the pool key for a Cabal's token
     * @param cabalId The Cabal ID
     * @return currency0 First token in the pool
     * @return currency1 Second token in the pool
     * @return fee Pool fee in hundredths of a bip
     * @return tickSpacing Tick spacing for the pool
     * @return hooks Hook contract address
     */
    function getPoolKey(uint256 cabalId) external view returns (
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        address hooks
    );

    /**
     * @notice Check if a cabal has an active trading pool
     * @param cabalId The Cabal ID
     * @return hasPool Whether the cabal has an active pool
     */
    function hasActivePool(uint256 cabalId) external view returns (bool hasPool);
}
