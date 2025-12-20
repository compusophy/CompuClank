// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/**
 * @title IERC6551Account
 * @notice Interface for ERC-6551 Token Bound Accounts
 */
interface IERC6551Account {
    receive() external payable;

    function token()
        external
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId);

    function state() external view returns (uint256);

    function isValidSigner(address signer, bytes calldata context)
        external
        view
        returns (bytes4 magicValue);
}

/**
 * @title IERC6551Executable
 * @notice Interface for executing calls from TBA
 */
interface IERC6551Executable {
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        payable
        returns (bytes memory);
}

/**
 * @title CabalTBA
 * @notice Token Bound Account for Cabal treasuries
 * @dev Implements ERC-6551 account interface. Controlled by whoever owns the NFT.
 *      In CABAL's case, the Diamond owns all NFTs, so it controls all TBAs.
 */
contract CabalTBA is IERC165, IERC6551Account, IERC6551Executable, IERC721Receiver, IERC1155Receiver {
    uint256 private _state;

    // ERC-6551 magic values
    bytes4 constant ERC6551_MAGIC_VALUE = 0x523e3260;

    error NotAuthorized();
    error InvalidOperation();

    receive() external payable override {}

    /**
     * @notice Execute a call from this account
     * @param to Target address
     * @param value ETH value to send
     * @param data Calldata
     * @param operation Operation type (0 = call, 1 = delegatecall - we only support call)
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external payable override returns (bytes memory result) {
        if (!_isValidSigner(msg.sender)) revert NotAuthorized();
        if (operation != 0) revert InvalidOperation(); // Only CALL supported

        _state++;

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @notice Simplified execute for Diamond (no operation param)
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        if (!_isValidSigner(msg.sender)) revert NotAuthorized();

        _state++;

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * @notice Get the token this account is bound to
     */
    function token() public view override returns (uint256 chainId, address tokenContract, uint256 tokenId) {
        bytes memory footer = new bytes(0x60);
        
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }

        return abi.decode(footer, (uint256, address, uint256));
    }

    /**
     * @notice Get the account state (incremented on each execution)
     */
    function state() external view override returns (uint256) {
        return _state;
    }

    /**
     * @notice Check if an address is a valid signer
     */
    function isValidSigner(address signer, bytes calldata) external view override returns (bytes4) {
        if (_isValidSigner(signer)) {
            return ERC6551_MAGIC_VALUE;
        }
        return bytes4(0);
    }

    /**
     * @notice Get the owner of this account (owner of the bound NFT)
     */
    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        
        if (chainId != block.chainid) return address(0);

        return IERC721(tokenContract).ownerOf(tokenId);
    }

    function _isValidSigner(address signer) internal view returns (bool) {
        return signer == owner();
    }

    // ============ Token Receiver Interfaces ============

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC6551Executable).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1155Receiver).interfaceId;
    }
}
