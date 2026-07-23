// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../src/PrintToken.sol";

interface Vm {
    function prank(address) external;
    function expectRevert(bytes calldata) external;
}

contract PrintTokenTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant TREASURY = 0x7305670d6380331b89bf2404992eC310896935b3;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    PrintToken t;

    function setUp() public {
        vm.prank(alice);
        t = new PrintToken("Test Print", "TPRINT", 1_000_000e18);
    }

    function testSupplyMintedToDeployer() public view {
        require(t.totalSupply() == 1_000_000e18, "supply");
        require(t.balanceOf(alice) == 1_000_000e18, "deployer bal");
        require(t.decimals() == 18, "decimals");
    }

    function testTransferTakesOnePercent() public {
        vm.prank(alice);
        t.transfer(bob, 100e18);
        require(t.balanceOf(bob) == 99e18, "bob net 99");
        require(t.balanceOf(TREASURY) == 1e18, "treasury 1");
        require(t.balanceOf(alice) == 1_000_000e18 - 100e18, "alice debited full");
    }

    function testTreasuryMovesFeeFree() public {
        vm.prank(alice);
        t.transfer(TREASURY, 100e18);
        require(t.balanceOf(TREASURY) == 100e18, "to treasury: no fee");
        vm.prank(TREASURY);
        t.transfer(bob, 50e18);
        require(t.balanceOf(bob) == 50e18, "from treasury: no fee");
    }

    function testTransferFromRespectsAllowanceAndFee() public {
        vm.prank(alice);
        t.approve(bob, 200e18);
        vm.prank(bob);
        t.transferFrom(alice, bob, 200e18);
        require(t.balanceOf(bob) == 198e18, "net 198");
        require(t.balanceOf(TREASURY) == 2e18, "fee 2");
        require(t.allowance(alice, bob) == 0, "allowance spent");
    }

    function testInsufficientBalanceReverts() public {
        vm.prank(bob);
        vm.expectRevert(bytes("insufficient balance"));
        t.transfer(alice, 1);
    }

    function testConservationOfSupply() public {
        vm.prank(alice);
        t.transfer(bob, 12345e15);
        uint256 sum = t.balanceOf(alice) + t.balanceOf(bob) + t.balanceOf(TREASURY);
        require(sum == t.totalSupply(), "conserved");
    }
}
