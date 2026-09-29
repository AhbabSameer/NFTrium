// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ImageNFT} from "../src/ImageNFT.sol";
import {NFTMarketplace} from "../src/NFTMarketplace.sol";

/// @notice Mints the sample collection from script/seed-manifest.json (written by
/// scripts/seed/upload.mjs) and lists or auctions each piece as the manifest says.
///
///   forge script script/Seed.s.sol --rpc-url sepolia --account sepolia-deployer --broadcast
///
/// Env (optional): NFT, MARKET to override the default Sepolia addresses.
contract Seed is Script {
    // Manifest modes: 0 = keep in the wallet, 1 = list for sale, 2 = auction.
    uint256 constant SALE = 1;
    uint256 constant AUCTION = 2;

    function run() external {
        ImageNFT nft = ImageNFT(vm.envOr("NFT", address(0xF4eBc0433626433A15D51Ba3A7Ab4b05CAFfC79C)));
        NFTMarketplace market =
            NFTMarketplace(vm.envOr("MARKET", address(0x338992Aa1eA01A0E02B7411245A8fE4eE1307d53)));

        // forge-lint: disable-next-line(unsafe-cheatcode) -- reads our own manifest
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/script/seed-manifest.json"));
        string[] memory uris = vm.parseJsonStringArray(json, ".uris");
        uint256[] memory modes = vm.parseJsonUintArray(json, ".modes");
        uint256[] memory prices = vm.parseJsonUintArray(json, ".prices");
        uint256[] memory durations = vm.parseJsonUintArray(json, ".durations");
        // forge-lint: disable-next-line(unsafe-typecast) -- royalty is at most 500
        uint96 royaltyBps = uint96(vm.parseJsonUint(json, ".royaltyBps"));

        uint256 sales;
        uint256 auctions;
        vm.startBroadcast();
        (, address seller,) = vm.readCallers();
        if (!nft.isApprovedForAll(seller, address(market))) nft.setApprovalForAll(address(market), true);

        for (uint256 i; i < uris.length; ++i) {
            uint256 tokenId = nft.mint(uris[i], royaltyBps);
            if (modes[i] == SALE) {
                market.list(tokenId, prices[i]);
                ++sales;
            } else if (modes[i] == AUCTION) {
                market.createAuction(tokenId, prices[i], durations[i]);
                ++auctions;
            }
        }
        vm.stopBroadcast();

        console.log("Seller:   ", seller);
        console.log("Minted:   ", uris.length);
        console.log("For sale: ", sales);
        console.log("Auctions: ", auctions);
        console.log("Held:     ", uris.length - sales - auctions);
    }
}
