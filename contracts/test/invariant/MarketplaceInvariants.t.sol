// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ImageNFT} from "../../src/ImageNFT.sol";
import {NFTMarketplace} from "../../src/NFTMarketplace.sol";

/// @dev Drives the marketplace with random but mostly-valid actions from a fixed set of actors.
contract Handler is Test {
    ImageNFT public nft;
    NFTMarketplace public market;
    address[] public actors;

    constructor(ImageNFT nft_, NFTMarketplace market_) {
        nft = nft_;
        market = market_;
        for (uint256 i; i < 4; ++i) {
            address actor = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(actor);
            vm.deal(actor, 1_000 ether);
            vm.prank(actor);
            nft.setApprovalForAll(address(market), true);
        }
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _token(uint256 seed) internal view returns (uint256) {
        uint256 supply = nft.nextTokenId();
        return supply == 0 ? 0 : seed % supply;
    }

    function mint(uint256 actorSeed, uint96 royalty) external {
        vm.prank(_actor(actorSeed));
        nft.mint("ipfs://x", uint96(bound(royalty, 0, 500)));
    }

    function list(uint256 tokenSeed, uint256 price) external {
        uint256 id = _token(tokenSeed);
        if (nft.nextTokenId() == 0) return;
        address owner = nft.ownerOf(id);
        // Escrowed tokens are owned by the market, which can never be an external caller.
        if (owner == address(market)) return;
        vm.prank(owner);
        market.list(id, bound(price, 1, 10 ether));
    }

    function buy(uint256 actorSeed, uint256 tokenSeed) external {
        uint256 id = _token(tokenSeed);
        (, uint256 price) = market.listings(id);
        vm.prank(_actor(actorSeed));
        market.buy{value: price}(id);
    }

    function createAuction(uint256 tokenSeed, uint256 reserve, uint256 duration) external {
        uint256 id = _token(tokenSeed);
        if (nft.nextTokenId() == 0) return;
        address owner = nft.ownerOf(id);
        // Escrowed tokens are owned by the market, which can never be an external caller.
        if (owner == address(market)) return;
        vm.prank(owner);
        market.createAuction(id, bound(reserve, 1, 10 ether), bound(duration, 1 hours, 30 days));
    }

    function bid(uint256 actorSeed, uint256 tokenSeed, uint256 extra) external {
        uint256 id = _token(tokenSeed);
        uint256 amount = market.minNextBid(id) + bound(extra, 0, 1 ether);
        vm.prank(_actor(actorSeed));
        market.bid{value: amount}(id);
    }

    function settle(uint256 tokenSeed) external {
        market.settleAuction(_token(tokenSeed));
    }

    function cancelListing(uint256 tokenSeed) external {
        uint256 id = _token(tokenSeed);
        (address seller,) = market.listings(id);
        vm.prank(seller);
        market.cancelListing(id);
    }

    function cancelAuction(uint256 tokenSeed) external {
        uint256 id = _token(tokenSeed);
        (address seller,,,,) = market.auctions(id);
        vm.prank(seller);
        market.cancelAuction(id);
    }

    function withdraw(uint256 actorSeed) external {
        vm.prank(_actor(actorSeed));
        market.withdraw();
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 3 days));
    }
}

contract MarketplaceInvariants is Test {
    ImageNFT nft;
    NFTMarketplace market;
    Handler handler;
    address treasury = makeAddr("treasury");

    function setUp() public {
        nft = new ImageNFT();
        market = new NFTMarketplace(nft, treasury, 1000);
        handler = new Handler(nft, market);
        targetContract(address(handler));
    }

    /// The contract always holds exactly what it owes: credited withdrawals plus live highest bids.
    function invariant_SolventExactly() public view {
        uint256 owed = market.pendingWithdrawals(treasury);
        for (uint256 i; i < handler.actorCount(); ++i) {
            owed += market.pendingWithdrawals(handler.actors(i));
        }
        uint256[] memory auctionIds = market.getAuctionIds(0, type(uint256).max);
        for (uint256 i; i < auctionIds.length; ++i) {
            (,,, uint256 highestBid,) = market.auctions(auctionIds[i]);
            owed += highestBid;
        }
        assertEq(address(market).balance, owed);
    }

    /// Every active listing/auction is backed by a token in escrow, and nothing else is escrowed.
    function invariant_EscrowMatchesActiveSets() public view {
        uint256[] memory saleIds = market.getSaleIds(0, type(uint256).max);
        uint256[] memory auctionIds = market.getAuctionIds(0, type(uint256).max);
        for (uint256 i; i < saleIds.length; ++i) {
            assertEq(nft.ownerOf(saleIds[i]), address(market));
        }
        for (uint256 i; i < auctionIds.length; ++i) {
            assertEq(nft.ownerOf(auctionIds[i]), address(market));
        }
        assertEq(nft.balanceOf(address(market)), saleIds.length + auctionIds.length);
    }
}
