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
import "./StakingToken.sol";
// import "./NodeStakeV4Lib.sol";

// import "hardhat/console.sol";

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
    // Id of node
    string nodeId;
}

contract NodeStakeV4 is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    IERC20 public immutable token; //Token's contract address for reward. Will be designated as EMC token (has been audited) contract address

    IMintableToken public immutable stakingToken;

    address public immutable releaseContract; //contract address for release. Will be designated as ReleaseVestingV1 (has been audited) contract address

    uint256 public tokenInPool; // total statked amount

    address public manager; // address of the manager
    address public owner; // address of the owner

    uint256 public minLimit; // minimum limit of stake

    bool public canDeposit; // switch of deposit
    bool public canWithdraw; // switch of withdraw

    uint256 scheduleDuration; // duration for schedule
    uint256 scheduleYieldRate; // Base rate by DurationUnits.Days1080

    struct NodeInfo {
        address beneficiary; // The address of the staker.
        uint256 accumulated; // amount of accumulated tokens the staker has deposited.
    }

    struct AccountInfo {
        uint256 amount; // How many tokens the staker has.
        uint256 claimed; // token debt.
    }

    // Info of each node that stakes tokens.
    mapping(string => NodeInfo) public nodeInfo;

    // Unlocked account of each staker.
    mapping(address => AccountInfo) internal unlockedAccounts;

    // state of each signature verfiy.
    mapping(string => bool) private verifiedState;

    // Modifier to check token allowance
    modifier checkTokenAllowance(uint amount) {
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "checkTokenAllowance Error"
        );
        _;
    }

    /**
     * @notice List of vesting schedules for each staker
     */
    mapping(address => VestingSchedule[]) public vestingSchedules;

    event Bind(address holder, string nodeId);

    event Deposited(
        address holder,
        uint256 amount,
        string nodeId,
        uint256 depositType
    );

    event Withdrawed(
        address sender,
        address beneficiary,
        uint256 amount,
        uint256 scheduleIndex
    );

    event Claimed(
        address sender,
        address beneficiary,
        uint256 rewardAmount,
        uint256 interestAmount
    );

    event TransferReward(address from, uint256 amount, string nodeId);

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    event VestingScheduleCreated(
        string nodeId,
        uint256 start,
        uint256 duration,
        uint256 amountTotal,
        uint256 yieldRate
    );

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
        require(canDeposit, "Deposit has been banned");
        _;
    }

    /**
     * @dev Throws if canWithdraw is false.
     */
    modifier onlyCanWithdraw() {
        require(canWithdraw, "withdrawls and claims have been banned");
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
        address _token,
        address _releaseContract,
        address _manager,
        uint256 _scheduleYieldRate,
        uint256 _scheduleDuration,
        string memory _stakingTokenName,
        string memory _stakingTokenSymbol
    ) {
        require(_scheduleDuration > 0, "_scheduleDuration is zero");
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
        canWithdraw = true;

        scheduleYieldRate = _scheduleYieldRate;
        scheduleDuration = _scheduleDuration;

        stakingToken = IMintableToken(
            new StakingToken(_stakingTokenName, _stakingTokenSymbol)
        );
    }

    // // Function to get the contract's balance
    // function getBalance() public view returns (uint) {
    //     return token.balanceOf(address(this));
    // }

    // update limit.
    function setLimit(uint256 _minLimit) public onlyOwner {
        minLimit = _minLimit;
    }

    // update canDeposit state.
    function setCanDeposit(bool _canDeposit) public onlyOwner {
        canDeposit = _canDeposit;
    }

    // update canWithdraw state.
    function setCanWithdraw(bool _canWithdraw) public onlyOwner {
        canWithdraw = _canWithdraw;
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

    // Deposit tokens to contract
    function deposit(
        string memory _nodeId,
        uint256 _depositType,
        uint256 _amount
    ) public checkTokenAllowance(_amount) onlyCanDeposit nonReentrant {
        require(_amount > 0, "amount not good");
        require(bytes(_nodeId).length > 0, "deposit: nodeId not good");

        require(_amount >= minLimit, "less than minimum limit");

        NodeInfo storage node = nodeInfo[_nodeId];

        require(
            node.beneficiary != address(0),
            "_beneficiary is the zero address"
        );

        // transfer the tokens to be locked to the contract
        token.safeTransferFrom(msg.sender, address(this), _amount);

        node.accumulated = node.accumulated.add(_amount);
        tokenInPool = tokenInPool.add(_amount);

        vestingSchedules[node.beneficiary].push(
            VestingSchedule({
                depositType: _depositType,
                start: block.timestamp,
                duration: scheduleDuration,
                amountTotal: _amount,
                withdrawed: 0,
                yieldRate: scheduleYieldRate,
                rewarded: 0,
                withdrawedTime: 0,
                nodeId: _nodeId
            })
        );

        emit VestingScheduleCreated(
            _nodeId,
            block.timestamp,
            scheduleDuration,
            _amount,
            scheduleYieldRate
        );

        // mint staking token
        stakingToken.mint(node.beneficiary, _amount);

        emit Deposited(node.beneficiary, _amount, _nodeId, _depositType);
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
        uint256 _scheduleIndex,
        address _beneficiary
    ) public nonReentrant onlyCanWithdraw {
        require(_beneficiary != address(0), "beneficiary is the zero address");

        VestingSchedule[] storage schedules = vestingSchedules[msg.sender];
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

        // update schedule's amount
        schedule.withdrawed = schedule.withdrawed.add(withdrawableBalance);
        schedule.rewarded = schedule.rewarded.add(rewardBalance);
        schedule.withdrawedTime = block.timestamp;

        // transfer the interest tokens to the _beneficiary
        if (rewardBalance > 0) {
            token.safeTransfer(_beneficiary, rewardBalance);
            emit Claimed(msg.sender, _beneficiary, 0, rewardBalance);
        }

        // transfer withdrawed tokens to another contract.
        SafeERC20.safeIncreaseAllowance(
            token,
            releaseContract,
            withdrawableBalance
        );
        IReleaseVesing releaser = IReleaseVesing(releaseContract);

        // lock tokens into contract for 30 days
        uint256 minStartDays = releaser.minStartDays();
        releaser.createVestingSchedule(
            _beneficiary,
            block.timestamp + minStartDays * 1 days + 15 * 60,
            1,
            DurationUnits.Days30,
            withdrawableBalance
        );

        emit Withdrawed(
            msg.sender,
            _beneficiary,
            withdrawableBalance,
            _scheduleIndex
        );
    }

    // Balance of claimable tokens
    function claimableBalance(address _staker) external view returns (uint256) {
        // transfer reward to unlocked account
        AccountInfo memory stakerAccount = unlockedAccounts[_staker];
        uint256 balance = stakerAccount.amount;

        // sum schedule's rewardBalance
        VestingSchedule[] memory schedules = vestingSchedules[_staker];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            (, uint256 rewardBalance, ) = _vestedAmount(schedule);
            balance = balance.add(rewardBalance);
        }
        return balance;
    }

    function balanceOfNodeByDepositType(
        address _staker,
        string memory _nodeId,
        uint256 _depositType
    ) external view returns (uint256) {
        uint256 balance = 0;

        // sum schedule's balance
        VestingSchedule[] memory schedules = vestingSchedules[_staker];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            if (
                schedule.depositType == _depositType && schedule.withdrawed == 0
            ) {
                if (bytes(_nodeId).length > 0) {
                    if (
                        bytes(schedule.nodeId).length ==
                        bytes(_nodeId).length &&
                        keccak256(abi.encodePacked(schedule.nodeId)) ==
                        keccak256(abi.encodePacked(_nodeId))
                    ) {
                        balance = balance.add(schedule.amountTotal);
                    }
                } else {
                    balance = balance.add(schedule.amountTotal);
                }
            }
        }

        return balance;
    }

    /**
     * @notice Returns vesting schedules of a node
     * @param _staker The address of the staker
     */
    function getSchedules(
        address _staker
    ) public view returns (VestingSchedule[] memory) {
        VestingSchedule[] memory schedules = vestingSchedules[_staker];
        return schedules;
    }

    /**
     * @notice Returns the withdrawable amount of tokens for a vesting schedule
     * @param _staker The address for staker
     * @param _scheduleIndex The vesting schedule index
     */
    function balanceOfSchedule(
        address _staker,
        uint256 _scheduleIndex
    ) external view returns (uint256, uint256, uint256) {
        VestingSchedule[] memory schedules = vestingSchedules[_staker];
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

        // calculate balance by block.timestamp (<30days:0%, <60days:25%, <90days:35%, <120days:50%, <150days:75%, >=150days:100%)
        if (_schedule.withdrawed > 0) {
            return (0, 0, _schedule.amountTotal);
        } else {
            if (block.timestamp < _schedule.start) {
                return (0, 0, _schedule.amountTotal);
            } else if (block.timestamp < _schedule.start.add(30 days)) {
                return (0, 0, _schedule.amountTotal);
            } else if (block.timestamp < _schedule.start.add(60 days)) {
                withdrawableBalance = withdrawableBalance.mul(25).div(100);
            } else if (block.timestamp < _schedule.start.add(90 days)) {
                withdrawableBalance = withdrawableBalance.mul(35).div(100);
            } else if (block.timestamp < _schedule.start.add(120 days)) {
                withdrawableBalance = withdrawableBalance.mul(50).div(100);
            } else if (block.timestamp < _schedule.start.add(150 days)) {
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
    ) public checkTokenAllowance(_amount) nonReentrant {
        require(_amount > 0, "amount not good");
        require(bytes(_nodeId).length > 0, "tnodeId not good");

        NodeInfo memory node = nodeInfo[_nodeId];
        require(
            node.beneficiary != address(0),
            "_beneficiary is the zero address"
        );

        token.safeTransferFrom(msg.sender, address(this), _amount);

        // transfer reward to unlocked account
        AccountInfo storage stakerAccount = unlockedAccounts[node.beneficiary];
        stakerAccount.amount = stakerAccount.amount.add(_amount);

        emit TransferReward(msg.sender, _amount, _nodeId);
    }

    // Balance of claimable interest tokens
    function claimableInterestBalance(
        address _staker
    ) external view returns (uint256) {
        uint256 balance = 0;

        // sum schedule's rewardBalance
        VestingSchedule[] memory schedules = vestingSchedules[_staker];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = schedules[i];
            (, uint256 rewardBalance, ) = _vestedAmount(schedule);
            balance = balance.add(rewardBalance);
        }
        return balance;
    }

    // Balance of claimable tokens
    function claimableRewardBalance(
        address _staker
    ) external view returns (uint256) {
        // balance of account
        AccountInfo memory stakerAccount = unlockedAccounts[_staker];
        uint256 balance = stakerAccount.amount;

        return balance;
    }

    // Claim tokens from contract.
    function claim(
        address _staker,
        address _beneficiary
    ) public nonReentrant onlyCanWithdraw {
        require(_beneficiary != address(0), "bad address");

        require(
            _staker == msg.sender || _staker == _beneficiary,
            "beneficiary is invalid"
        );

        AccountInfo storage stakerAccount = unlockedAccounts[_staker];
        uint256 accountAmount = stakerAccount.amount;
        uint256 totalAmount = stakerAccount.amount;
        // update unlocked account
        stakerAccount.amount = 0;

        // sum schedule's rewardBalance
        VestingSchedule[] storage schedules = vestingSchedules[_staker];
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule storage schedule = schedules[i];
            (, uint256 rewardBalance, ) = _vestedAmount(schedule);
            // update schedule's amount
            schedule.rewarded = schedule.rewarded.add(rewardBalance);

            totalAmount = totalAmount.add(rewardBalance);
        }

        require(totalAmount > 0, "claimable balance is zero");

        // transfer the tokens to the _beneficiary
        token.safeTransfer(_beneficiary, totalAmount);

        emit Claimed(
            msg.sender,
            _beneficiary,
            accountAmount,
            totalAmount.sub(accountAmount)
        );
    }
}
