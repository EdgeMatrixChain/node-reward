// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// import "hardhat/console.sol";

struct NodeInfo {
    address beneficiary; // The address of the staker
    uint256 accumulated; // amount of accumulated tokens the staker has deposited.
    uint256 amount; // How many tokens the staker has deposited.
    uint256 debt; // token debt.
}

interface INodeStake {
    function balanceOfNode(
        string memory _nodeId
    ) external view returns (uint256);

    // function nodeInfo(
    //     string memory _nodeId
    // ) external view returns (  address,  uint256,  uint256,  uint256);

    function nodeInfo(
        string memory _nodeId
    ) external view returns (NodeInfo memory);
}

contract MultiSigClaim is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    INodeStake public immutable nodeStakeContract; //contract address for stake.
    IERC20 public immutable token; //Token's contract address for reward. Will be designated as EMC token (has been audited) contract address

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    // state of each signature revoke.
    mapping(string => bool) private revokedState;

    address public signerA; // address of the signerA
    address public signerB; // address of the signerB
    address public signerC; // address of the signerC

    address public owner; // address of the owner
    bool public canClaim; // switch of claim

    event Claimed(address holder, uint256 amount, string nodeId, string nonce);
    event WithdrawedForEmergency(address holder, uint256 amount);

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev Throws if canDeposit is false.
     */
    modifier onlyCanClaim() {
        require(canClaim, "claim state is false");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, "caller is not the owner");
        _;
    }

    constructor(
        address _token,
        address _nodeStakeContract,
        address _signerA,
        address _signerB,
        address _signerC
    ) {
        require(_token != address(0), "_token is the zero address");
        require(
            _nodeStakeContract != address(0),
            "_nodeStatkeContract is the zero address"
        );
        require(_signerA != address(0), "_signerA is the zero address");
        require(_signerB != address(0), "_signerB is the zero address");
        require(_signerC != address(0), "_signerC is the zero address");

        token = IERC20(_token);
        nodeStakeContract = INodeStake(_nodeStakeContract);
        signerA = _signerA;
        signerB = _signerB;
        signerC = _signerC;
        owner = msg.sender;
        canClaim = true;
    }

    function ClaimWithSignature(
        uint256 _tokenAmount,
        address _beneficiary,
        string memory _nodeId,
        string memory _nonce,
        bytes memory _signatureA,
        bytes memory _signatureB,
        bytes memory _signatureC
    ) public nonReentrant {
        require(_tokenAmount > 0, "verifyClaimSigner: _tokenAmount not good");

        require(
            _beneficiary != address(0),
            "verifyClaimSigner: beneficiary is the zero address"
        );

        require(
            bytes(_nodeId).length > 0,
            "verifyClaimSigner: nodeId not good"
        );

        require(bytes(_nonce).length > 0, "verifyClaimSigner: _nonce not good");

        require(
            !revokedState[_nonce],
            "verifyClaimSigner: signature validation failed"
        );
        require(
            !verifiedState[_nonce],
            "verifyClaimSigner: signature validation failed"
        );

        // console.log(block.chainid);
        // console.log(_tokenAmount);
        // console.log(_beneficiary);

        // (address node_beneficiary, , , ) =  nodeStakeContract.nodeInfo(_nodeId);
        // console.log(node_beneficiary);
        NodeInfo memory node = nodeStakeContract.nodeInfo(_nodeId);
        require(
            // node_beneficiary == _beneficiary,
            node.beneficiary == _beneficiary,
            "verifyClaimSigner: _beneficiary not good"
        );

        // console.log(_nonce);
        // console.log(signerA);
        // console.log(signerB);
        // console.log(signerC);

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                block.chainid,
                _tokenAmount,
                _nodeId,
                _beneficiary,
                _nonce
            )
        );

        require(
            signerA ==
                messageHash.toEthSignedMessageHash().recover(_signatureA),
            "verifyClaimSigner: signatureA validation failed"
        );
        require(
            signerB ==
                messageHash.toEthSignedMessageHash().recover(_signatureB),
            "verifyClaimSigner: signatureB validation failed"
        );
        require(
            signerC ==
                messageHash.toEthSignedMessageHash().recover(_signatureC),
            "verifyClaimSigner: signatureC validation failed"
        );

        verifiedState[_nonce] = true;

        require(
            token.balanceOf(address(this)) >= _tokenAmount,
            "ClaimWithSignature: balance of tokens is not enough"
        );

        SafeERC20.safeTransfer(token, _beneficiary, _tokenAmount);

        emit Claimed(_beneficiary, _tokenAmount, _nodeId, _nonce);
    }

    // update canClaim state.
    function setCanClaim(bool _canClaim) public onlyOwner {
        canClaim = _canClaim;
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
    function setManager(
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

    // Withdraw tokens from contract (onlyOwner).
    function withdrawRewardForEmergency(
        uint256 _tokenAmount
    ) public onlyOwner nonReentrant {
        require(
            _tokenAmount > 0,
            "withdrawRewardForEmergency: _tokenAmount not good"
        );

        require(
            token.balanceOf(address(this)) >= _tokenAmount,
            "withdrawRewardForEmergency: balance of tokens is not enough"
        );

        SafeERC20.safeTransfer(token, msg.sender, _tokenAmount);

        emit WithdrawedForEmergency(msg.sender, _tokenAmount);
    }
}
