// SPDX-License-Identifier: MIT
// EMC Foundation
// EMC (EdgeMatrix Computing) is a decentralized computing network in the AI era.

pragma solidity ^0.8.0;

// import "@openzeppelin/contracts@4.9.3/token/ERC20/utils/SafeERC20.sol";
// import "@openzeppelin/contracts@4.9.3/utils/math/SafeMath.sol";
// import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

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

interface INodeBind {
    function ownerOfNode(string memory _nodeId) external view returns (address);
}

contract NodeRewardV1 is ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable token; //Token's contract address for reward. Will be designated as EMC token (has been audited) contract address

    INodeBind public immutable bindContract;

    address public immutable releaseContract; //contract address for release. Will be designated as ReleaseVestingV1 (has been audited) contract address

    uint256 public tokenInPool; // total staked amount

    address public owner; // address of the owner

    bool public canWithdraw; // switch of withdraw

    struct AccountInfo {
        uint256 amount; // How many tokens the staker has.
        uint256 claimed; // token debt.
    }

    struct ReleaseSchedule {
        // duration of the vesting period(30days)
        uint256 duration;
        // rate
        uint256 rate;
    }

    ReleaseSchedule[] internal releaseSchedules;

    // Unlocked account of each staker.
    mapping(address => AccountInfo) internal unlockedAccounts;

    // Locked account of each staker.
    mapping(address => AccountInfo) internal lockedAccounts;

    // Modifier to check token allowance
    modifier checkTokenAllowance(uint amount) {
        require(
            token.allowance(msg.sender, address(this)) >= amount,
            "checkTokenAllowance Error"
        );
        _;
    }

    event Deposited(address holder, uint256 amount, string nodeId);

    event Withdrawed(
        address sender,
        address beneficiary,
        uint256 amount,
        uint256 duration,
        uint256 withdrawed,
        uint256 rate
    );

    event Claimed(address sender, address beneficiary, uint256 rewardAmount);

    event TransferReward(address holder, uint256 amount, string nodeId);

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

    event WithdrawedForMigration(address holder, uint256 amount);

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner == msg.sender, "caller is not the owner");
        _;
    }

    /**
     * @dev Throws if canWithdraw is false.
     */
    modifier onlyCanWithdraw() {
        require(canWithdraw, "withdrawls and claims have been banned");
        _;
    }

    constructor(
        address _bindContract,
        address _token,
        address _releaseContract
    ) {
        require(_token != address(0), "_token is the zero address");
        require(
            _bindContract != address(0),
            "_bindContract is the zero address"
        );
        require(
            _releaseContract != address(0),
            "_releaseContract is the zero address"
        );
        bindContract = INodeBind(_bindContract);
        token = IERC20(_token);
        releaseContract = _releaseContract;

        owner = msg.sender;
        canWithdraw = true;
    }

    // update canWithdraw state.
    function setCanWithdraw(bool _canWithdraw) public onlyOwner {
        canWithdraw = _canWithdraw;
    }

    // update release schedules.
    function setReleaseSchedules(
        ReleaseSchedule[] memory _schedules
    ) public onlyOwner {
        uint256 len = releaseSchedules.length;
        for (uint256 i = 0; i < len; i++) {
            releaseSchedules.pop();
        }
        for (uint256 i = 0; i < _schedules.length; i++) {
            ReleaseSchedule memory schedule = _schedules[i];
            releaseSchedules.push(schedule);
        }
    }

    // get release schedules.
    function getReleaseSchedules()
        public
        view
        returns (ReleaseSchedule[] memory)
    {
        return releaseSchedules;
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

    // Transfer reward tokens to node
    function transferRewardTo(
        string memory _nodeId,
        uint256 _amount
    ) public checkTokenAllowance(_amount) nonReentrant {
        require(_amount > 0, "amount not good");
        require(bytes(_nodeId).length > 0, "tnodeId not good");

        address beneficiary = bindContract.ownerOfNode(_nodeId);

        require(beneficiary != address(0), "_beneficiary is the zero address");

        token.safeTransferFrom(msg.sender, address(this), _amount);

        // transfer reward to unlocked account
        AccountInfo storage stakerAccount = unlockedAccounts[beneficiary];
        stakerAccount.amount = stakerAccount.amount.add(_amount);

        emit TransferReward(beneficiary, _amount, _nodeId);
    }

    // Balance of claimable tokens
    function claimableBalance(address _staker) external view returns (uint256) {
        AccountInfo memory stakerAccount = unlockedAccounts[_staker];
        return stakerAccount.amount;
    }

    function claimed(address _staker) external view returns (uint256) {
        AccountInfo memory stakerAccount = unlockedAccounts[_staker];
        return stakerAccount.claimed;
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
        // update unlocked account
        stakerAccount.amount = 0;
        stakerAccount.claimed = stakerAccount.claimed.add(accountAmount);

        require(accountAmount > 0, "claimable balance is zero");

        // transfer the tokens to the _beneficiary
        token.safeTransfer(_beneficiary, accountAmount);

        emit Claimed(msg.sender, _beneficiary, accountAmount);
    }

    // Deposit tokens to contract
    function deposit(
        string memory _nodeId,
        uint256 _amount
    ) public checkTokenAllowance(_amount) nonReentrant {
        require(_amount > 0, "amount not good");
        require(bytes(_nodeId).length > 0, "deposit: nodeId not good");

        address beneficiary = bindContract.ownerOfNode(_nodeId);
        require(beneficiary != address(0), "_beneficiary is the zero address");

        // transfer the tokens to be locked in the contract
        token.safeTransferFrom(msg.sender, address(this), _amount);

        tokenInPool = tokenInPool.add(_amount);

        // transfer reward to locked account
        AccountInfo storage stakerAccount = lockedAccounts[beneficiary];
        stakerAccount.amount = stakerAccount.amount.add(_amount);

        emit Deposited(beneficiary, _amount, _nodeId);
    }

    // Balance of deposited tokens
    function withdrawableBalance(
        address _staker
    ) external view returns (uint256) {
        AccountInfo memory stakerAccount = lockedAccounts[_staker];
        return stakerAccount.amount;
    }

    function withdrawed(address _staker) external view returns (uint256) {
        AccountInfo memory stakerAccount = lockedAccounts[_staker];
        return stakerAccount.claimed;
    }

    // Withdraw staked tokens from contract.
    function withdraw(
        uint256 _amount,
        uint256 _duration,
        address _beneficiary
    ) public nonReentrant onlyCanWithdraw {
        require(_beneficiary != address(0), "beneficiary is the zero address");

        AccountInfo storage stakerAccount = lockedAccounts[msg.sender];
        uint256 accountAmount = stakerAccount.amount;

        require(releaseSchedules.length > 0, "schedules is empty");

        require(accountAmount >= _amount, "insufficient balance");

        // update locked account
        stakerAccount.amount = stakerAccount.amount.sub(_amount);
        stakerAccount.claimed = stakerAccount.claimed.add(_amount);

        uint256 withdrawableAmount = 0;
        uint256 lockDays = 0;
        uint256 rate = 0;
        for (uint256 i = 0; i < releaseSchedules.length; i++) {
            ReleaseSchedule memory schedule = releaseSchedules[i];
            if (schedule.duration == _duration) {
                lockDays = schedule.duration.sub(30);
                rate = schedule.rate;
                withdrawableAmount = _amount.mul(schedule.rate).div(1e18);
                break;
            }
        }

        require(withdrawableAmount > 0 && lockDays >= 0, "invalid duration");

        tokenInPool = tokenInPool.sub(_amount);

        // transfer withdrawable tokens to another contract.
        SafeERC20.safeIncreaseAllowance(
            token,
            releaseContract,
            withdrawableAmount
        );
        IReleaseVesing releaser = IReleaseVesing(releaseContract);

        // lock tokens into contract for 30 x duration days
        releaser.createVestingSchedule(
            _beneficiary,
            block.timestamp + lockDays * 1 days,
            1,
            DurationUnits.Days30,
            withdrawableAmount
        );

        emit Withdrawed(
            msg.sender,
            _beneficiary,
            _amount,
            _duration,
            withdrawableAmount,
            rate
        );
    }

    // Withdraw tokens from contract (onlyOwner).
    function withdrawForMigration(
        uint256 _tokenAmount
    ) public onlyOwner nonReentrant {
        require(_tokenAmount > 0, "_tokenAmount not good");

        require(
            token.balanceOf(address(this)) >= _tokenAmount,
            "balance of tokens is not enough"
        );

        SafeERC20.safeTransfer(token, msg.sender, _tokenAmount);

        emit WithdrawedForMigration(msg.sender, _tokenAmount);
    }
}
