import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import path from "path";

// Load env from clanker-web
dotenv.config({ path: path.resolve(__dirname, "../clanker-web/.env.local") });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
// Check both RPC_URL and NEXT_PUBLIC_RPC_URL (frontend env var)
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "";

console.log("Using RPC:", RPC_URL.includes("coinbase") ? "Coinbase" : RPC_URL.includes("base.org") ? "Base Public" : "Custom");

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  networks: {
    base: {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
    },
    hardhat: {
      forking: {
        url: RPC_URL,
        enabled: true,
      }
    }
  },
};

export default config;
