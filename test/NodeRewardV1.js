const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

function Enum(...options) {
  return Object.fromEntries(options.map((key, i) => [key, i]));
}

const durationUnit = Enum('Days30', 'Days90', 'Days180', 'Days360');
const durationUnitName = ['Days30', 'Days90', 'Days180', 'Days360'];

const ONE_DAY_IN_SECS = 24 * 60 * 60;
const ONE_ETHER = BigInt(1e18);
const ONE_USDT = BigInt(1e6);


describe("NodeRewardV1 Contract Test", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, staker1, staker2, manager, , , , , test1, test2] = await ethers.getSigners();


    // deploy reward and fund token contract, then tranfer tokens to test account
    const rewardToken = await hre.ethers.deployContract("TestToken", [100000]);
    await rewardToken.waitForDeployment();

    // deploy ReleaseVestingV1 contract
    const scheduleRelease = await hre.ethers.deployContract("ReleaseVestingV1", [rewardToken, 0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeBindV1 contract
    const nodeBind = await hre.ethers.deployContract("NodeBindV1", [manager]);
    await nodeBind.waitForDeployment();

    const days1080RewardRate = hre.ethers.parseUnits("0.36", "ether");
    const nodeReward = await hre.ethers.deployContract("NodeRewardV1", [nodeBind, rewardToken, scheduleRelease]);
    // const nodeStake = await hre.ethers.deployContract("NodeStakeV3", [rewardToken, scheduleRelease, manager, days1080RewardRate, 36, stakingToken]);
    await nodeReward.waitForDeployment();

    await rewardToken.transfer(staker1, hre.ethers.parseUnits("3000", 18));
    await rewardToken.transfer(staker2, hre.ethers.parseUnits("5000", 18));

    return { rewardToken, nodeReward, scheduleRelease, owner, staker1, staker2, manager, test1, test2, nodeBind };
  }

  it("Should withdrw 25% token by the staker who deposit", async function () {

    const { rewardToken, nodeReward, scheduleRelease, owner, staker1, staker2, manager, test1, test2, nodeBind } = await loadFixture(
      deployContractFixture
    );

    // deposit tokens 
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether")); // 0

    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 60, staker1.address))
      .to.be.revertedWith("schedules is empty");

    schedules = await nodeReward.connect(owner).getReleaseSchedules();
    expect(schedules.length).to.equal(0);

    schedules = [{ duration: 60, rate: BigInt(0.25e18) }, { duration: 90, rate: BigInt(0.35e18) }, { duration: 120, rate: BigInt(0.5e18) }, { duration: 150, rate: BigInt(0.75e18) }, { duration: 180, rate: BigInt(1e18) }]
    await nodeReward.connect(owner).setReleaseSchedules(schedules);

    schedules = await nodeReward.connect(owner).getReleaseSchedules();
    expect(schedules.length).to.equal(5);
    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("idx=%d, duration=%d,rate=%d",
        i, schedule.duration, schedule.rate);
    }


    const startTime = await time.latest() + 60;

    // On 30th days after
    timeTo = startTime + 30 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n30th days after:\t%o", new Date((timeTo) * 1000));

    await rewardToken.connect(staker1).approve(nodeReward, BigInt(1000e18));
    await nodeReward.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(1000e18));

    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("1000", "ether")); // 1000

    await expect(nodeReward.connect(staker1).withdraw(BigInt(2000e18), 60, test1.address))
      .to.be.revertedWith("insufficient balance");

    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 1, test1.address))
      .to.be.revertedWith("invalid duration");

    console.log("--withdrawed %d tokens--", ethers.formatUnits(BigInt(100e18), 18));
    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 60, test1.address))
      .to.emit(nodeReward, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("25", "ether"),
        60);
    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("900", "ether")); // 30

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(1);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }
    start = await time.latest() + (60 - 30) * ONE_DAY_IN_SECS;
    expect(vesingScheduleList[0].beneficiary).to.equal(test1.address);
    expect(vesingScheduleList[0].duration).to.equal(1);
    expect(vesingScheduleList[0].amountTotal).to.equal(BigInt(25e18));
    expect(vesingScheduleList[0].start).to.equal(BigInt(start));


    // On 90th days after
    passedDays = 90;
    timeTo = startTime + passedDays * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n%dth days after:\t%o", passedDays, new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d x30days", elapsed, 36);

    await rewardToken.connect(staker1).approve(nodeReward, BigInt(100e18));
    await nodeReward.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(100e18));

    console.log("\n----staker1 rebind 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU to staker2----");
    await expect(nodeBind.connect(staker1).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await rewardToken.connect(staker1).approve(nodeReward, BigInt(1000e18));
    await nodeReward.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(1000e18));

    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    console.log("--withdrawed %d tokens--", ethers.formatUnits(BigInt(1000e18), 18));
    await expect(nodeReward.connect(staker1).withdraw(BigInt(1000e18), 60, test1.address))
      .to.emit(nodeReward, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("250", "ether"),
        60);
    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(2);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }
    start = await time.latest() + (60 - 30) * ONE_DAY_IN_SECS;
    expect(vesingScheduleList[1].beneficiary).to.equal(test1.address);
    expect(vesingScheduleList[1].duration).to.equal(1);
    expect(vesingScheduleList[1].amountTotal).to.equal(BigInt(250e18));
    expect(vesingScheduleList[1].start).to.equal(BigInt(start));

  });

  it("Should withdrw token by the staker who deposit", async function () {

    const { rewardToken, nodeReward, scheduleRelease, owner, staker1, staker2, manager, test1, test2, nodeBind } = await loadFixture(
      deployContractFixture
    );

    // deposit tokens 
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether")); // 0

    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 60, staker1.address))
      .to.be.revertedWith("schedules is empty");

    schedules = await nodeReward.connect(owner).getReleaseSchedules();
    expect(schedules.length).to.equal(0);

    schedules = [{ duration: 60, rate: BigInt(0.25e18) }, { duration: 90, rate: BigInt(0.35e18) }, { duration: 120, rate: BigInt(0.5e18) }, { duration: 150, rate: BigInt(0.75e18) }, { duration: 180, rate: BigInt(1e18) }]
    await nodeReward.connect(owner).setReleaseSchedules(schedules);

    schedules = await nodeReward.connect(owner).getReleaseSchedules();
    expect(schedules.length).to.equal(5);
    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("idx=%d, duration=%d,rate=%d",
        i, schedule.duration, schedule.rate);
    }

    await rewardToken.connect(staker1).approve(nodeReward, BigInt(1000e18));
    await nodeReward.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(1000e18));

    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("1000", "ether")); // 1000

    console.log("--withdrawed %d tokens--", ethers.formatUnits(BigInt(100e18), 18));
    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 90, test1.address))
      .to.emit(nodeReward, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("35", "ether"),
        90);
    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(1);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }
    expect(vesingScheduleList[0].beneficiary).to.equal(test1.address);
    expect(vesingScheduleList[0].duration).to.equal(1);
    expect(vesingScheduleList[0].amountTotal).to.equal(BigInt(35e18));

    console.log("--withdrawed %d tokens--", ethers.formatUnits(BigInt(100e18), 18));
    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 120, test1.address))
      .to.emit(nodeReward, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("50", "ether"),
        120);
    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(2);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }
    expect(vesingScheduleList[1].beneficiary).to.equal(test1.address);
    expect(vesingScheduleList[1].duration).to.equal(1);
    expect(vesingScheduleList[1].amountTotal).to.equal(BigInt(50e18));

    console.log("--withdrawed %d tokens--", ethers.formatUnits(BigInt(100e18), 18));
    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 150, test1.address))
      .to.emit(nodeReward, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("75", "ether"),
        150);
    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(3);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }
    expect(vesingScheduleList[2].beneficiary).to.equal(test1.address);
    expect(vesingScheduleList[2].duration).to.equal(1);
    expect(vesingScheduleList[2].amountTotal).to.equal(BigInt(75e18));

    console.log("--withdrawed %d tokens--", ethers.formatUnits(BigInt(100e18), 18));
    await expect(nodeReward.connect(staker1).withdraw(BigInt(100e18), 180, test1.address))
      .to.emit(nodeReward, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("100", "ether"),
        180);
    withdrawableBalance = await nodeReward.withdrawableBalance(staker1.address);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(4);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }
    expect(vesingScheduleList[3].beneficiary).to.equal(test1.address);
    expect(vesingScheduleList[3].duration).to.equal(1);
    expect(vesingScheduleList[3].amountTotal).to.equal(BigInt(100e18));


    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));

    await nodeReward.connect(owner).withdrawForMigration(BigInt(740e18));
    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

  });


  it("Should transfer token to contract", async function () {
    const { rewardToken, nodeReward, scheduleRelease, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );

    console.log(await hre.ethers.provider.getBalance(nodeReward.target));

    await rewardToken.transfer(nodeReward.target, hre.ethers.parseUnits("100", 18));

    // const tx = await owner.sendTransaction({ to: nodeStake.target, value: hre.ethers.parseUnits("100", "ether") });
    // await tx.wait();
    await expect(nodeReward.connect(staker1).withdrawForMigration(BigInt(100e18)))
      .to.be.revertedWith("caller is not the owner");

    contractBalance = await rewardToken.balanceOf(nodeReward.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("100", "ether"));

    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));

  });

});



async function makeBindSign(manager, nodeId, caller, nonce) {
  chainId = await hre.network.config.chainId;
  // console.log("chainId:\t\t%d", chainId);
  signature = '';
  dataHash = ethers.solidityPackedKeccak256(['uint256', 'address', 'string', 'string'], [chainId, caller, nodeId, nonce]);

  messageBytes = ethers.getBytes(dataHash);
  signature = await manager.signMessage(messageBytes);
  return signature;
}
