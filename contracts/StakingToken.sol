// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IMintableToken is IERC20 {
    function mint(address recipient, uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}

/**
 * @title Liquidity Provider Token
 * @notice This token is an ERC20 detailed token with added capability to be minted by the owner.
 * It is used to represent user's shares when providing liquidity to swap contracts.
 */
contract StakingToken is IERC20, IMintableToken, ERC20Burnable, Ownable {
    /**
     * @notice Deploys Token contract with given name, symbol, and decimals
     * @dev the caller of this constructor will become the owner of this contract
     * @param name_ name of this token
     * @param symbol_ symbol of this token
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {}

    /**
     * @notice Mints the given amount of StakingToken to the recipient.
     * @dev only owner can call this mint function
     * @param recipient address of account to receive the tokens
     * @param amount amount of tokens to mint
     */
    function mint(address recipient, uint256 amount) external onlyOwner {
        require(amount != 0, "amount == 0");
        _mint(recipient, amount);
    }

    function burnFrom(
        address account,
        uint256 amount
    ) public virtual override(ERC20Burnable, IMintableToken) {
        _spendAllowance(account, _msgSender(), amount);
        _burn(account, amount);
    }
}
