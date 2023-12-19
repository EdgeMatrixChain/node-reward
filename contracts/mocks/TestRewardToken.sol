// contracts/mocks/TestToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract TestToken is ERC20Burnable {
    constructor(uint256 _initialSupply) ERC20("Test Token", "TST") {
        _mint(msg.sender, _initialSupply * 10 ** decimals());
    }
}
