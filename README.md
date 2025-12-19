# Clanker SDK v4 Quick Start

This project demonstrates how to use `clanker-sdk` v4 to deploy a token on Base.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Copy `.env.example` to `.env` and fill in your private key and RPC URL (optional, defaults to Base mainnet if not specified in code, but good practice).
    ```bash
    cp .env.example .env
    ```

3.  Run the deployment script:
    ```bash
    npx ts-node src/index.ts
    ```

    *Note: Ensure you have ETH on Base in the wallet associated with the PRIVATE_KEY.*

## Code

The main logic is in `src/index.ts`. It imports `Clanker` from `clanker-sdk/v4` and configuration types/constants from `clanker-sdk`.

