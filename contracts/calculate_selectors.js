const { ethers } = require("ethers");

async function main() {
  const errors = [
    "ExecutionFailed(uint256,bytes)",
    "V4SwapFailed()",
    "PoolNotInitialized()",
    "HookNotInitialized()",
    "SwapAmountTooLarge()",
    "SwapAmountTooSmall()",
    "InvalidToken()",
    "CabalNotActive()",
    "SlippageExceeded()",
    "ZeroAmount()",
    "InsufficientBalance()",
    "InvalidPool()",
    "PoolKeyNotFound()",
    "PoolAlreadyInitialized()",
    "UnlockCallbackFailed()",
    "ProxyError(bytes)",
    "Error(string)",
    "Panic(uint256)"
  ];

  for (const err of errors) {
    console.log(`${err}: ${ethers.id(err).slice(0, 10)}`);
  }
}

main();
