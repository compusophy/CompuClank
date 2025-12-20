// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CabalNFT
 * @notice ERC721 representing Cabal ownership. Each NFT corresponds to a Cabal.
 * @dev The Diamond contract owns all NFTs (giving it control over TBAs).
 *      The "logical creator" is tracked in the Diamond's storage.
 */
contract CabalNFT is ERC721, Ownable {
    uint256 private _nextTokenId;

    // Mapping from tokenId to metadata URI (optional, for frontend display)
    mapping(uint256 => string) private _tokenURIs;

    constructor(address initialOwner) ERC721("Cabal", "CABAL") Ownable(initialOwner) {}

    /**
     * @notice Mint a new Cabal NFT to the specified address
     * @param to The address to mint to (usually the Diamond contract)
     * @return tokenId The ID of the newly minted NFT
     */
    function mint(address to) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        return tokenId;
    }

    /**
     * @notice Set the token URI for a Cabal
     * @param tokenId The token ID
     * @param uri The metadata URI
     */
    function setTokenURI(uint256 tokenId, string memory uri) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        _tokenURIs[tokenId] = uri;
    }

    /**
     * @notice Get the token URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        string memory uri = _tokenURIs[tokenId];
        if (bytes(uri).length > 0) {
            return uri;
        }
        
        // Default URI format
        return string(abi.encodePacked("https://cabal.world/api/metadata/", _toString(tokenId)));
    }

    /**
     * @notice Get the total number of Cabals created
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
