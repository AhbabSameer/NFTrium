// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ImageNFT} from "../src/ImageNFT.sol";
import {NFTMarketplace} from "../src/NFTMarketplace.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @dev Accepts neither ETH nor safe ERC-721 transfers.
contract Hostile {
    function bid(NFTMarketplace market, uint256 tokenId) external payable {
        market.bid{value: msg.value}(tokenId);
    }

    function list(ImageNFT nft, NFTMarketplace market, uint256 tokenId, uint256 price) external {
        nft.approve(address(market), tokenId);
        market.list(tokenId, price);
    }

    function createAuction(ImageNFT nft, NFTMarketplace market, uint256 tokenId) external {
        nft.approve(address(market), tokenId);
        market.createAuction(tokenId, 1 ether, 1 days);
    }
}

contract NFTMarketplaceTest is Test {
    ImageNFT nft;
    NFTMarketplace market;

    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");
    address bidder2 = makeAddr("bidder2");

    uint256 constant FEE_BPS = 1000; // 10%
    uint96 constant ROYALTY_BPS = 500; // 5%

    function setUp() public {
        nft = new ImageNFT();
        market = new NFTMarketplace(nft, treasury, FEE_BPS);

        vm.prank(creator);
        nft.mint("ipfs://token0", ROYALTY_BPS);
        vm.prank(creator);
        nft.transferFrom(creator, seller, 0);

        vm.prank(seller);
        nft.setApprovalForAll(address(market), true);

        vm.deal(buyer, 100 ether);
        vm.deal(bidder2, 100 ether);
    }

    function _list(uint256 price) internal {
        vm.prank(seller);
        market.list(0, price);
    }

    function _auction(uint256 reserve, uint256 duration) internal {
        vm.prank(seller);
        market.createAuction(0, reserve, duration);
    }

    // --- Fixed price ---

    function test_ListEscrowsToken() public {
        _list(1 ether);
        assertEq(nft.ownerOf(0), address(market));
        (address s, uint256 p) = market.listings(0);
        assertEq(s, seller);
        assertEq(p, 1 ether);
        assertEq(market.saleCount(), 1);
        assertEq(market.tokensListedBy(seller)[0], 0);
    }

    function test_BuyDistributesViaPullPayments() public {
        _list(1 ether);

        vm.expectEmit(address(market));
        emit NFTMarketplace.Sold(0, seller, buyer, 1 ether);
        vm.prank(buyer);
        market.buy{value: 1 ether}(0);

        assertEq(nft.ownerOf(0), buyer);
        assertEq(market.pendingWithdrawals(treasury), 0.1 ether);
        assertEq(market.pendingWithdrawals(creator), 0.05 ether);
        assertEq(market.pendingWithdrawals(seller), 0.85 ether);
        assertEq(address(market).balance, 1 ether);
        assertEq(market.saleCount(), 0);
        assertEq(market.tokensListedBy(seller).length, 0);
    }

    function test_RevertWhen_WrongPayment() public {
        _list(1 ether);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(NFTMarketplace.WrongPayment.selector, 1 ether));
        market.buy{value: 1.5 ether}(0);
    }

    function test_RevertWhen_SellerBuysOwn() public {
        _list(1 ether);
        vm.deal(seller, 1 ether);
        vm.prank(seller);
        vm.expectRevert(NFTMarketplace.SellerCannotBuy.selector);
        market.buy{value: 1 ether}(0);
    }

    function test_RevertWhen_ListingNotOwned() public {
        vm.prank(buyer);
        vm.expectRevert(NFTMarketplace.NotTokenOwner.selector);
        market.list(0, 1 ether);
    }

    function test_RevertWhen_ZeroPrice() public {
        vm.prank(seller);
        vm.expectRevert(NFTMarketplace.InvalidPrice.selector);
        market.list(0, 0);
    }

    function test_CancelListingReturnsToken() public {
        _list(1 ether);
        vm.prank(seller);
        market.cancelListing(0);
        assertEq(nft.ownerOf(0), seller);
        assertEq(market.saleCount(), 0);
    }

    function test_RevertWhen_NonSellerCancels() public {
        _list(1 ether);
        vm.prank(buyer);
        vm.expectRevert(NFTMarketplace.NotSeller.selector);
        market.cancelListing(0);
    }

    function test_UpdatePrice() public {
        _list(1 ether);
        vm.prank(seller);
        market.updatePrice(0, 2 ether);
        (, uint256 p) = market.listings(0);
        assertEq(p, 2 ether);
    }

    /// Regression: the old contract let a seller move a listed token away, leaving a stale listing
    /// that blocked the new owner from listing. Escrow makes that impossible.
    function test_Regression_SellerCannotMoveListedToken() public {
        _list(1 ether);
        vm.prank(seller);
        vm.expectRevert();
        nft.transferFrom(seller, buyer, 0);
    }

    // --- Auctions ---

    function test_AuctionHappyPath() public {
        _auction(1 ether, 1 days);
        assertEq(nft.ownerOf(0), address(market));

        vm.prank(buyer);
        market.bid{value: 1 ether}(0);
        vm.prank(bidder2);
        market.bid{value: 1.05 ether}(0);

        // Outbid bidder is credited, not pushed.
        assertEq(market.pendingWithdrawals(buyer), 1 ether);

        vm.warp(block.timestamp + 1 days);
        market.settleAuction(0);

        assertEq(nft.ownerOf(0), bidder2);
        assertEq(market.pendingWithdrawals(treasury), 0.105 ether);
        assertEq(market.pendingWithdrawals(creator), 0.0525 ether);
        assertEq(market.pendingWithdrawals(seller), 0.8925 ether);
        assertEq(market.auctionCount(), 0);
    }

    /// Regression: the old contract accepted first bids below the reserve.
    function test_Regression_FirstBidMustMeetReserve() public {
        _auction(1 ether, 1 days);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(NFTMarketplace.BidTooLow.selector, 1 ether));
        market.bid{value: 0.99 ether}(0);
    }

    function test_RevertWhen_BidBelowIncrement() public {
        _auction(1 ether, 1 days);
        vm.prank(buyer);
        market.bid{value: 1 ether}(0);
        vm.prank(bidder2);
        vm.expectRevert(abi.encodeWithSelector(NFTMarketplace.BidTooLow.selector, 1.05 ether));
        market.bid{value: 1.04 ether}(0);
    }

    function test_RevertWhen_SellerBids() public {
        _auction(1 ether, 1 days);
        vm.deal(seller, 2 ether);
        vm.prank(seller);
        vm.expectRevert(NFTMarketplace.SellerCannotBuy.selector);
        market.bid{value: 1 ether}(0);
    }

    function test_RevertWhen_BidAfterEnd() public {
        _auction(1 ether, 1 days);
        vm.warp(block.timestamp + 1 days);
        vm.prank(buyer);
        vm.expectRevert(NFTMarketplace.AuctionEnded.selector);
        market.bid{value: 1 ether}(0);
    }

    function test_LateBidExtendsAuction() public {
        _auction(1 ether, 1 hours);
        (, uint64 end,,,) = market.auctions(0);

        vm.warp(end - 1 minutes);
        vm.prank(buyer);
        market.bid{value: 1 ether}(0);

        (, uint64 newEnd,,,) = market.auctions(0);
        assertEq(newEnd, block.timestamp + market.EXTENSION_WINDOW());
    }

    function test_EarlyBidDoesNotExtend() public {
        _auction(1 ether, 1 hours);
        (, uint64 end,,,) = market.auctions(0);
        vm.prank(buyer);
        market.bid{value: 1 ether}(0);
        (, uint64 newEnd,,,) = market.auctions(0);
        assertEq(newEnd, end);
    }

    function test_RevertWhen_SettleBeforeEnd() public {
        _auction(1 ether, 1 days);
        vm.expectRevert(NFTMarketplace.AuctionNotEnded.selector);
        market.settleAuction(0);
    }

    function test_SettleWithoutBidsReturnsToken() public {
        _auction(1 ether, 1 days);
        vm.warp(block.timestamp + 1 days);
        market.settleAuction(0);
        assertEq(nft.ownerOf(0), seller);
        assertEq(address(market).balance, 0);
    }

    /// Regression: ended-but-unsettled auctions used to vanish from the active list.
    function test_Regression_EndedAuctionStaysDiscoverable() public {
        _auction(1 ether, 1 days);
        vm.warp(block.timestamp + 2 days);
        uint256[] memory ids = market.getAuctionIds(0, 10);
        assertEq(ids.length, 1);
        assertEq(ids[0], 0);
    }

    function test_CancelAuctionWithoutBids() public {
        _auction(1 ether, 1 days);
        vm.prank(seller);
        market.cancelAuction(0);
        assertEq(nft.ownerOf(0), seller);
    }

    function test_RevertWhen_CancelAuctionWithBids() public {
        _auction(1 ether, 1 days);
        vm.prank(buyer);
        market.bid{value: 1 ether}(0);
        vm.prank(seller);
        vm.expectRevert(NFTMarketplace.HasBids.selector);
        market.cancelAuction(0);
    }

    function test_RevertWhen_InvalidDuration() public {
        vm.startPrank(seller);
        vm.expectRevert(NFTMarketplace.InvalidDuration.selector);
        market.createAuction(0, 1 ether, 59 minutes);
        vm.expectRevert(NFTMarketplace.InvalidDuration.selector);
        market.createAuction(0, 1 ether, 31 days);
        vm.stopPrank();
    }

    /// Regression: a winning bidder contract without onERC721Received used to make finalize revert
    /// forever, locking the bid. `transferFrom` delivery means settlement always succeeds.
    function test_Regression_HostileBidderCannotBlockSettlement() public {
        Hostile hostile = new Hostile();
        _auction(1 ether, 1 days);
        hostile.bid{value: 1 ether}(market, 0);

        vm.warp(block.timestamp + 1 days);
        market.settleAuction(0);
        assertEq(nft.ownerOf(0), address(hostile));
        assertEq(market.pendingWithdrawals(seller), 0.85 ether);
    }

    /// Regression: a seller that rejected ETH used to make finalize revert. Pull payments isolate it.
    function test_Regression_EthRejectingSellerCannotBlockSettlement() public {
        Hostile hostileSeller = new Hostile();
        vm.prank(seller);
        nft.transferFrom(seller, address(hostileSeller), 0);
        hostileSeller.createAuction(nft, market, 0);

        vm.prank(buyer);
        market.bid{value: 1 ether}(0);
        vm.warp(block.timestamp + 1 days);
        market.settleAuction(0);

        assertEq(nft.ownerOf(0), buyer);
        assertEq(market.pendingWithdrawals(address(hostileSeller)), 0.85 ether);
    }

    // --- Withdrawals ---

    function test_Withdraw() public {
        _list(1 ether);
        vm.prank(buyer);
        market.buy{value: 1 ether}(0);

        uint256 before = seller.balance;
        vm.prank(seller);
        market.withdraw();
        assertEq(seller.balance - before, 0.85 ether);
        assertEq(market.pendingWithdrawals(seller), 0);
    }

    function test_RevertWhen_NothingToWithdraw() public {
        vm.expectRevert(NFTMarketplace.NothingToWithdraw.selector);
        market.withdraw();
    }

    function test_RevertWhen_DirectEthTransfer() public {
        vm.prank(buyer);
        (bool ok,) = address(market).call{value: 1 ether}("");
        assertFalse(ok);
    }

    // --- Admin ---

    function test_PauseBlocksNewActivityButNotExits() public {
        _list(1 ether);
        market.pause();

        vm.prank(buyer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        market.buy{value: 1 ether}(0);

        vm.prank(seller);
        market.cancelListing(0);
        assertEq(nft.ownerOf(0), seller);
    }

    function test_SetFee() public {
        market.setFee(250);
        assertEq(market.feeBps(), 250);
        vm.expectRevert(NFTMarketplace.FeeTooHigh.selector);
        market.setFee(1001);
    }

    function test_RevertWhen_NonOwnerAdmin() public {
        vm.prank(buyer);
        vm.expectRevert();
        market.setFee(0);
    }

    // --- Views ---

    function test_Pagination() public {
        vm.startPrank(creator);
        for (uint256 i; i < 5; ++i) {
            nft.mint("ipfs://x", 0);
        }
        nft.setApprovalForAll(address(market), true);
        for (uint256 i = 1; i <= 5; ++i) {
            market.list(i, 1 ether);
        }
        vm.stopPrank();

        assertEq(market.getSaleIds(0, 2).length, 2);
        assertEq(market.getSaleIds(4, 10).length, 1);
        assertEq(market.getSaleIds(5, 10).length, 0);
    }

    // --- Fuzz ---

    function testFuzz_QuoteConservesValue(uint256 price, uint256 feeBps) public {
        price = bound(price, 0, 1e30);
        feeBps = bound(feeBps, 0, market.MAX_FEE_BPS());
        market.setFee(feeBps);

        (uint256 fee,, uint256 royalty, uint256 proceeds) = market.quote(0, price);
        assertEq(fee + royalty + proceeds, price);
    }

    function testFuzz_BuyConservesValue(uint256 price) public {
        price = bound(price, 1, 100 ether);
        _list(price);
        vm.prank(buyer);
        market.buy{value: price}(0);

        uint256 credited = market.pendingWithdrawals(treasury) + market.pendingWithdrawals(creator)
            + market.pendingWithdrawals(seller);
        assertEq(credited, price);
        assertEq(address(market).balance, price);
    }

    function testFuzz_MinNextBidAlwaysIncreases(uint256 firstBid) public {
        firstBid = bound(firstBid, 1, 50 ether);
        _auction(1, 1 days);
        vm.prank(buyer);
        market.bid{value: firstBid}(0);
        assertGt(market.minNextBid(0), firstBid);
    }
}
