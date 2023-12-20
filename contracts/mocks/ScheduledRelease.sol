// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/// @title ScheduledRelease
/// @notice  The ScheduledRelease Smart Contract that allows to create release schedules for a staker with day/1 days/5 days/30 days/90 days/180 days/360 days/720 days/1080 days cliff unlocking.
//  Staker can release tokens based on the duration and cliff period(day/1 days/5 days/30 days/90 days/180 days/360 days/720 days/1080 days).
contract ScheduledRelease {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    /**
     * @notice The token to be vested
     */
    IERC20 public immutable token;

    uint public immutable minStartDays;

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

    struct VestingSchedule {
        // beneficiary of tokens after they are released
        address beneficiary;
        // start time of the vesting period
        uint256 start;
        // duration of the vesting period in DurationUnits
        uint256 duration;
        // units of the duration
        DurationUnits durationUnits;
        // total amount of tokens to be released at the end of the vesting;
        uint256 amountTotal;
        // amount of tokens released
        uint256 released;
    }

    /**
     * @notice List of vesting schedules for each beneficiary
     */
    mapping(address => VestingSchedule[]) public vestingSchedules;

    /**
     * @notice Emitted when a vesting schedule is created
     * @param beneficiary The address of the beneficiary
     * @param start The start UNIX timestamp of the vesting period
     * @param duration The duration of the vesting period in DurationUnits
     * @param durationUnits The units of the duration(0 = days30, 1 = days90, 2 = days180, 3 = days360, 4 = days720, 5 = days1080)
     */
    event VestingScheduleCreated(
        address indexed beneficiary,
        uint256 start,
        uint256 duration,
        DurationUnits durationUnits,
        uint256 amountTotal
    );

    /**
     * @notice Emitted when tokens are released
     * @param beneficiary The address of the beneficiary
     * @param amount The amount of tokens released
     */
    event TokensReleased(address indexed beneficiary, uint256 amount);

    /**
     * @param _token The token to be vested
     */
    constructor(address _token, uint _minStartDays) {
        require(
            _token != address(0),
            "VestingContract: _token is the zero address"
        );
        token = IERC20(_token);        
        minStartDays = _minStartDays;
    }

    /**
     * @notice Creates a vesting schedule
     * @param _beneficiary The address of the beneficiary
     * @param _start The start UNIX timestamp of the vesting period
                duration: 1,
     * @param _duration The duration of the vesting period in DurationUnits
     * @param _durationUnits The units of the duration(0 = days, 1 = months, 2 = quarters, 3 = years)
     * @param _amountTotal The total amount of tokens to be vested
     * @dev Approve the contract to transfer the tokens before calling this function
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _duration,
        DurationUnits _durationUnits,
        uint256 _amountTotal
    ) external {
        // perform input checks
        require(
            _beneficiary != address(0),
            "VestingContract: beneficiary is the zero address"
        );
        require(_amountTotal > 0, "VestingContract: amount is 0");
        // TODO uncomment for mainnet
        require(
            _start >= block.timestamp + minStartDays * 1 days,
            string.concat("VestingContract: invalid start time")
        );

        // transfer the tokens to be locked to the contract
        token.safeTransferFrom(msg.sender, address(this), _amountTotal);

        vestingSchedules[_beneficiary].push(
            VestingSchedule({
                beneficiary: _beneficiary,
                start: _start,
                duration: _duration,
                durationUnits: _durationUnits,
                amountTotal: _amountTotal,
                released: 0
            })
        );

        emit VestingScheduleCreated(
            _beneficiary,
            _start,
            _duration,
            _durationUnits,
            _amountTotal
        );
    }

    /**
     * @notice Releases the vested tokens for a beneficiary
     * @param _beneficiary The address of the beneficiary
     */
    function release(address _beneficiary) external {
        VestingSchedule[] storage schedules = vestingSchedules[_beneficiary];
        uint256 schedulesLength = schedules.length;
        require(
            schedulesLength > 0,
            "VestingContract: no vesting schedules for beneficiary"
        );

        uint256 totalRelease;

        for (uint256 i = 0; i < schedulesLength; i++) {
            VestingSchedule storage schedule = schedules[i];

            // calculate the releasable amount
            uint256 amountToSend = _releasableAmount(schedule);
            if (amountToSend > 0) {
                // update the released amount
                schedule.released = schedule.released.add(amountToSend);
                // update the total released amount
                totalRelease = totalRelease.add(amountToSend);
                // transfer the tokens to the beneficiary
                token.safeTransfer(schedule.beneficiary, amountToSend);
            }
            if (amountToSend > 0) {
                emit TokensReleased(_beneficiary, totalRelease);
            }
        }
    }

    /**
     * @notice Returns vesting schedules of a beneficiary
     * @param _beneficiary The address of the beneficiary
     */
    function getVestingSchedule(
        address _beneficiary
    ) public view returns (VestingSchedule[] memory) {
        VestingSchedule[] memory schedules = vestingSchedules[_beneficiary];
        uint256 schedulesLength = schedules.length;
        require(
            schedulesLength > 0,
            "VestingContract: no vesting schedules for beneficiary"
        );

        return schedules;
    }

    /**
     * @notice Returns the releasable amount of tokens for a beneficiary
     * @param _beneficiary The address of the beneficiary
     */
    function getReleasableAmount(
        address _beneficiary
    ) external view returns (uint256) {
        VestingSchedule[] memory schedules = vestingSchedules[_beneficiary];
        if (schedules.length == 0) return 0;

        uint256 amountToSend = 0;
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = vestingSchedules[_beneficiary][i];
            uint256 amount = _releasableAmount(schedule);
            amountToSend = amountToSend.add(amount);
        }
        return amountToSend;
    }

    /**
     * @notice Returns the amount of tokens for a beneficiary (amountTotal, releasedTotal)
     * @param _beneficiary The address of the beneficiary
     */
    function getAmount(
        address _beneficiary
    ) external view returns (uint256, uint256) {
        VestingSchedule[] memory schedules = vestingSchedules[_beneficiary];
        if (schedules.length == 0) return (0, 0);

        uint256 amountTotal = 0;
        uint256 releasedTotal = 0;
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = vestingSchedules[_beneficiary][i];
            amountTotal = amountTotal.add(schedule.amountTotal);
            releasedTotal = releasedTotal.add(schedule.released);
        }
        return (amountTotal, releasedTotal);
    }

    /**
     * @notice Returns the releasable amount of tokens for a vesting schedule
     * @param _schedule The vesting schedule
     */
    function _releasableAmount(
        VestingSchedule memory _schedule
    ) internal view returns (uint256) {
        uint256 amount = _vestedAmount(_schedule);
        return (amount.sub(_schedule.released));
    }

    /**
     * @notice Returns the vested amount of tokens for a vesting schedule
     * @param _schedule The vesting schedule
     */
    function _vestedAmount(
        VestingSchedule memory _schedule
    ) internal view returns (uint256) {
        if (_schedule.duration == 0) {
            if (block.timestamp >= _schedule.start) {
                return _schedule.amountTotal;
            } else {
                return 0;
            }
        }
        uint256 sliceInSeconds;
        if (_schedule.durationUnits == DurationUnits.Day1) {
            sliceInSeconds = 1 days;
        } else if (_schedule.durationUnits == DurationUnits.Days5) {
            sliceInSeconds = 5 days;
        } else if (_schedule.durationUnits == DurationUnits.Days30) {
            sliceInSeconds = 30 days;
        } else if (_schedule.durationUnits == DurationUnits.Days90) {
            sliceInSeconds = 90 days;
        } else if (_schedule.durationUnits == DurationUnits.Days180) {
            sliceInSeconds = 180 days;
        } else if (_schedule.durationUnits == DurationUnits.Days360) {
            sliceInSeconds = 360 days;
        } else if (_schedule.durationUnits == DurationUnits.Days720) {
            sliceInSeconds = 720 days;
        } else if (_schedule.durationUnits == DurationUnits.Days1080) {
            sliceInSeconds = 1080 days;
        }
        if (block.timestamp < _schedule.start) {
            return 0;
        } else if (
            block.timestamp >=
            _schedule.start.add(_schedule.duration.mul(sliceInSeconds))
        ) {
            return (_schedule.amountTotal);
        } else {
            uint256 passed = (block.timestamp.sub(_schedule.start)).div(
                sliceInSeconds
            );
            uint256 amount = _schedule.amountTotal.mul(passed).div(
                _schedule.duration
            );
            return amount;
        }
    }

    function _lockedAmount(
        address _beneficiary
    ) internal view returns (uint256) {
        VestingSchedule[] memory schedules = vestingSchedules[_beneficiary];
        if (schedules.length == 0) return 0;

        uint256 totalLockedAmount = 0;
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = vestingSchedules[_beneficiary][i];

            uint256 amount = _vestedAmount(schedule);

            totalLockedAmount = totalLockedAmount.add(schedule.amountTotal).sub(
                    amount
                );
        }
        return totalLockedAmount;
    }

    /**
     * @notice Returns the locked amount of tokens for a beneficiary
     * @param _beneficiary The address of the beneficiary
     */
    function getLockedAmount(
        address _beneficiary
    ) external view returns (uint256) {
        return _lockedAmount(_beneficiary);
    }

    /**
     * @notice Provided to other governance contract calls
     * @dev See {IERC20-balanceOf}.
     */
    function balanceOf(address _beneficiary) external view returns (uint256) {
        VestingSchedule[] memory schedules = vestingSchedules[_beneficiary];
        if (schedules.length == 0) return 0;

        uint256 totalLockedAmount = 0;
        for (uint256 i = 0; i < schedules.length; i++) {
            VestingSchedule memory schedule = vestingSchedules[_beneficiary][i];
            totalLockedAmount = totalLockedAmount.add(schedule.amountTotal).sub(
                    schedule.released
                );
        }
        return totalLockedAmount;
    }
}
