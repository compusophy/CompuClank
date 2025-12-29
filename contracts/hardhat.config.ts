import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import path from "path";

// Load env from clanker-web
dotenv.config({ path: path.resolve(__dirname, "../clanker-web/.env.local") });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

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
