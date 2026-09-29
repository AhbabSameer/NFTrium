// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {ImageNFT} from "../src/ImageNFT.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

contract ImageNFTTest is Test {
    ImageNFT nft;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        nft = new ImageNFT();
    }

    function test_Mint() public {
        vm.expectEmit(address(nft));
        emit ImageNFT.Minted(alice, 0, "ipfs://a", 250);
        vm.prank(alice);
        uint256 id = nft.mint("ipfs://a", 250);

        assertEq(id, 0);
        assertEq(nft.ownerOf(0), alice);
        assertEq(nft.tokenURI(0), "ipfs://a");
        assertEq(nft.creatorOf(0), alice);
        assertEq(nft.nextTokenId(), 1);
    }

    function test_RoyaltyInfoPaysCreatorAfterTransfer() public {
        vm.prank(alice);
        nft.mint("ipfs://a", 500);
        vm.prank(alice);
        nft.transferFrom(alice, bob, 0);

        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, alice);
        assertEq(amount, 0.05 ether);
    }

    function test_ZeroRoyalty() public {
        vm.prank(alice);
        nft.mint("ipfs://a", 0);
        (address receiver, uint256 amount) = nft.royaltyInfo(0, 1 ether);
        assertEq(receiver, address(0));
        assertEq(amount, 0);
    }

    function test_RevertWhen_RoyaltyTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(ImageNFT.RoyaltyTooHigh.selector, 501));
        nft.mint("ipfs://a", 501);
    }

    function test_RevertWhen_EmptyURI() public {
        vm.expectRevert(ImageNFT.EmptyURI.selector);
        nft.mint("", 0);
    }

    function test_CreatedAndOwnedTracking() public {
        vm.startPrank(alice);
        nft.mint("ipfs://a", 0);
        nft.mint("ipfs://b", 0);
        nft.transferFrom(alice, bob, 0);
        vm.stopPrank();

        uint256[] memory created = nft.tokensCreatedBy(alice);
        assertEq(created.length, 2);

        uint256[] memory aliceOwned = nft.tokensOfOwner(alice);
        uint256[] memory bobOwned = nft.tokensOfOwner(bob);
        assertEq(aliceOwned.length, 1);
        assertEq(aliceOwned[0], 1);
        assertEq(bobOwned.length, 1);
        assertEq(bobOwned[0], 0);
    }

    function test_SupportsInterfaces() public view {
        assertTrue(nft.supportsInterface(type(IERC2981).interfaceId));
        assertTrue(nft.supportsInterface(type(IERC721Enumerable).interfaceId));
        assertTrue(nft.supportsInterface(0x49064906)); // ERC-4906 metadata updates
    }
}
