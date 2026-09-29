// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title NFTMarketplace
/// @notice Fixed-price sales and English auctions for a single ERC-721 collection.
/// @dev Design rules that keep funds safe:
///      - Escrow: a listed/auctioned token is held by this contract, so a seller cannot move it mid-sale.
///      - Pull payments: sellers, creators, the fee recipient and outbid bidders are credited in
///        `pendingWithdrawals` and withdraw themselves; no settlement path depends on a third party
///        accepting ETH.
///      - Tokens leave escrow via `transferFrom`, so a contract bidder without `onERC721Received`
///        cannot block settlement.
///      Pausing blocks new listings, purchases and bids only; cancels, settlements and withdrawals
///      always stay available.
contract NFTMarketplace is Ownable2Step, Pausable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

    uint256 private constant BPS = 10_000;
    uint256 public constant MAX_FEE_BPS = 1_000; // 10%
    uint256 public constant MIN_BID_INCREMENT_BPS = 500; // each bid must beat the previous by 5%
    uint256 public constant MIN_AUCTION_DURATION = 1 hours;
    uint256 public constant MAX_AUCTION_DURATION = 30 days;
    /// @notice A bid placed this close to the end pushes the end back to `now + EXTENSION_WINDOW`.
    uint256 public constant EXTENSION_WINDOW = 10 minutes;

    struct Listing {
        address seller;
        uint256 price;
    }

    struct Auction {
        address seller;
        uint64 endTime;
        address highestBidder;
        uint256 highestBid;
        uint256 reservePrice;
    }

    IERC721 public immutable nft;
    address public feeRecipient;
    uint256 public feeBps;

    mapping(uint256 tokenId => Listing) public listings;
    mapping(uint256 tokenId => Auction) public auctions;
    mapping(address account => uint256 amount) public pendingWithdrawals;

    EnumerableSet.UintSet private _saleIds;
    EnumerableSet.UintSet private _auctionIds;
    mapping(address seller => EnumerableSet.UintSet) private _sellerTokens;

    event Listed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event PriceUpdated(uint256 indexed tokenId, uint256 price);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price);
    event AuctionCreated(
        uint256 indexed tokenId, address indexed seller, uint256 reservePrice, uint64 endTime
    );
    event BidPlaced(uint256 indexed tokenId, address indexed bidder, uint256 amount, uint64 endTime);
    event AuctionSettled(
        uint256 indexed tokenId, address indexed seller, address indexed winner, uint256 amount
    );
    event AuctionCancelled(uint256 indexed tokenId, address indexed seller);
    event Withdrawn(address indexed account, uint256 amount);
    event FeeUpdated(uint256 feeBps);
    event FeeRecipientUpdated(address feeRecipient);

    error NotTokenOwner();
    error NotSeller();
    error NotListed();
    error NotAuctioned();
    error InvalidPrice();
    error InvalidDuration();
    error WrongPayment(uint256 expected);
    error SellerCannotBuy();
    error AuctionEnded();
    error AuctionNotEnded();
    error BidTooLow(uint256 minBid);
    error HasBids();
    error NothingToWithdraw();
    error TransferFailed();
    error FeeTooHigh();
    error ZeroAddress();

    constructor(IERC721 nft_, address feeRecipient_, uint256 feeBps_) Ownable(msg.sender) {
        if (address(nft_) == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        nft = nft_;
        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
    }

    // --- Fixed-price sales ---

    /// @notice Escrow `tokenId` and list it at `price` wei. Requires marketplace approval.
    function list(uint256 tokenId, uint256 price) external whenNotPaused {
        if (price == 0) revert InvalidPrice();
        _escrow(tokenId);

        listings[tokenId] = Listing({seller: msg.sender, price: price});
        _saleIds.add(tokenId);
        _sellerTokens[msg.sender].add(tokenId);

        emit Listed(tokenId, msg.sender, price);
    }

    function updatePrice(uint256 tokenId, uint256 price) external {
        Listing storage listing = listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (listing.seller != msg.sender) revert NotSeller();
        if (price == 0) revert InvalidPrice();

        listing.price = price;
        emit PriceUpdated(tokenId, price);
    }

    function cancelListing(uint256 tokenId) external nonReentrant {
        address seller = listings[tokenId].seller;
        if (seller == address(0)) revert NotListed();
        if (seller != msg.sender) revert NotSeller();

        delete listings[tokenId];
        _saleIds.remove(tokenId);
        _sellerTokens[seller].remove(tokenId);

        nft.transferFrom(address(this), seller, tokenId);
        emit ListingCancelled(tokenId, seller);
    }

    /// @notice Buy a listed token. `msg.value` must equal the listing price exactly.
    function buy(uint256 tokenId) external payable nonReentrant whenNotPaused {
        Listing memory listing = listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (listing.seller == msg.sender) revert SellerCannotBuy();
        if (msg.value != listing.price) revert WrongPayment(listing.price);

        delete listings[tokenId];
        _saleIds.remove(tokenId);
        _sellerTokens[listing.seller].remove(tokenId);

        _distribute(tokenId, listing.seller, listing.price);
        nft.transferFrom(address(this), msg.sender, tokenId);

        emit Sold(tokenId, listing.seller, msg.sender, listing.price);
    }

    // --- Auctions ---

    /// @notice Escrow `tokenId` and open an auction. The first bid must be at least `reservePrice`.
    function createAuction(uint256 tokenId, uint256 reservePrice, uint256 duration) external whenNotPaused {
        if (reservePrice == 0) revert InvalidPrice();
        if (duration < MIN_AUCTION_DURATION || duration > MAX_AUCTION_DURATION) revert InvalidDuration();
        _escrow(tokenId);

        // forge-lint: disable-next-line(unsafe-typecast) -- timestamp + 30 days fits in uint64
        uint64 endTime = uint64(block.timestamp + duration);
        auctions[tokenId] = Auction({
            seller: msg.sender,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0,
            reservePrice: reservePrice
        });
        _auctionIds.add(tokenId);
        _sellerTokens[msg.sender].add(tokenId);

        emit AuctionCreated(tokenId, msg.sender, reservePrice, endTime);
    }

    function bid(uint256 tokenId) external payable nonReentrant whenNotPaused {
        Auction storage auction = auctions[tokenId];
        if (auction.seller == address(0)) revert NotAuctioned();
        if (block.timestamp >= auction.endTime) revert AuctionEnded();
        if (msg.sender == auction.seller) revert SellerCannotBuy();

        uint256 minBid = minNextBid(tokenId);
        if (msg.value < minBid) revert BidTooLow(minBid);

        if (auction.highestBidder != address(0)) {
            pendingWithdrawals[auction.highestBidder] += auction.highestBid;
        }
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;

        if (auction.endTime - block.timestamp < EXTENSION_WINDOW) {
            // forge-lint: disable-next-line(unsafe-typecast) -- timestamp + 10 minutes fits in uint64
            auction.endTime = uint64(block.timestamp + EXTENSION_WINDOW);
        }

        emit BidPlaced(tokenId, msg.sender, msg.value, auction.endTime);
    }

    /// @notice Close an ended auction. Callable by anyone. With no bids, the token returns to the seller.
    function settleAuction(uint256 tokenId) external nonReentrant {
        Auction memory auction = auctions[tokenId];
        if (auction.seller == address(0)) revert NotAuctioned();
        if (block.timestamp < auction.endTime) revert AuctionNotEnded();

        delete auctions[tokenId];
        _auctionIds.remove(tokenId);
        _sellerTokens[auction.seller].remove(tokenId);

        address recipient = auction.highestBidder;
        if (recipient == address(0)) {
            recipient = auction.seller;
        } else {
            _distribute(tokenId, auction.seller, auction.highestBid);
        }
        nft.transferFrom(address(this), recipient, tokenId);

        emit AuctionSettled(tokenId, auction.seller, auction.highestBidder, auction.highestBid);
    }

    /// @notice Seller can withdraw an auction that has received no bids.
    function cancelAuction(uint256 tokenId) external nonReentrant {
        Auction storage auction = auctions[tokenId];
        address seller = auction.seller;
        if (seller == address(0)) revert NotAuctioned();
        if (seller != msg.sender) revert NotSeller();
        if (auction.highestBidder != address(0)) revert HasBids();

        delete auctions[tokenId];
        _auctionIds.remove(tokenId);
        _sellerTokens[seller].remove(tokenId);

        nft.transferFrom(address(this), seller, tokenId);
        emit AuctionCancelled(tokenId, seller);
    }

    // --- Payments ---

    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    // --- Admin ---

    function setFee(uint256 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function setFeeRecipient(address feeRecipient_) external onlyOwner {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Views ---

    /// @notice Smallest amount `bid` will currently accept for `tokenId`.
    function minNextBid(uint256 tokenId) public view returns (uint256) {
        Auction storage auction = auctions[tokenId];
        if (auction.highestBidder == address(0)) return auction.reservePrice;
        uint256 increment = (auction.highestBid * MIN_BID_INCREMENT_BPS) / BPS;
        return auction.highestBid + (increment == 0 ? 1 : increment);
    }

    /// @notice Split of a `price` sale of `tokenId`: platform fee, creator royalty and seller proceeds.
    function quote(uint256 tokenId, uint256 price)
        public
        view
        returns (uint256 fee, address royaltyReceiver, uint256 royalty, uint256 sellerProceeds)
    {
        fee = (price * feeBps) / BPS;
        (royaltyReceiver, royalty) = IERC2981(address(nft)).royaltyInfo(tokenId, price);
        if (royaltyReceiver == address(0)) royalty = 0;
        if (royalty > price - fee) royalty = price - fee;
        sellerProceeds = price - fee - royalty;
    }

    function saleCount() external view returns (uint256) {
        return _saleIds.length();
    }

    function auctionCount() external view returns (uint256) {
        return _auctionIds.length();
    }

    /// @notice Token IDs listed at a fixed price, paginated.
    function getSaleIds(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _page(_saleIds, offset, limit);
    }

    /// @notice Token IDs in auction (including ended but unsettled ones), paginated.
    function getAuctionIds(uint256 offset, uint256 limit) external view returns (uint256[] memory) {
        return _page(_auctionIds, offset, limit);
    }

    /// @notice Token IDs `seller` currently has in escrow (listed or auctioned).
    function tokensListedBy(address seller) external view returns (uint256[] memory) {
        return _sellerTokens[seller].values();
    }

    // --- Internal ---

    function _escrow(uint256 tokenId) private {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        nft.transferFrom(msg.sender, address(this), tokenId);
    }

    function _distribute(uint256 tokenId, address seller, uint256 price) private {
        (uint256 fee, address royaltyReceiver, uint256 royalty, uint256 sellerProceeds) =
            quote(tokenId, price);
        if (fee > 0) pendingWithdrawals[feeRecipient] += fee;
        if (royalty > 0) pendingWithdrawals[royaltyReceiver] += royalty;
        pendingWithdrawals[seller] += sellerProceeds;
    }

    function _page(EnumerableSet.UintSet storage set, uint256 offset, uint256 limit)
        private
        view
        returns (uint256[] memory ids)
    {
        uint256 length = set.length();
        if (offset >= length) return ids;
        uint256 end = offset + limit > length ? length : offset + limit;
        ids = new uint256[](end - offset);
        for (uint256 i; i < ids.length; ++i) {
            ids[i] = set.at(offset + i);
        }
    }
}
