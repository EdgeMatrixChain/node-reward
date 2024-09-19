// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";

contract WrappedToken is ERC20, ERC20Wrapper {
    constructor(
        IERC20 _underlyingToken,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) ERC20Wrapper(_underlyingToken) {}

    function decimals()
        public
        view
        virtual
        override(ERC20, ERC20Wrapper)
        returns (uint8)
    {
        return decimals();
    }
}
