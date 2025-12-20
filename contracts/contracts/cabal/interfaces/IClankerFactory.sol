// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IClankerFactory
 * @notice Interface for the Clanker V4 token factory
 * @dev Function selector for deployToken must be 0xdf40224a
 */
interface IClankerFactory {
    // ============ Structs ============
    // NOTE: These structs must match the Clanker V4 factory EXACTLY
    // The struct layout determines the function selector

    struct TokenConfig {
        address tokenAdmin;
        string name;
        string symbol;
        bytes32 salt;
        string image;
        string metadata;
        string context;
        uint256 originatingChainId;
    }

    struct PoolConfig {
        address hook;
        address pairedToken;
        int24 tickIfToken0IsClanker;
        int24 tickSpacing;
        bytes poolData;
    }

    struct LockerConfig {
        address locker;
        address[] rewardAdmins;
        address[] rewardRecipients;
        uint16[] rewardBps;
        int24[] tickLower;
        int24[] tickUpper;
        uint16[] positionBps;
        bytes lockerData;
    }

    struct MevModuleConfig {
        address mevModule;
        bytes mevModuleData;
    }

    struct ExtensionConfig {
        address extension;
        uint256 msgValue;
        uint16 extensionBps;
        bytes extensionData;
    }

    struct DeploymentConfig {
        TokenConfig tokenConfig;
        PoolConfig poolConfig;
        LockerConfig lockerConfig;
        MevModuleConfig mevModuleConfig;
        ExtensionConfig[] extensionConfigs;
    }

    struct DeploymentInfo {
        address token;
        address hook;
        address locker;
        address[] extensions;
    }

    // ============ Functions ============

    /// @notice Deploy a new token via Clanker V4
    /// @dev Function selector: 0xdf40224a
    /// @param deploymentConfig The full deployment configuration
    /// @return tokenAddress The address of the newly deployed token
    function deployToken(DeploymentConfig memory deploymentConfig) 
        external 
        payable 
        returns (address tokenAddress);

    function deployTokenZeroSupply(TokenConfig calldata tokenConfig) 
        external 
        returns (address tokenAddress);

    function tokenDeploymentInfo(address token) 
        external 
        view 
        returns (DeploymentInfo memory);

    function deploymentInfoForToken(address token) 
        external 
        view 
        returns (address token_, address hook, address locker);

    function TOKEN_SUPPLY() external view returns (uint256);
    function BPS() external view returns (uint256);
}

