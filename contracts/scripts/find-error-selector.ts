import { ethers } from "hardhat";

const TARGET_SELECTOR = "0x23bba199";

const possibleErrors = [
  // Common Clanker/Uniswap errors
  "InvalidPool()",
  "InvalidHook()",
  "InvalidLocker()",
  "InvalidToken()",
  "InvalidExtension()",
  "InvalidConfig()",
  "InvalidAmount()",
  "InvalidAddress()",
  "InvalidSender()",
  "InvalidRecipient()",
  "InvalidValue()",
  "InsufficientETH()",
  "InsufficientBalance()",
  "InsufficientValue()",
  "InvalidMsgValue()",
  "MsgValueMismatch()",
  "ExtensionMsgValueMismatch()",
  "InvalidExtensionConfig()",
  "InvalidPoolConfig()",
  "InvalidLockerConfig()",
  "InvalidMevConfig()",
  "DevBuyFailed()",
  "DevBuyTooLow()",
  "MinDevBuyNotMet()",
  "MinimumNotMet()",
  "ZeroAmount()",
  "ZeroValue()",
  "ZeroAddress()",
  "Unauthorized()",
  "NotAuthorized()",
  "InvalidCaller()",
  "InvalidOrigin()",
  "CallFailed()",
  "TransferFailed()",
  "SwapFailed()",
  "PoolNotInitialized()",
  "AlreadyDeployed()",
  "TokenExists()",
  "InvalidSymbol()",
  "InvalidName()",
  "InvalidSalt()",
  "PositionError()",
  "InvalidPositions()",
  "InvalidTicks()",
  "InvalidBps()",
  "BpsMismatch()",
  "RewardConfigMismatch()",
  "InvalidRewardConfig()",
  "ArrayLengthMismatch()",
  // From testing
  "MsgValueMismatch(uint256,uint256)",
  "InsufficientMsgValue(uint256,uint256)",
  "ExtensionValueMismatch()",
  "TotalExtensionValueMismatch()",
  // Common ERC patterns  
  "ERC20InsufficientBalance(address,uint256,uint256)",
  "OwnableUnauthorizedAccount(address)",
  "FailedCall()",
  "InsufficientFunds()",
  "InsufficientAllowance()",
];

async function main() {
  console.log("Looking for error selector:", TARGET_SELECTOR);
  console.log("");
  
  for (const errSig of possibleErrors) {
    const selector = ethers.id(errSig).slice(0, 10);
    if (selector === TARGET_SELECTOR) {
      console.log("✅ FOUND:", errSig, "->", selector);
    }
  }
  
  console.log("\n--- Testing specific patterns ---");
  
  // Try computing from common names
  const names = ["MsgValue", "Extension", "DevBuy", "Amount", "Value", "Eth", "Wei"];
  const suffixes = ["Mismatch", "Invalid", "TooLow", "Error", "Failed", "Insufficient"];
  
  for (const name of names) {
    for (const suffix of suffixes) {
      const sig1 = `${name}${suffix}()`;
      const sig2 = `${suffix}${name}()`;
      const sig3 = `Invalid${name}()`;
      
      for (const sig of [sig1, sig2, sig3]) {
        const selector = ethers.id(sig).slice(0, 10);
        if (selector === TARGET_SELECTOR) {
          console.log("✅ FOUND:", sig, "->", selector);
        }
      }
    }
  }
  
  // Brute force some more
  console.log("\nTrying more patterns...");
  const patterns = [
    "ValueMismatch()",
    "ExtensionValueError()",
    "ExtensionMismatch()",
    "InvalidMsgValue()",
    "MsgValueTooLow()",
    "NotEnoughValue()",
    "NotEnoughETH()",
    "ETHMismatch()",
    "DevBuyValueMismatch()",
    "TotalValueMismatch()",
    "SumMismatch()",
    "ValueSumMismatch()",
  ];
  
  for (const sig of patterns) {
    const selector = ethers.id(sig).slice(0, 10);
    if (selector === TARGET_SELECTOR) {
      console.log("✅ FOUND:", sig, "->", selector);
    }
  }
  
  console.log("\nDone searching. If not found, error is custom or uses parameters.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
