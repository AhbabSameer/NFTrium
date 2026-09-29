// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

/// @title ImageNFT
/// @notice Open-mint ERC-721 collection with per-token ERC-2981 royalties paid to the creator.
/// @dev Enumerable so the frontend can list a wallet's tokens without an indexer.
contract ImageNFT is ERC721Enumerable, ERC721URIStorage, ERC2981 {
    /// @notice Maximum creator royalty: 5%.
    uint96 public constant MAX_ROYALTY_BPS = 500;

    uint256 public nextTokenId;

    /// @notice Original minter of each token. Unlike ownership, this never changes.
    mapping(uint256 tokenId => address creator) public creatorOf;
    mapping(address creator => uint256[] tokenIds) private _createdBy;

    event Minted(address indexed creator, uint256 indexed tokenId, string uri, uint96 royaltyBps);

    error RoyaltyTooHigh(uint96 royaltyBps);
    error EmptyURI();

    constructor() ERC721("ImageNFT", "IMGNFT") {}

    /// @notice Mint a token to the caller with `royaltyBps` (out of 10_000) paid to the caller on resales.
    function mint(string calldata uri, uint96 royaltyBps) external returns (uint256 tokenId) {
        if (royaltyBps > MAX_ROYALTY_BPS) revert RoyaltyTooHigh(royaltyBps);
        if (bytes(uri).length == 0) revert EmptyURI();

        tokenId = nextTokenId++;
        creatorOf[tokenId] = msg.sender;
        _createdBy[msg.sender].push(tokenId);
        _setTokenURI(tokenId, uri);
        if (royaltyBps > 0) _setTokenRoyalty(tokenId, msg.sender, royaltyBps);

        emit Minted(msg.sender, tokenId, uri, royaltyBps);
        _safeMint(msg.sender, tokenId);
    }

    /// @notice All token IDs ever minted by `creator`, regardless of current owner.
    function tokensCreatedBy(address creator) external view returns (uint256[] memory) {
        return _createdBy[creator];
    }

    /// @notice All token IDs currently owned by `owner`.
    function tokensOfOwner(address owner) external view returns (uint256[] memory tokenIds) {
        uint256 count = balanceOf(owner);
        tokenIds = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
    }

    // --- Required overrides ---

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 amount) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, amount);
    }
}
