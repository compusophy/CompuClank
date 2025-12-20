// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IClankerFactory {
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

    function deployToken(DeploymentConfig calldata config) external payable returns (address);
}

contract ClankerIndex is Ownable {
    IClankerFactory public clankerFactory;

    struct Deployment {
        address tokenAddress;
        string name;
        string symbol;
        string image;
        uint256 timestamp;
    }

    // User address => their deployments
    mapping(address => Deployment[]) public userDeployments;
    
    // All deployments
    Deployment[] public allDeployments;

    event TokenDeployed(
        address indexed deployer,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 timestamp
    );

    constructor(address _clankerFactory) Ownable(msg.sender) {
        clankerFactory = IClankerFactory(_clankerFactory);
    }

    function deployToken(
        IClankerFactory.DeploymentConfig calldata config
    ) external payable returns (address) {
        // Deploy through Clanker
        address tokenAddress = clankerFactory.deployToken{value: msg.value}(config);

        _recordDeployment(tokenAddress, config.tokenConfig.name, config.tokenConfig.symbol, config.tokenConfig.image, config.tokenConfig.tokenAdmin);

        return tokenAddress;
    }

    function addDeployment(
        address tokenAddress,
        string calldata name,
        string calldata symbol,
        string calldata image,
        address deployer
    ) external onlyOwner {
        _recordDeployment(tokenAddress, name, symbol, image, deployer);
    }

    function _recordDeployment(
        address tokenAddress,
        string memory name,
        string memory symbol,
        string memory image,
        address deployer
    ) internal {
        Deployment memory deployment = Deployment({
            tokenAddress: tokenAddress,
            name: name,
            symbol: symbol,
            image: image,
            timestamp: block.timestamp
        });

        userDeployments[deployer].push(deployment);
        allDeployments.push(deployment);

        emit TokenDeployed(deployer, tokenAddress, name, symbol, block.timestamp);
    }

    // Simple read - no log scanning
    function getUserDeployments(address user) external view returns (Deployment[] memory) {
        return userDeployments[user];
    }

    function getUserDeploymentCount(address user) external view returns (uint256) {
        return userDeployments[user].length;
    }

    function getAllDeployments() external view returns (Deployment[] memory) {
        return allDeployments;
    }

    function getTotalDeployments() external view returns (uint256) {
        return allDeployments.length;
    }

    // Admin functions
    function updateFactory(address _newFactory) external onlyOwner {
        clankerFactory = IClankerFactory(_newFactory);
    }
}
