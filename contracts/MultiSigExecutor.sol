// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// import "hardhat/console.sol";

contract MultiSigExecutor is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    address public signerA; // address of the signerA
    address public signerB; // address of the signerB
    address public signerC; // address of the signerC

    address public owner; // address of the owner

    event Deposit(address indexed sender, uint256 amount, uint256 balance);

    event ExecuteTransaction(
        address indexed caller,
        string indexed nonce,
        address indexed to,
        uint256 value,
        bytes data
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, "caller is not the owner");
        _;
    }

    constructor(address _signerA, address _signerB, address _signerC) {
        require(_signerA != address(0), "_signerA is the zero address");
        require(_signerB != address(0), "_signerB is the zero address");
        require(_signerC != address(0), "_signerC is the zero address");

        signerA = _signerA;
        signerB = _signerB;
        signerC = _signerC;
        owner = msg.sender;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    function executeTransaction(
        address _to,
        uint256 _value,
        bytes memory _data,
        string memory _nonce,
        bytes memory _signatureA,
        bytes memory _signatureB,
        bytes memory _signatureC
    ) public nonReentrant {
        require(bytes(_nonce).length > 0, "_nonce not good");

        require(!verifiedState[_nonce], "tx already executed");

        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, _to, _value, _data, _nonce)
        );

        require(
            signerA ==
                messageHash.toEthSignedMessageHash().recover(_signatureA),
            "signatureA validation failed"
        );
        require(
            signerB ==
                messageHash.toEthSignedMessageHash().recover(_signatureB),
            "signatureB validation failed"
        );
        require(
            signerC ==
                messageHash.toEthSignedMessageHash().recover(_signatureC),
            "signatureC validation failed"
        );

        verifiedState[_nonce] = true;

        // executeTx
        (bool success, ) = _to.call{value: _value}(_data);
        require(success, "tx failed");

        emit ExecuteTransaction(msg.sender, _nonce, _to, _value, _data);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // Update signers.
    function setSigner(
        address _signerA,
        address _signerB,
        address _signerC
    ) public onlyOwner {
        require(_signerA != address(0), "_signerA is the zero address");
        require(_signerB != address(0), "_signerB is the zero address");
        require(_signerC != address(0), "_signerC is the zero address");

        signerA = _signerA;
        signerB = _signerB;
        signerC = _signerC;
    }
}
