// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title PrintToken — the standard token deployed by Printer Pad (printerpad.fun)
/// @notice Fixed-supply ERC-20 on Stable chain. A flat 1% fee on every transfer
///         is routed to the Printer Pad treasury. No owner, no mint, no pause,
///         no blacklist, no changeable fees — what you see is all there is.
contract PrintToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    /// Printer Pad treasury — receives the 1% transfer fee. Immutable forever.
    address public constant TREASURY = 0x7305670d6380331b89bf2404992eC310896935b3;
    uint256 public constant FEE_BPS = 100; // 1%

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory name_, string memory symbol_, uint256 supply_) {
        name = name_;
        symbol = symbol_;
        totalSupply = supply_;
        balanceOf[msg.sender] = supply_;
        emit Transfer(address(0), msg.sender, supply_);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "zero address");
        uint256 bal = balanceOf[from];
        require(bal >= value, "insufficient balance");
        unchecked { balanceOf[from] = bal - value; }

        // 1% to the pad treasury on every transfer; treasury moves fee-free
        uint256 fee = (from == TREASURY || to == TREASURY) ? 0 : (value * FEE_BPS) / 10000;
        if (fee > 0) {
            balanceOf[TREASURY] += fee;
            emit Transfer(from, TREASURY, fee);
        }
        uint256 net = value - fee;
        balanceOf[to] += net;
        emit Transfer(from, to, net);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, "insufficient allowance");
        if (allowed != type(uint256).max) {
            unchecked { allowance[from][msg.sender] = allowed - value; }
        }
        _transfer(from, to, value);
        return true;
    }
}
