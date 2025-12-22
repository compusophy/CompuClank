// Uniswap V4 Universal Router on Base
export const UNIVERSAL_ROUTER_ADDRESS = '0x6fF5693b99212Da76ad316178A184AB56D299b43' as const;
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;
export const WETH_ADDRESS = '0x4200000000000000000000000000000000000006' as const;

// Uniswap V4 PoolManager on Base  
export const POOL_MANAGER_ADDRESS = '0x498581fF718922c3f8e6A244956aF099B2652b2b' as const;

// Clanker Hooks
export const CLANKER_DYNAMIC_FEE_HOOK = '0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC' as const;
export const CLANKER_STATIC_FEE_HOOK = '0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC' as const;

// V4 Swap Router (simplified interface for single swaps)
export const V4_SWAP_ROUTER_ABI = [
  {
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'hookData', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [{ name: 'delta', type: 'int256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// Universal Router command types for V4
export enum UniversalRouterCommands {
  V4_SWAP = 0x10,
  WRAP_ETH = 0x0b,
  UNWRAP_WETH = 0x0c,
  PERMIT2_PERMIT = 0x0a,
}

// Universal Router ABI (simplified)
export const UNIVERSAL_ROUTER_ABI = [
  {
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// Quoter V2 for getting swap quotes
export const QUOTER_ADDRESS = '0x0d5e0F971ED27FBfF6c2837bf31316121532048D' as const;

export const QUOTER_ABI = [
  {
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'exactCurrency', type: 'address' },
          { name: 'path', type: 'bytes' },
          { name: 'exactAmount', type: 'uint128' },
        ],
      },
    ],
    name: 'quoteExactInput',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          {
            name: 'poolKey',
            type: 'tuple',
            components: [
              { name: 'currency0', type: 'address' },
              { name: 'currency1', type: 'address' },
              { name: 'fee', type: 'uint24' },
              { name: 'tickSpacing', type: 'int24' },
              { name: 'hooks', type: 'address' },
            ],
          },
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Helper to construct PoolKey for Clanker tokens
// Clanker tokens are always paired with WETH
// currency0 is always the lower address
export function getPoolKey(tokenAddress: `0x${string}`, hookAddress: `0x${string}` = CLANKER_STATIC_FEE_HOOK) {
  const weth = WETH_ADDRESS.toLowerCase();
  const token = tokenAddress.toLowerCase();
  
  const isWethCurrency0 = weth < token;
  
  return {
    currency0: (isWethCurrency0 ? WETH_ADDRESS : tokenAddress) as `0x${string}`,
    currency1: (isWethCurrency0 ? tokenAddress : WETH_ADDRESS) as `0x${string}`,
    fee: 10000, // 1% fee (Clanker default)
    tickSpacing: 200, // Clanker default tick spacing
    hooks: hookAddress,
  };
}

// Determine swap direction
export function getSwapDirection(tokenAddress: `0x${string}`, isBuy: boolean) {
  const weth = WETH_ADDRESS.toLowerCase();
  const token = tokenAddress.toLowerCase();
  const isWethCurrency0 = weth < token;
  
  // zeroForOne = true means swapping currency0 for currency1
  // For BUY (ETH → Token): if WETH is currency0, zeroForOne = true
  // For SELL (Token → ETH): if WETH is currency0, zeroForOne = false
  
  if (isBuy) {
    return isWethCurrency0; // true if WETH is currency0
  } else {
    return !isWethCurrency0; // true if Token is currency0
  }
}
