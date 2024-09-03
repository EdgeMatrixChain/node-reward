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


describe("NodeStakeNativeV1 Contract Test", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, staker1, staker2, manager] = await ethers.getSigners();

    // deploy NodeStake contract
    const scheduleRelease = await hre.ethers.deployContract("ReleaseVestingNativeV1", [0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeStake contract
    const days1080RewardRate = hre.ethers.parseUnits("0.36", "ether");
    const nodeStake = await hre.ethers.deployContract("NodeStakeNativeV1", [scheduleRelease, manager, days1080RewardRate, 36]);
    await nodeStake.waitForDeployment();

    return { nodeStake, scheduleRelease, owner, staker1, staker2, manager };
  }


  it("Should deposit token by the staker", async function () {

    const { nodeStake, scheduleRelease, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(100e18), BigInt(1000e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(100e18), BigInt(2000e18));

    // deposit tokens 
    console.log("\n----staker1 bindNode 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU----");
    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.be.revertedWith("signature validation failed");
    await expect(nodeStake.connect(staker2).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker2.address.toLowerCase(), "a01232")))
      .to.be.revertedWith("signature validation failed");
    await expect(nodeStake.connect(staker2).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address, "a01232", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker2.address.toLowerCase(), "a01232")))
      .to.be.revertedWith("bindNode: caller is not beneficiary");
    await expect(nodeStake.connect(staker2).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.be.revertedWith("bindNode: caller is not beneficiary");

    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address, "b01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "b01231")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await expect(nodeStake.connect(staker2).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    console.log("\n----staker1 deposits 1000 tokens to 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU----");
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(0), BigInt(1000e18), { value: hre.ethers.parseEther("1000") });

    console.log("\n----staker1 bindNode 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG----");
    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1.address, "a01232", makeBindSign(manager, '16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG', staker1.address.toLowerCase(), "a01232")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    console.log("\n----staker2 rebind 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG----");
    await expect(nodeStake.connect(staker1).rebind("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker2.address))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    await expect(nodeStake.connect(manager).setCanDeposit(false))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setCanDeposit(false);
    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1000e18), { value: hre.ethers.parseEther("1000") }))
      .to.be.revertedWith("deposit stop");

    await nodeStake.connect(owner).setCanDeposit(true);

    console.log("\n----staker1 deposits 1000 tokens to 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG----");
    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(0), BigInt(1000e18), { value: hre.ethers.parseEther("1000") }))
      .to.emit(nodeStake, "Deposited")
      .withArgs(staker1.address,
        BigInt(1000e18),
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1e18), { value: hre.ethers.parseEther("1") }))
      .to.be.revertedWith("deposit: less than minimum limit");

    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(0), BigInt(1001e18), { value: hre.ethers.parseEther("1001") }))
      .to.be.revertedWith("deposit: greater than maximum limit");

    // staker1Balance = await nodeStake.balanceOf(staker1);
    // console.log("staker1Balance:\t\t%d", ethers.formatUnits(staker1Balance, 18));
    // expect(staker1Balance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    schedules = await nodeStake.getSchedules("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    expect(schedules.length).to.equal(1);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]: depositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime);
    }

    node2Balance = await nodeStake.balanceOfNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");
    console.log("node2Balance:\t\t%d", ethers.formatUnits(node2Balance, 18));
    expect(node2Balance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("2000", "ether"));

    const startTime = await time.latest() + 60;

    // On 15th days after
    timeTo = startTime + 15 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n15th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    // On 30th days after
    timeTo = startTime + 30 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n30th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("250", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("10", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("10", "ether"));

    // On 90th days after
    timeTo = startTime + 90 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n90th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("750", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("30", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("30", "ether"));

    // On 120th days after
    timeTo = startTime + 120 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n120th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("750", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("40", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("40", "ether"));


    // On 180th days after
    timeTo = startTime + 180 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n180th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("60", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("60", "ether"));

    // On 210th days after
    timeTo = startTime + 210 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n210th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("70", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("70", "ether"));

    // On 360th days after
    timeTo = startTime + 360 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n360th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("120", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("120", "ether"));

    // On 1080th days after
    timeTo = startTime + 1080 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n1080th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("360", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("360", "ether"));

    // On 1110th days after
    timeTo = startTime + 1110 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n1110th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("360", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("360", "ether"));

  });

  it("Should withdrw token by the staker who deposit", async function () {

    const { nodeStake, scheduleRelease, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(100e18), BigInt(1000e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(100e18), BigInt(2000e18));

    // deposit tokens 
    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(0), BigInt(1000e18), { value: hre.ethers.parseEther("1000") });
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(1), BigInt(100e18), { value: hre.ethers.parseEther("100") });

    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1.address, "a01232", makeBindSign(manager, '16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG', staker1.address.toLowerCase(), "a01232")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");


    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1000e18), { value: hre.ethers.parseEther("1000") }))
      .to.emit(nodeStake, "Deposited")
      .withArgs(staker1.address,
        BigInt(1000e18),
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1e18), { value: hre.ethers.parseEther("1") }))
      .to.be.revertedWith("deposit: less than minimum limit");

    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1001e18), { value: hre.ethers.parseEther("1001") }))
      .to.be.revertedWith("deposit: greater than maximum limit");

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    schedules = await nodeStake.getSchedules("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime);
    }

    node2Balance = await nodeStake.balanceOfNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");
    console.log("node2Balance:\t\t%d", ethers.formatUnits(node2Balance, 18));
    expect(node2Balance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("2100", "ether"));

    // transfer reward tokens to node
    await expect(nodeStake.connect(owner).transferRewardTo("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(40e18), { value: hre.ethers.parseEther("40") }))
      .to.emit(nodeStake, "TransferReward")
      .withArgs(owner.address,
        hre.ethers.parseUnits("40", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await expect(nodeStake.connect(owner).transferRewardTo("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(60e18), { value: hre.ethers.parseEther("60") }))
      .to.emit(nodeStake, "TransferReward")
      .withArgs(owner.address,
        hre.ethers.parseUnits("60", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    claimableRewardBalance = await nodeStake.claimableRewardBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("100", "ether"));

    claimableInterestBalance = await nodeStake.claimableInterestBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("0", "ether"));


    const startTime = await time.latest() + 60;

    // On 15th days after
    timeTo = startTime + 15 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n15th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("100", "ether"));

    await expect(nodeStake.connect(staker1).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, staker1.address))
      .to.be.revertedWith("withdraw: withdrawableBalance is zero");
    await expect(nodeStake.connect(staker2).claim("", staker2.address))
      .to.be.revertedWith("claim: nodeId not good");
    await expect(nodeStake.connect(staker2).claim("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.be.revertedWith("claim: beneficiary is invalid");
    await expect(nodeStake.connect(staker2).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, staker2.address))
      .to.be.revertedWith("withdraw: beneficiary is invalid");

    // On 30th days after
    timeTo = startTime + 30 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n30th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("250", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("10", "ether"));

    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("111", "ether")); // 100+10+1
    claimableRewardBalance = await nodeStake.claimableRewardBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    claimableInterestBalance = await nodeStake.claimableInterestBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("11", "ether"));

    console.log("\n----staker1 rebind 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU to staker2----");
    await expect(nodeStake.connect(staker1).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    console.log("--withdraw %d tokens--", ethers.formatUnits(withdrawableBalance, 18));
    await expect(nodeStake.connect(staker1).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, staker1.address))
      .to.be.revertedWith("withdraw: beneficiary is invalid");
    await expect(nodeStake.connect(owner).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, staker1.address))
      .to.be.revertedWith("withdraw: beneficiary is invalid");
    await expect(nodeStake.connect(staker2).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 2, staker2.address))
      .to.be.revertedWith("withdraw: schedule is not exsit");
    await expect(nodeStake.connect(staker2).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, staker2.address))
      .to.emit(nodeStake, "Withdrawed")
      .withArgs(staker2.address,
        hre.ethers.parseUnits("250", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU")
      .to.emit(nodeStake, "Claimed")
      .withArgs(staker2.address,
        hre.ethers.parseUnits("0", "ether"),
        hre.ethers.parseUnits("10", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");;

    vesingScheduleList = await scheduleRelease.getVestingSchedule(staker2.address);
    expect(vesingScheduleList.length).to.equal(1);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("100", "ether"));

    schedules = await nodeStake.getSchedules("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, withdrawed=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), ethers.formatEther(schedule.withdrawed), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime);
    }

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("101", "ether")); //100 + 1
    claimableRewardBalance = await nodeStake.claimableRewardBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    claimableInterestBalance = await nodeStake.claimableInterestBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("1", "ether"));

    console.log("--claim %d tokens--", ethers.formatUnits(claimableBalance, 18));
    await expect(nodeStake.connect(staker2).claim("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.emit(nodeStake, "Claimed")
      .withArgs(staker2.address,
        hre.ethers.parseUnits("100", "ether"),
        hre.ethers.parseUnits("1", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    schedules = await nodeStake.getSchedules("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, withdrawed=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), ethers.formatEther(schedule.withdrawed), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime);
    }

    // On 60th days after
    timeTo = startTime + 60 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n60th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("100", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    claimableBalance = await nodeStake.claimableBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("1", "ether"));

    await expect(nodeStake.connect(staker2).withdraw("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, staker2.address))
      .to.be.revertedWith("withdraw: withdrawableBalance is zero");

    // await expect(nodeStake.connect(staker1).claim("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address))
    //   .to.be.revertedWith("claim: claimable balance is zero");

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
