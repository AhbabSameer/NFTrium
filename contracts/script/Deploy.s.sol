// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {ImageNFT} from "../src/ImageNFT.sol";
import {NFTMarketplace} from "../src/NFTMarketplace.sol";

/// @notice Deploys ImageNFT and NFTMarketplace.
/// Env (optional): FEE_RECIPIENT (defaults to deployer), FEE_BPS (defaults to 1000 = 10%).
///
///   forge script script/Deploy.s.sol --rpc-url anvil --broadcast \
///     --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///   forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --account <keystore-name>
contract Deploy is Script {
    function run() external returns (ImageNFT nft, NFTMarketplace market) {
        vm.startBroadcast();
        // The broadcasting wallet; `msg.sender` inside a script is Foundry's placeholder default sender.
        (, address deployer,) = vm.readCallers();
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(1000));

        nft = new ImageNFT();
        market = new NFTMarketplace(nft, feeRecipient, feeBps);
        vm.stopBroadcast();

        console.log("ImageNFT:       ", address(nft));
        console.log("NFTMarketplace: ", address(market));
        console.log("Fee recipient:  ", feeRecipient);
        console.log("Fee bps:        ", feeBps);
    }
}
