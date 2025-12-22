const { ethers } = require("hardhat");

async function main() {
  const errorNames = [
    "CabalNotActive()",
    "ZeroAmount()",
    "InsufficientBalance()",
    "SwapFailed()",
    "SlippageExceeded()",
    "InvalidToken()",
    "ExecuteFailed()",
    "ExecuteFailed(uint256,bytes)",
    "InvalidCommandType(uint256)",
    "InvalidAction(uint256)",
    "InvalidCaller(address)",
    "PoolNotInitialized(bytes32)",
    "CurrencyNotSettled()",
    "InsufficientOutputReceived()",
    "UnsupportedAction(uint256)",
    "ExecutionFailed(uint256,bytes)",
    "FromAddressIsNotOwner(address)",
    "InsufficientETH()",
    "InsufficientToken()",
    "DeltaNotSettled(address)",
    "InvalidBips()",
    "ActionFailed(bytes)",
    "LockFailure(bytes)",
    "NotPoolManagerToken()",
    "InsufficientBalance()",
    "NotSelf()",
    "ContractLocked()",
    "V4TooMuchRequested()",
    "V4TooLittleReceived()",
    "InvalidSwapType()",
    "InputLengthMismatch()",
    "MinimumAmountInsufficient()",
    "InvalidEthSender()",
    "V4InvalidSwap()",
    "PoolNotInitialized()",
    "V4TooMuchRequested()",
    "V4TooLittleReceived()",
    // 0x3b99b53d
    "DeltaNotSettled()",
    "InvalidCurrency()",
    "InvalidHookResponse()",
    "HookNotImplemented()"
  ];

  for (const name of errorNames) {
    const selector = ethers.keccak256(ethers.toUtf8Bytes(name)).slice(0, 10);
    console.log(`${name}: ${selector}`);
  }
}

main();
