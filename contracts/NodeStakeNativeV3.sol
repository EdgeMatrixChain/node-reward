// SPDX-License-Identifier: MIT
// EMC Foundation
// EMC (Edge Matrix Chain) is a leading AI DePIN in AI+Web3, bridging the computing power network and AI (d)apps.
pragma solidity ^0.8.0;

// import "@openzeppelin/contracts@4.9.3/utils/math/SafeMath.sol";
// import "@openzeppelin/contracts@4.9.3/utils/cryptography/ECDSA.sol";
// import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./StakingToken.sol";

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

contract NodeStakeNativeV3 is ReentrancyGuard {
    using SafeMath for uint256;
    using ECDSA for bytes32;

    IMintableToken public immutable stakingToken;

    address public immutable releaseContract; //contract address for release. Will be designated as ReleaseVestingV1 (has been audited) contract address

    uint256 public tokenInPool; // total statked amount

    address public manager; // address of the manager
    address public owner; // address of the owner

    uint256 public minLimit; // minimum limit of stake
    uint256 public maxLimit; // maximum limit of stake
    bool public canDeposit; // switch of deposit

    uint256 scheduleDuration; // duration for schedule
    uint256 scheduleYieldRate; // yield rate for duration

    struct NodeInfo {
        address beneficiary; // the address of the staker.
        uint256 accumulated; // amount of accumulated tokens the staker has deposited.
        uint256 amount; // how many tokens the staker has deposited.
        uint256 debt; // token debt.
    }

    struct AccountInfo {
        uint256 amount; // how many tokens the staker has.
        uint256 claimed; // token debt.
    }

    // Info of each node that stakes tokens.
    mapping(string => NodeInfo) public nodeInfo;

    // Unlocked account of each node.
    mapping(string => AccountInfo) internal unlockedAccounts;

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    struct VestingSchedule {
        // deposit type
        uint256 depositType;
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

    event Withdrawed(
        address sender,
        address beneficiary,
        uint256 amount,
        string nodeId
    );

    event Claimed(
        address sender,
        address beneficiary,
        uint256 rewardAmount,
        uint256 interestAmount,
        string nodeId
    );

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

    // Event to log the received native token
    event Received(address sender, uint amount);

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

    constructor(
        address _releaseContract,
        address _manager,
        uint256 _scheduleYieldRate,
        uint256 _scheduleDuration,
        string memory _stakingTokenName,
        string memory _stakingTokenSymbol
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

        stakingToken = IMintableToken(
            new StakingToken(_stakingTokenName, _stakingTokenSymbol)
        );
    }

    // Function to receive token
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // Function to get the contract's balance
    function getBalance() public view returns (uint) {
        return address(this).balance;
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
        uint256 _depositType,
        uint256 _amount
    ) public payable onlyCanDeposit nonReentrant {
        require(
            msg.value == _amount,
            "Sent EMC amount must match the deposit amount"
        );

        require(_amount > 0, "amount not good");
        require(bytes(_nodeId).length > 0, "nodeId not good");

        require(_amount >= minLimit, "less than minimum limit");

        NodeInfo storage node = nodeInfo[_nodeId];

        require(
            maxLimit == 0 || _amount.add(node.amount) <= maxLimit,
            "greater than maximum limit"
        );
        require(
            node.beneficiary != address(0),
            "_beneficiary is the zero address"
        );

        node.amount = node.amount.add(_amount);
        node.accumulated = node.accumulated.add(_amount);
        tokenInPool = tokenInPool.add(_amount);

        _createVestingSchedule(_nodeId, _depositType, block.timestamp, _amount);

        // mint staking token
        stakingToken.mint(msg.sender, _amount);

        emit Deposited(msg.sender, _amount, _nodeId);
    }

    // Bind beneficiary to node
    function bindNode(
        string memory _nodeId,
        address _beneficiary,
        string memory _nonce,
        bytes memory _signature
    ) public onlyCanDeposit verifyBindSigner(_nodeId, _nonce, _signature) {
        require(_beneficiary != address(0), "_owner is the zero address");

        NodeInfo storage node = nodeInfo[_nodeId];
        require(
            node.beneficiary == address(0) || node.beneficiary == msg.sender,
            "caller is not beneficiary"
        );
        node.beneficiary = _beneficiary;

        emit Bind(_beneficiary, _nodeId);
    }

    // Rebind beneficiary to node
    function rebind(
        string memory _nodeId,
        address _beneficiary
    ) public onlyCanDeposit {
        require(_beneficiary != address(0), "_owner is the zero address");

        NodeInfo storage node = nodeInfo[_nodeId];
        require(
            node.beneficiary != address(0) && node.beneficiary == msg.sender,
            "caller is not beneficiary"
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
        require(_beneficiary != address(0), "beneficiary is the zero address");

        require(bytes(_nodeId).length > 0, "nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];

        require(
            node.beneficiary == msg.sender || node.beneficiary == _beneficiary,
            "beneficiary is invalid"
        );

        VestingSchedule[] storage schedules = vestingSchedules[_nodeId];
        require(schedules.length > _scheduleIndex, "schedule is not exsit");

        VestingSchedule storage schedule = schedules[_scheduleIndex];

        (
            uint256 withdrawableBalance,
            uint256 rewardBalance,
            uint256 amountBalance
        ) = _vestedAmount(schedule);
        require(withdrawableBalance > 0, "withdrawableBalance is zero");

        require(
            IERC20(stakingToken).allowance(msg.sender, address(this)) >=
                amountBalance,
            "checkTokenAllowance Error"
        );

        // burn staking tokens
        stakingToken.burnFrom(msg.sender, amountBalance);

        tokenInPool = tokenInPool.sub(withdrawableBalance);
        node.amount = node.amount.sub(amountBalance);
        node.debt = node.debt.add(withdrawableBalance);

        // update schedule's amount
        schedule.withdrawed = schedule.withdrawed.add(withdrawableBalance);
        schedule.rewarded = schedule.rewarded.add(rewardBalance);
        schedule.withdrawedTime = block.timestamp;

        // transfer the interest tokens to the _beneficiary
        if (rewardBalance > 0) {
            payable(_beneficiary).transfer(rewardBalance);
            emit Claimed(msg.sender, _beneficiary, 0, rewardBalance, _nodeId);
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

        emit Withdrawed(msg.sender, _beneficiary, withdrawableBalance, _nodeId);
    }

    function balanceOfNode(
        string memory _nodeId
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "nodeId not good");

        NodeInfo storage node = nodeInfo[_nodeId];
        return node.amount;
    }

    function balanceOfNodeByDepositType(
        string memory _nodeId,
        uint256 _depositType
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "nodeId not good");

        uint256 balance = 0;

        // sum schedule's balance
        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            if (
                schedule.depositType == _depositType && schedule.withdrawed == 0
            ) {
                balance = balance.add(schedule.amountTotal);
            }
        }

        return balance;
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
        uint256 _depositType,
        uint256 _start,
        uint256 _amountTotal
    ) internal {
        // TODO uncomment for mainnet
        require(_start >= block.timestamp, "start is before current time");

        vestingSchedules[_nodeId].push(
            VestingSchedule({
                depositType: _depositType,
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
        require(bytes(_nodeId).length > 0, "nodeId not good");
        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
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
        require(bytes(_nodeId).length > 0, "nodeId not good");

        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
        require(schedules.length > _scheduleIndex, "schedule is not exsit");

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
        require(bytes(_nodeId).length > 0, "nodeId not good");

        // balance of account
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

    // Balance of claimable interest tokens
    function claimableInterestBalance(
        string memory _nodeId
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "nodeId not good");

        uint256 balance = 0;

        // sum schedule's rewardBalance
        VestingSchedule[] memory schedules = vestingSchedules[_nodeId];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            (, uint256 rewardBalance, ) = _vestedAmount(schedule);
            balance = balance.add(rewardBalance);
        }
        return balance;
    }

    // Balance of claimable tokens
    function claimableRewardBalance(
        string memory _nodeId
    ) external view returns (uint256) {
        require(bytes(_nodeId).length > 0, "nodeId not good");

        // balance of account
        AccountInfo memory stakerAccount = unlockedAccounts[_nodeId];
        uint256 balance = stakerAccount.amount;

        return balance;
    }

    // Claim tokens from contract.
    function claim(
        string memory _nodeId,
        address _beneficiary
    ) public nonReentrant {
        require(_beneficiary != address(0), "beneficiary is the zero address");

        require(bytes(_nodeId).length > 0, "nodeId not good");

        NodeInfo memory node = nodeInfo[_nodeId];

        require(
            node.beneficiary == msg.sender || node.beneficiary == _beneficiary,
            "beneficiary is invalid"
        );

        AccountInfo storage stakerAccount = unlockedAccounts[_nodeId];
        uint256 accountAmount = stakerAccount.amount;
        uint256 totalAmount = accountAmount;
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

        require(totalAmount > 0, "claimable balance is zero");

        // transfer the tokens to the _beneficiary
        payable(_beneficiary).transfer(totalAmount);

        emit Claimed(
            msg.sender,
            _beneficiary,
            accountAmount,
            totalAmount.sub(accountAmount),
            _nodeId
        );
    }
}
