import { Clanker } from 'clanker-sdk/v4';
import { ClankerTokenV4, POOL_POSITIONS, FEE_CONFIGS } from 'clanker-sdk';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY is not defined in .env');
    }

    // Viem setup
    const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
    const client = createPublicClient({ 
        chain: base, 
        transport: http(process.env.RPC_URL) 
    });
    const wallet = createWalletClient({ 
        account, 
        chain: base, 
        transport: http(process.env.RPC_URL) 
    });

    // Initialize the SDK
    const clanker = new Clanker({ 
        publicClient: client as any, 
        wallet: wallet as any 
    });

    // Example Addresses (Replace with real ones for production)
    const MY_EOA = account.address;
    const MY_MULTISIG = account.address; // Placeholder
    const FRIEND_EOA = account.address; // Placeholder
    const FRIEND_MULTISIG = account.address; // Placeholder
    const CREATOR_REWARD_ADDRESS = account.address;
    const CREATOR_ADMIN_ADDRESS = account.address;
    const INTERFACE_REWARD_ADDRESS = account.address;
    const INTERFACE_ADMIN_ADDRESS = account.address;
    const VAULT_ALLOCATION_RECIPIENT_ADDRESS = account.address;

    console.log('Deploying token...');

    try {
        // Deploy the token
        const { waitForTransaction, error } = await clanker.deploy({
            name: "My Cool Project Coin",
            symbol: "MCPC",
            tokenAdmin: account.address,
            image: 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
            metadata: {
                description: 'Token with custom configuration including vesting and rewards',
                socialMediaUrls: [],
                auditUrls: [],
            },
            context: {
                interface: 'Clanker SDK',
                platform: 'farcaster', // Example
                messageId: '0x...', // Example
                id: '123', // Example
            },
            pool: {
                positions: POOL_POSITIONS.Project,
            },
            fees: FEE_CONFIGS.DynamicBasic,
            rewards: {
                recipients: [
                    {
                        recipient: MY_EOA,
                        admin: MY_MULTISIG,
                        // In bps. 80% of reward
                        bps: 8_000,
                        token: "Paired",
                    },
                    {
                        recipient: FRIEND_EOA,
                        admin: FRIEND_MULTISIG,
                        // In bps. 20% of reward
                        bps: 2_000,
                        token: "Both",
                    },
                ]
            },
            vault: {
                percentage: 10, // 10% of token supply, up to 90%
                lockupDuration: 2592000, // 30 days in seconds, min of 7 days
                vestingDuration: 2592000, // 30 days in seconds, can be 0
                recipient: VAULT_ALLOCATION_RECIPIENT_ADDRESS // optional, defaults to tokenAdmin
            },
            devBuy: {
                ethAmount: 0.0001, // Small amount for testing
            },
            vanity: true,
        });

        if (error) throw error;

        const result = await waitForTransaction();
        if (!result) {
            throw new Error('Transaction failed or returned no result');
        }
        
        // Check if result has address (success) or is an error
        // The type definition might return an error or object with address
        // Based on docs: "This also may return an error, or the address of the token on success."
        if ('address' in result) {
             const { address } = result;
             console.log(`Token deployed at: ${address}`);
             console.log(`View on Clanker World: https://clanker.world/clanker/${address}`);
        } else {
             console.error('Deployment failed:', result);
        }

    } catch (err) {
        console.error('Error during deployment:', err);
    }
}

main();

