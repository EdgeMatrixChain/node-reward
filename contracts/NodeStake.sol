// SPDX-License-Identifier: MIT
// EMC Foundation
// EMC (EdgeMatrix Computing) is a decentralized computing network in the AI era.

pragma solidity ^0.8.0;

// import "@openzeppelin/contracts@4.9.3/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts@4.9.3/utils/math/SafeMath.sol";
// import "@openzeppelin/contracts@4.9.3/utils/cryptography/ECDSA.sol";
// import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

enum DurationUnits {
    Days30,
    Days90,
    Days180,
    Days360,
    Days720,
    Days1080
}

interface IReleaseVesing {
    function minStartDays() external view returns (uint);

    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _duration,
        DurationUnits _durationUnits,
        uint256 _amountTotal
    ) external;
}

contract NodeStakeV1 is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public immutable token; //Token's contract address for reward. Will be designated as EMC token (has been audited) contract address

    address public immutable releaseContract; //contract address for release. Will be designated as ReleaseVestingV1 (has been audited) contract address

    uint256 public tokenInPool; // total statked amount

    address public manager; // address of the manager
    address public owner; // address of the owner

    uint256 public minLimit; // minimum limit of stake
    uint256 public maxLimit; // maximum limit of stake
    bool public canDeposit; // switch of deposit
    bool public canClaim; // switch of claim

    struct NodeInfo {
        address beneficiary; // The address of the staker
        uint256 accumulated; // amount of accumulated tokens the staker has deposited.
        uint256 amount; // How many tokens the staker has deposited.
        uint256 debt; // token debt.
    }

    struct AccountInfo {
        uint256 accumulated; // amount of accumulated tokens the staker has deposited.
        uint256 amount; // How many tokens the staker has deposited.
        uint256 debt; // token debt.
    }

    // Info of each node that stakes tokens.
    mapping(string => NodeInfo) public nodeInfo;

    // Info of each staker that stakes tokens.
    mapping(address => AccountInfo) internal accountInfo;

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    // state of each signature revoke.
    mapping(string => bool) private revokedState;

    // Modifier to check token allowance
    modifier checkTokenAllowance(uint amount) {
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "checkTokenAllowance Error"
        );
        _;
    }

    event Bind(address holder, string nodeId);

    event Deposited(address holder, uint256 amount, string nodeId);

    event Withdrawed(address holder, uint256 amount, string nodeId);

    event WithdrawedForEmergency(address holder, uint256 amount);

    event Claimed(address holder, uint256 amount, string nodeId, string nonce);

    /**
     * @dev Throws if called by any account other than the manager.
     */
    modifier onlyManager() {
        require(manager == msg.sender, "caller is not the manager");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, "caller is not the owner");
        _;
    }

    /**
     * @dev Throws if canDeposit is false.
     */
    modifier onlyCanDeposit() {
        require(canDeposit, "deposit stop");
        _;
    }

    /**
     * @dev Throws if canDeposit is false.
     */
    modifier onlyCanClaim() {
        require(canClaim, "claim stop");
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
        require(bytes(nodeId).length > 0, "bindNode: nodeId not good");
        require(!verifiedState[nonce], "signature validation failed");

        bytes32 messageHash = keccak256(
            abi.encodePacked(block.chainid, msg.sender, nodeId, nonce)
        );

        // bytes32 messageHash = keccak256(
        //     abi.encode(block.chainid, msg.sender,  nodeId, nonce)
        // );

        // bytes32 messageHash = keccak256(
        //     bytes.concat(
        //         keccak256(abi.encode(block.chainid, msg.sender,  nodeId, nonce))
        //     )
        // );
        require(
            manager == messageHash.toEthSignedMessageHash().recover(signature),
            "signature validation failed"
        );
        verifiedState[nonce] = true;
        _;
    }

    /**
     * @notice Verify claim signature
     */
    modifier verifyClaimSigner(
        uint256 _tokenAmount,
        address _beneficiary,
        string memory _nodeId,
        string memory _nonce,
        bytes memory signature
    ) {
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

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                block.chainid,
                _tokenAmount,
                _beneficiary,
                _nodeId,
                _nonce
            )
        );

        require(
            manager == messageHash.toEthSignedMessageHash().recover(signature),
            "verifyClaimSigner: signature validation failed"
        );
        verifiedState[_nonce] = true;
        _;
    }

    constructor(address _token, address _releaseContract, address _manager) {
        require(_token != address(0), "_token is the zero address");
        require(
            _releaseContract != address(0),
            "_releaseContract is the zero address"
        );
        require(_manager != address(0), "_manager is the zero address");

        token = IERC20(_token);
        releaseContract = _releaseContract;
        manager = _manager;
        owner = msg.sender;
        canDeposit = true;
        canClaim = true;
    }

    // update limit.
    function setLimit(uint256 _minLimit, uint256 _maxLimit) public onlyOwner {
        if (_maxLimit != 0) {
            require(_minLimit < _maxLimit, "error input _minLimit value");
        }
        minLimit = _minLimit;
        maxLimit = _maxLimit;
    }

    // update canDeposit state.
    function setCanDeposit(bool _canDeposit) public onlyOwner {
        canDeposit = _canDeposit;
    }

    // update canClaim state.
    function setCanClaim(bool _canClaim) public onlyOwner {
        canClaim = _canClaim;
    }

    // Update the manager.
    function setManager(address _manager) public onlyOwner {
        require(_manager != address(0), "_manager is the zero address");
        manager = _manager;
    }

    // Deposit tokens to contract
    function deposit(
        string memory _nodeId,
        uint256 _amount
    ) public checkTokenAllowance(_amount) onlyCanDeposit nonReentrant {
        require(_amount > 0, "deposit: amount not good");
        require(bytes(_nodeId).length > 0, "deposit: nodeId not good");

        require(_amount >= minLimit, "deposit: less than minimum limit");

        NodeInfo storage node = nodeInfo[_nodeId];

        require(
            maxLimit == 0 || _amount.add(node.amount) <= maxLimit,
            "deposit: greater than maximum limit"
        );

        require(
            node.beneficiary == msg.sender,
            "deposit: beneficiary not good"
        );

        token.safeTransferFrom(msg.sender, address(this), _amount);

        node.amount = node.amount.add(_amount);
        node.accumulated = node.accumulated.add(_amount);
        tokenInPool = tokenInPool.add(_amount);
        AccountInfo storage stakerAccount = accountInfo[msg.sender];
        stakerAccount.accumulated = stakerAccount.accumulated.add(_amount);
        stakerAccount.amount = stakerAccount.amount.add(_amount);

        emit Deposited(msg.sender, _amount, _nodeId);
    }

    // Bind  beneficiary to node
    function bindNode(
        string memory _nodeId,
        address _beneficiary,
        string memory _nonce,
        bytes memory _signature
    ) public onlyCanDeposit verifyBindSigner(_nodeId, _nonce, _signature) {
        require(
            _beneficiary != address(0),
            "bindNode: _owner is the zero address"
        );

        NodeInfo storage node = nodeInfo[_nodeId];
        require(
            node.beneficiary == address(0) || node.beneficiary == msg.sender,
            "bindNode: caller is not beneficiary"
        );
        node.beneficiary = _beneficiary;

        emit Bind(_beneficiary, _nodeId);
    }

    // Withdraw tokens from contract (onlyOwner).
    function withdrawRewardForEmergency(
        uint256 _tokenAmount
    ) public onlyOwner nonReentrant {
        require(
            _tokenAmount > 0,
            "withdrawRewardForEmergency: _tokenAmount not good"
        );

        uint256 total = token.balanceOf(address(this));
        require(
            token.balanceOf(address(this)) >= _tokenAmount,
            "withdrawRewardForEmergency: balance of tokens is not enough"
        );

        uint256 rewardInPool = total.sub(tokenInPool);

        require(
            rewardInPool >= _tokenAmount,
            "withdrawRewardForEmergency: rewardInPool is not enough"
        );

        rewardInPool = rewardInPool.sub(_tokenAmount);

        SafeERC20.safeTransfer(token, msg.sender, _tokenAmount);

        emit WithdrawedForEmergency(msg.sender, _tokenAmount);
    }

    // Withdraw staked tokens from contract.
    function withdraw(
        string memory _nodeId,
        address _beneficiary,
        uint256 _amount
    ) public nonReentrant {
        require(
            _beneficiary != address(0),
            "withdraw: beneficiary is the zero address"
        );

        require(bytes(_nodeId).length > 0, "withdraw: nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];
        require(
            _amount > 0 && node.amount >= _amount,
            "withdraw: amount not good"
        );

        require(
            node.beneficiary == msg.sender,
            "withdraw: beneficiary not good"
        );

        node.amount = node.amount.sub(_amount);
        tokenInPool = tokenInPool.sub(_amount);
        node.debt = node.debt.add(_amount);

        AccountInfo storage stakerAccount = accountInfo[msg.sender];
        stakerAccount.amount = stakerAccount.amount.sub(_amount);
        stakerAccount.debt = stakerAccount.debt.add(_amount);

        SafeERC20.safeIncreaseAllowance(token, releaseContract, _amount);
        IReleaseVesing releaser = IReleaseVesing(releaseContract);

        uint256 minStartDays = releaser.minStartDays();
        releaser.createVestingSchedule(
            _beneficiary,
            block.timestamp + minStartDays * 1 days + 15 * 60,
            1,
            DurationUnits.Days30,
            _amount
        );

        emit Withdrawed(msg.sender, _amount, _nodeId);
    }

    function balanceOf(address _beneficiary) external view returns (uint256) {
        AccountInfo storage stakerAccount = accountInfo[_beneficiary];
        return stakerAccount.amount;
    }

    function balanceOfNode(
        string memory _nodeId
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "balanceOfNode: nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];
        return node.amount;
    }

    // revoke nonce
    function revoke(string memory _nonce) public onlyManager {
        require(!revokedState[_nonce], "revoke: _nonce is revoked");
        require(!verifiedState[_nonce], "revoke: _nonce is verified");
        revokedState[_nonce] = true;
    }

    function ClaimWithSignature(
        uint256 _tokenAmount,
        address _beneficiary,
        string memory _nodeId,
        string memory _nonce,
        bytes memory _signature
    )
        public
        onlyCanClaim
        verifyClaimSigner(
            _tokenAmount,
            _beneficiary,
            _nodeId,
            _nonce,
            _signature
        )
        nonReentrant
    {
        uint256 total = token.balanceOf(address(this));
        require(
            token.balanceOf(address(this)) >= _tokenAmount,
            "ClaimWithSignature: balance of tokens is not enough"
        );

        uint256 rewardInPool = total.sub(tokenInPool);

        require(
            rewardInPool >= _tokenAmount,
            "ClaimWithSignature: rewardInPool is not enough"
        );


        rewardInPool = rewardInPool.sub(_tokenAmount);

        SafeERC20.safeTransfer(token, _beneficiary, _tokenAmount);

        emit Claimed(_beneficiary, _tokenAmount, _nodeId, _nonce);
    }
}
