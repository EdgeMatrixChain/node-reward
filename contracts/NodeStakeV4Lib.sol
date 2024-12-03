// SPDX-License-Identifier: MIT
// EMC Foundation
// EMC (EdgeMatrix Computing) is a decentralized computing network in the AI era.

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

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

library NodeStakeV4Lib {
    using SafeMath for uint256;

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
}
