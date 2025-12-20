// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ClankerAddresses
 * @notice Clanker V4 contract addresses on Base mainnet
 * @dev Source: https://github.com/clanker-devco/v4-contracts
 */
library ClankerAddresses {
    // ============ Core Contracts ============
    
    /// @notice Main Clanker factory for token deployment
    address constant CLANKER_FACTORY = 0xE85A59c628F7d27878ACeB4bf3b35733630083a9;
    
    /// @notice Fee locker for collecting LP fees
    address constant CLANKER_FEE_LOCKER = 0xF3622742b1E446D92e45E22923Ef11C2fcD55D68;
    
    /// @notice LP locker for managing LP positions
    address constant CLANKER_LP_LOCKER = 0x29d17C1A8D851d7d4cA97FAe97AcAdb398D9cCE0;
    
    /// @notice Vault contract
    address constant CLANKER_VAULT = 0x8E845EAd15737bF71904A30BdDD3aEE76d6ADF6C;
    
    // ============ Hooks ============
    
    /// @notice Dynamic fee hook for Uniswap V4
    address constant HOOK_DYNAMIC_FEE = 0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC;
    
    /// @notice Static fee hook for Uniswap V4
    address constant HOOK_STATIC_FEE = 0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC;
    
    // ============ Modules ============
    
    /// @notice MEV protection with block delay
    address constant MEV_BLOCK_DELAY = 0xE143f9872A33c955F23cF442BB4B1EFB3A7402A2;
    
    // ============ Extensions ============
    
    /// @notice DevBuy extension for ETH purchases at launch
    address constant DEV_BUY_EXTENSION = 0x1331f0788F9c08C8F38D52c7a1152250A9dE00be;
    
    /// @notice Airdrop extension
    address constant AIRDROP_EXTENSION = 0x56Fa0Da89eD94822e46734e736d34Cab72dF344F;
    
    // ============ Sniper Auction ============
    
    /// @notice Sniper auction contract
    address constant SNIPER_AUCTION = 0xFdc013ce003980889cFfd66b0c8329545ae1d1E8;
    
    /// @notice Sniper utility contract
    address constant SNIPER_UTIL = 0x4E35277306a83D00E13e8C8A4307C672FA31FC99;
    
    // ============ Fee Conversion ============
    
    /// @notice LP locker fee conversion
    address constant LP_LOCKER_FEE_CONVERSION = 0x63D2DfEA64b3433F4071A98665bcD7Ca14d93496;
    
    // ============ Base Network ============
    
    /// @notice WETH on Base
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    /// @notice ERC-6551 Registry on Base
    address constant ERC6551_REGISTRY = 0x000000006551c19487814612e58FE06813775758;
}
