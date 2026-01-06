import { ethers } from "hardhat";

async function main() {
  const errorData = "0x47030148";
  console.log("Decoding error:", errorData);

  // Compute selectors for likely errors
  const errors = [
    "InsufficientBalance()",
    "InsufficientFunds()",
    "InsufficientETH()",
    "InsufficientValue()",
    "NotEnoughValue()",
    "InsufficientLiquidity()",
    "TransferFailed()",
    "CallFailed()",
    "ExecutionFailed()",
    "ModuleCallFailed()",
    "HookCallFailed()",
    "LockerCallFailed()",
    "ExtensionCallFailed()",
    "MevModuleCallFailed()",
    "InvalidHookResult()",
    "InvalidHookResponse()",
    "HookError()",
    "PoolNotInitialized()",
    "PoolAlreadyExists()",
    "InvalidPool()",
    "InvalidPoolKey()",
    "InvalidCurrency()",
    "InvalidTick()",
    "InvalidTickSpacing()",
    "TickMismatch()",
    "TickRangeInvalid()",
    "TickOutOfBounds()",
    "LiquidityPositionError()",
    "PositionNotFound()",
    "InvalidPosition()",
    "InvalidLiquidity()",
    "ZeroLiquidity()",
    "InvalidSwapAmount()",
    "SwapFailed()",
    "InvalidDevBuy()",
    "DevBuyFailed()",
    "InvalidExtensionResult()",
    "InvalidExtensionResponse()",
    "ExtensionError()",
    "InvalidMevResult()",
    "InvalidMevResponse()",
    "MevError()",
    "LockerError()",
    "InvalidLockerResult()",
    "InvalidLockerResponse()",
    "InvalidRewardRecipient()",
    "RewardRecipientError()",
    "InvalidBps()",
    "BpsMismatch()",
    "NotWhitelisted(address)",
    "InvalidHook(address)",
    "InvalidLocker(address)",
    "InvalidMevModule(address)",
    "InvalidExtension(address)",
    "Unauthorized()",
    "NotAuthorized()",
  ];

  for (const name of errors) {
    const selector = ethers.id(name).slice(0, 10);
    if (selector === errorData) {
      console.log(`\n✅ FOUND: ${name}`);
      return;
    }
  }
  
  console.log("\nNot found in common errors. Selector:", errorData);
  console.log("The ASCII content 'G\\x03\\x01H' might be a short revert message");
  
  // Try to interpret as ASCII
  try {
    const bytes = ethers.getBytes(errorData);
    const ascii = String.fromCharCode(...bytes);
    console.log("As ASCII:", ascii);
  } catch {}
}

main().catch(console.error);
