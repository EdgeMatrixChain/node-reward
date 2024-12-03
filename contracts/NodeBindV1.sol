// SPDX-License-Identifier: MIT
// EMC Foundation
// EMC (EdgeMatrix Computing) is a decentralized computing network in the AI era.

pragma solidity ^0.8.0;

// import "@openzeppelin/contracts@4.9.3/utils/cryptography/ECDSA.sol";
// import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// import "./NodeStakeV4Lib.sol";

// import "hardhat/console.sol";

contract NodeBindV1 is ReentrancyGuard {
    using ECDSA for bytes32;

    address public manager; // address of the manager
    address public owner; // address of the owner

    // address of each node
    mapping(string => address) public nodeInfo;

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    event Bind(address holder, string nodeId);

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

    /**
     * @notice Verify bind signature
     */
    modifier verifyBindSigner(
        string memory nodeId,
        string memory nonce,
        bytes memory signature
    ) {
        require(bytes(nodeId).length > 0, "nodeId not good");
        require(!verifiedState[nonce], "signature validation failed");

        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, msg.sender, nodeId, nonce)
        );

        require(
            manager == messageHash.toEthSignedMessageHash().recover(signature),
            "signature validation failed"
        );
        verifiedState[nonce] = true;
        _;
    }

    constructor(address _manager) {
        require(_manager != address(0), "_manager is the zero address");

        manager = _manager;
        owner = msg.sender;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "new owner is the zero address");
        // _transferOwnership(newOwner);
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // Update the manager.
    function setManager(address _manager) public onlyOwner {
        require(_manager != address(0), "_manager is the zero address");
        manager = _manager;
    }

    // Bind beneficiary to node
    function bindNode(
        string memory _nodeId,
        address _beneficiary,
        string memory _nonce,
        bytes memory _signature
    ) public verifyBindSigner(_nodeId, _nonce, _signature) {
        require(_beneficiary != address(0), "_owner is the zero address");

        address beneficiary = nodeInfo[_nodeId];
        require(
            beneficiary == address(0) || beneficiary == msg.sender,
            "caller is not beneficiary"
        );
        nodeInfo[_nodeId] = _beneficiary;

        emit Bind(_beneficiary, _nodeId);
    }

    // Rebind beneficiary to node
    function rebind(string memory _nodeId, address _beneficiary) public {
        require(_beneficiary != address(0), "_owner is the zero address");

        address beneficiary = nodeInfo[_nodeId];
        require(
            beneficiary != address(0) && beneficiary == msg.sender,
            "caller is not beneficiary"
        );
        nodeInfo[_nodeId] = _beneficiary;

        emit Bind(_beneficiary, _nodeId);
    }

    function ownerOfNode(
        string memory _nodeId
    ) external view returns (address) {
        return nodeInfo[_nodeId];
    }
}
