import { ethers } from "hardhat";

// Error selector from the revert
const ERROR_SELECTOR = "0x92e2cf82";

// All possible errors from GovernanceFacet
const ERRORS = [
  "CabalNotActive()",
  "CabalClosed()",
  "ProposalCooldownNotElapsed()",
  "InsufficientVotingPower()",
  "ProposalNotActive()",
  "AlreadyVoted()",
  "ProposalNotSucceeded()",
  "ProposalAlreadyExecuted()",
  "NotProposer()",
  "ExecutionFailed()",
  "ArrayLengthMismatch()",
  "ProposalAlreadyActive()",
  "NotChildCabal()",
  "InvalidTargetCabal()",
];

async function main() {
  console.log("Looking for error selector:", ERROR_SELECTOR);
  console.log("");
  
  for (const error of ERRORS) {
    const selector = ethers.id(error).slice(0, 10);
    const match = selector === ERROR_SELECTOR ? " <<<< MATCH!" : "";
    console.log(`${error}: ${selector}${match}`);
  }
}

main().catch(console.error);
