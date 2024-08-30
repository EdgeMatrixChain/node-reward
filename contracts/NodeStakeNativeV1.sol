// SPDX-License-Identifier: MIT
// EMC Foundation
// EMC (EdgeMatrix Computing) is a decentralized computing network in the AI era.

pragma solidity ^0.8.0;

// import "@openzeppelin/contracts@4.9.3/utils/math/SafeMath.sol";
// import "@openzeppelin/contracts@4.9.3/utils/cryptography/ECDSA.sol";
// import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

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
    ) external payable;
}

contract NodeStakeNativeV1 is ReentrancyGuard {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    // IERC20 public immutable token; //Token's contract address for reward. Will be designated as EMC token (has been audited) contract address

    address public immutable releaseContract; //contract address for release. Will be designated as ReleaseVestingV1 (has been audited) contract address

    uint256 public tokenInPool; // total statked amount

    address public manager; // address of the manager
    address public owner; // address of the owner

    uint256 public minLimit; // minimum limit of stake
    uint256 public maxLimit; // maximum limit of stake
    bool public canDeposit; // switch of deposit

    uint256 scheduleDuration; // duration for schedule
    uint256 scheduleYieldRate; // Base rate by DurationUnits.Days1080

    struct NodeInfo {
        address beneficiary; // The address of the staker.
        uint256 accumulated; // amount of accumulated tokens the staker has deposited.
        uint256 amount; // How many tokens the staker has deposited.
        uint256 debt; // token debt.
    }

    struct AccountInfo {
        uint256 amount; // How many tokens the staker has.
        uint256 claimed; // token debt.
    }

    // Info of each node that stakes tokens.
    mapping(string => NodeInfo) public nodeInfo;

    // Unlocked account of each node.
    mapping(string => AccountInfo) internal unlockedAccounts;

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    struct VestingSchedule {
        // start time of the vesting period
        uint256 start;
        // duration of the vesting period(30days)
        uint256 duration;
        // total amount of tokens to be released at the end of the vesting;
        uint256 amountTotal;
        // amount of tokens withdrawed
        uint256 withdrawed;
        // yield rate
        uint256 yieldRate;
        // amount of tokens rewarded
        uint256 rewarded;
        // time when have withdrawd
        uint256 withdrawedTime;
    }

    /**
     * @notice List of vesting schedules for each node
     */
    mapping(string => VestingSchedule[]) public vestingSchedules;

    event Bind(address holder, string nodeId);

    event Deposited(address holder, uint256 amount, string nodeId);

    event Withdrawed(address holder, uint256 amount, string nodeId);

    event Claimed(address holder, uint256 amount, string nodeId);

    event TransferReward(address from, uint256 amount, string nodeId);

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    event VestingScheduleCreated(
        string indexed nodeId,
        uint256 start,
        uint256 duration,
        uint256 amountTotal,
        uint256 yieldRate
    );

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

        require(
            manager == messageHash.toEthSignedMessageHash().recover(signature),
            "signature validation failed"
        );
        verifiedState[nonce] = true;
        _;
    }

    constructor(
        address _releaseContract,
        address _manager,
        uint256 _scheduleYieldRate,
        uint256 _scheduleDuration
    ) {
        require(_scheduleDuration > 0, "_scheduleDuration is zero");
        require(
            _releaseContract != address(0),
            "_releaseContract is the zero address"
        );
        require(_manager != address(0), "_manager is the zero address");

        releaseContract = _releaseContract;
        manager = _manager;
        owner = msg.sender;
        canDeposit = true;

        scheduleYieldRate = _scheduleYieldRate;
        scheduleDuration = _scheduleDuration;
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

    // Update the manager.
    function setManager(address _manager) public onlyOwner {
        require(_manager != address(0), "_manager is the zero address");
        manager = _manager;
    }

    // Deposit tokens to contract
    function deposit(
        string memory _nodeId,
        uint256 _amount
    ) public payable onlyCanDeposit nonReentrant {
        require(
            msg.value == _amount,
            "Sent EMC amount must match the deposit amount"
        );

        require(_amount > 0, "deposit: amount not good");
        require(bytes(_nodeId).length > 0, "deposit: nodeId not good");

        require(_amount >= minLimit, "deposit: less than minimum limit");

        NodeInfo storage node = nodeInfo[_nodeId];

        require(
            maxLimit == 0 || _amount.add(node.amount) <= maxLimit,
            "deposit: greater than maximum limit"
        );
        require(
            node.beneficiary != address(0),
            "deposit: _beneficiary is the zero address"
        );

        node.amount = node.amount.add(_amount);
        node.accumulated = node.accumulated.add(_amount);
        tokenInPool = tokenInPool.add(_amount);

        _createVestingSchedule(_nodeId, block.timestamp, _amount);

        emit Deposited(msg.sender, _amount, _nodeId);
    }

    // Bind beneficiary to node
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

    // Rebind beneficiary to node
    function rebind(
        string memory _nodeId,
        address _beneficiary
    ) public onlyCanDeposit {
        require(
            _beneficiary != address(0),
            "bindNode: _owner is the zero address"
        );

        NodeInfo storage node = nodeInfo[_nodeId];
        require(
            node.beneficiary != address(0) || node.beneficiary == msg.sender,
            "bindNode: caller is not beneficiary"
        );
        node.beneficiary = _beneficiary;

        emit Bind(_beneficiary, _nodeId);
    }

    // Withdraw staked tokens from contract.
    function withdraw(
        string memory _nodeId,
        uint256 _scheduleIndex,
        address _beneficiary
    ) public nonReentrant {
        require(
            _beneficiary != address(0),
            "withdraw: beneficiary is the zero address"
        );

        require(bytes(_nodeId).length > 0, "withdraw: nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];

        require(
            node.beneficiary == msg.sender || node.beneficiary == _beneficiary,
            "withdraw: beneficiary is invalid"
        );

        VestingSchedule[] storage schedules = vestingSchedules[_nodeId];
        require(
            schedules.length > _scheduleIndex,
            "withdraw: schedule is not exsit"
        );

        VestingSchedule storage schedule = schedules[_scheduleIndex];

        (
            uint256 withdrawableBalance,
            uint256 rewardBalance,
            uint256 amountBalance
        ) = _vestedAmount(schedule);
        require(
            withdrawableBalance > 0,
            "withdraw: withdrawableBalance is zero"
        );

        tokenInPool = tokenInPool.sub(withdrawableBalance);
        node.amount = node.amount.sub(amountBalance);
        node.debt = node.debt.add(withdrawableBalance);

        // update schedule's amount
        schedule.withdrawed = schedule.withdrawed.add(withdrawableBalance);
        schedule.rewarded = schedule.rewarded.add(rewardBalance);
        schedule.withdrawedTime = block.timestamp;

        // transfer reward to unlocked account
        AccountInfo storage stakerAccount = unlockedAccounts[_nodeId];
        if (rewardBalance > 0) {
            stakerAccount.amount = stakerAccount.amount.add(rewardBalance);
        }

        // transfer withdrawed tokens to another contract.
        IReleaseVesing releaser = IReleaseVesing(releaseContract);

        // lock tokens into contract for 30 days
        uint256 minStartDays = releaser.minStartDays();
        releaser.createVestingSchedule{value: withdrawableBalance}(
            _beneficiary,
            block.timestamp + minStartDays * 1 days + 15 * 60,
            1,
            DurationUnits.Days30,
            withdrawableBalance
        );

        emit Withdrawed(msg.sender, withdrawableBalance, _nodeId);
    }

    function balanceOfNode(
        string memory _nodeId
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "balanceOfNode: nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];
        return node.amount;
    }

    /**
     * @notice Creates a vesting schedule
     * @param _nodeId The ID of the node
     * @param _start The start UNIX timestamp of the vesting period
     * @param _amountTotal The total amount of tokens to be vested
     * @dev Approve the contract to transfer the tokens before calling this function
     */
    function _createVestingSchedule(
        string memory _nodeId,
        uint256 _start,
        uint256 _amountTotal
    ) internal {
        // TODO uncomment for mainnet
        require(
            _start >= block.timestamp,
            "_createVestingSchedule: start is before current time"
        );

        vestingSchedules[_nodeId].push(
            VestingSchedule({
                start: _start,
                duration: scheduleDuration,
                amountTotal: _amountTotal,
                withdrawed: 0,
                yieldRate: scheduleYieldRate,
                rewarded: 0,
                withdrawedTime: 0
            })
        );

        emit VestingScheduleCreated(
            _nodeId,
            _start,
            scheduleDuration,
            _amountTotal,
            scheduleYieldRate
        );
    }

    /**
     * @notice Returns vesting schedules of a node
     * @param _nodeId The ID of the node
     */
    function getSchedules(
        string memory _nodeId
    ) public view returns (VestingSchedule[] memory) {
        require(bytes(_nodeId).length > 0, "getSchedules: nodeId not good");
        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
        uint256 schedulesLength = schedules.length;
        require(
            schedulesLength > 0,
            "VestingContract: no vesting schedules for this node"
        );

        return schedules;
    }

    /**
     * @notice Returns the withdrawable amount of tokens for a vesting schedule
     * @param _nodeId The node's id
     * @param _scheduleIndex The vesting schedule index
     */
    function balanceOfSchedule(
        string memory _nodeId,
        uint256 _scheduleIndex
    ) external view returns (uint256, uint256, uint256) {
        require(bytes(_nodeId).length > 0, "scheduleBalance: nodeId not good");

        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
        require(
            schedules.length > _scheduleIndex,
            "scheduleBalance: schedule is not exsit"
        );

        VestingSchedule memory schedule = schedules[_scheduleIndex];
        (
            uint256 withdrawableBalance,
            uint256 rewardBalance,
            uint256 amountBalance
        ) = _vestedAmount(schedule);
        return (withdrawableBalance, rewardBalance, amountBalance);
    }

    /**
     * @notice Returns the vested amount of tokens for a vesting schedule
     * @param _schedule The vesting schedule
     */
    function _vestedAmount(
        VestingSchedule memory _schedule
    ) internal view returns (uint256, uint256, uint256) {
        uint256 withdrawableBalance = _schedule.amountTotal;

        // calculate balance by block.timestamp (30days:25%, 90days:75%, 180days:100%)
        if (_schedule.withdrawed > 0) {
            return (0, 0, _schedule.amountTotal);
        } else {
            if (block.timestamp < _schedule.start) {
                return (0, 0, _schedule.amountTotal);
            } else if (block.timestamp < _schedule.start.add(30 days)) {
                return (0, 0, _schedule.amountTotal);
            } else if (block.timestamp < _schedule.start.add(90 days)) {
                withdrawableBalance = withdrawableBalance.mul(25).div(100);
            } else if (block.timestamp < _schedule.start.add(180 days)) {
                withdrawableBalance = withdrawableBalance.mul(75).div(100);
            }
            uint256 passed = (block.timestamp.sub(_schedule.start)).div(
                30 days
            );
            if (passed > _schedule.duration) {
                passed = _schedule.duration;
            }
            uint256 rewardTotal = _schedule
                .amountTotal
                .mul(_schedule.yieldRate)
                .div(1e18);
            uint256 rewardBalance = rewardTotal
                .mul(passed)
                .div(_schedule.duration)
                .sub(_schedule.rewarded);
            return (
                withdrawableBalance.sub(_schedule.withdrawed),
                rewardBalance,
                _schedule.amountTotal
            );
        }
    }

    // Transfer reward tokens to node
    function transferRewardTo(
        string memory _nodeId,
        uint256 _amount
    ) public payable nonReentrant {
        require(
            msg.value == _amount,
            "Sent EMC amount must match the deposit amount"
        );

        require(_amount > 0, "transferRewardTo: amount not good");
        require(bytes(_nodeId).length > 0, "transferRewardTo: nodeId not good");

        NodeInfo memory node = nodeInfo[_nodeId];
        require(
            node.beneficiary != address(0),
            "transferRewardTo: _beneficiary is the zero address"
        );

        // transfer reward to unlocked account
        AccountInfo storage stakerAccount = unlockedAccounts[_nodeId];
        stakerAccount.amount = stakerAccount.amount.add(_amount);

        emit TransferReward(msg.sender, _amount, _nodeId);
    }

    // Balance of claimable tokens
    function claimableBalance(
        string memory _nodeId
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "claimableBalance: nodeId not good");

        // transfer reward to unlocked account
        AccountInfo memory stakerAccount = unlockedAccounts[_nodeId];
        uint256 balance = stakerAccount.amount;

        // sum schedule's rewardBalance
        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            (, uint256 rewardBalance, ) = _vestedAmount(schedule);
            balance = balance.add(rewardBalance);
        }
        return balance;
    }

    // Claim tokens from contract.
    function claim(
        string memory _nodeId,
        address _beneficiary
    ) public nonReentrant {
        require(
            _beneficiary != address(0),
            "claim: beneficiary is the zero address"
        );

        require(bytes(_nodeId).length > 0, "claim: nodeId not good");

        NodeInfo memory node = nodeInfo[_nodeId];

        require(
            node.beneficiary == msg.sender || node.beneficiary == _beneficiary,
            "claim: beneficiary is invalid"
        );

        AccountInfo storage stakerAccount = unlockedAccounts[_nodeId];
        uint256 totalAmount = stakerAccount.amount;

        // update unlocked account
        stakerAccount.amount = 0;

        // sum schedule's rewardBalance
        VestingSchedule[] storage schedules = vestingSchedules[_nodeId];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule storage schedule = schedules[i];
            (, uint256 rewardBalance, ) = _vestedAmount(schedule);
            // update schedule's amount
            schedule.rewarded = schedule.rewarded.add(rewardBalance);

            totalAmount = totalAmount.add(rewardBalance);
        }

        require(totalAmount > 0, "claim: claimable balance is zero");

        // transfer the tokens to the _beneficiary
        payable(_beneficiary).transfer(totalAmount);

        emit Claimed(_beneficiary, totalAmount, _nodeId);
    }
}
