// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

enum DurationUnits {
    Day1,
    Days5,
    Days30,
    Days90,
    Days180,
    Days360,
    Days720,
    Days1080
}

interface IScheduledRelease {
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _duration,
        DurationUnits _durationUnits,
        uint256 _amountTotal
    ) external;
}

contract NodeStakeV1 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable token; //Token's contract address for reward

    address public immutable releaseContract; //contract address for release

    uint256 public tokenInPool; // amount of token in pool

    address public manager; // address of the manager

    uint256 public minLimit; // minimum limit of stake
    uint256 public maxLimit; // maximum limit of stake
    bool public canDeposit; // switch of deposit

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

    // Modifier to check token allowance
    modifier checkTokenAllowance(uint amount) {
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "checkTokenAllowance Error"
        );
        _;
    }

    event Deposited(address holder, uint256 amount, string nodeId);
    event Withdrawed(address holder, uint256 amount, string nodeId);

    event CanDepositUpdated(address _operator, bool _canDeposit);

    /**
     * @dev Throws if called by any account other than the manager.
     */
    modifier onlyManager() {
        require(manager == msg.sender, "caller is not the manager");
        _;
    }

    /**
     * @dev Throws if canDeposit is false.
     */
    modifier onlyCanDeposit() {
        require(canDeposit, "deposit stop");
        _;
    }

    constructor(address _token, address _releaseContract) {
        token = IERC20(_token);
        releaseContract = _releaseContract;
        canDeposit = true;
    }

    // update limit.
    function setLimit(uint256 _minLimit, uint256 _maxLimit) public onlyManager {
        maxLimit = _maxLimit;
        minLimit = _minLimit;
    }

    // update canDeposit state.
    function setCanDeposit(bool _canDeposit) public onlyManager {
        canDeposit = _canDeposit;

        emit CanDepositUpdated(msg.sender, _canDeposit);
    }

    // update the manager.
    function setManager(address _manager) public onlyManager {
        manager = _manager;
    }

    // Deposit tokens to contract
    function deposit(
        string memory _nodeId,
        uint256 _amount
    ) public checkTokenAllowance(_amount) onlyCanDeposit {
        require(_amount > 0, "deposit: amount not good");
        require(bytes(_nodeId).length > 0, "deposit: nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];
        if (_amount > 0) {
            token.safeTransferFrom(msg.sender, address(this), _amount);
            node.amount = node.amount.add(_amount);
            node.beneficiary = msg.sender;
            node.accumulated = node.accumulated.add(_amount);
            tokenInPool = tokenInPool.add(_amount);
        }

        AccountInfo storage stakerAccount = accountInfo[msg.sender];
        stakerAccount.accumulated = stakerAccount.accumulated.add(_amount);
        stakerAccount.amount = stakerAccount.amount.add(_amount);

        emit Deposited(msg.sender, _amount, _nodeId);
    }

    // Withdraw rwa tokens from contract.
    function withdraw(
        string memory _nodeId,
        address _beneficiary,
        uint256 _amount
    ) public {
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

        require(node.beneficiary == msg.sender, "withdraw: beneficiary not good");

        SafeERC20.safeIncreaseAllowance(token, releaseContract, _amount);
        IScheduledRelease releaser = IScheduledRelease(releaseContract);
        releaser.createVestingSchedule(
            _beneficiary,
            block.timestamp + 15 * 60,
            1,
            DurationUnits.Days5,
            _amount
        );

        node.amount = node.amount.sub(_amount);
        tokenInPool = tokenInPool.sub(_amount);
        node.debt = node.debt.add(_amount);

        AccountInfo storage stakerAccount = accountInfo[msg.sender];
        stakerAccount.amount = stakerAccount.amount.sub(_amount);
        stakerAccount.debt = stakerAccount.debt.add(_amount);

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
}
