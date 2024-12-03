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


describe("NodeStakeV5 Contract Test", function () {
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

    // deploy StakingToken contract
    // const stakingToken = await hre.ethers.deployContract("StakingToken", ["Staking Token", "STST"]);
    // await stakingToken.waitForDeployment();


    // deploy NodeBindV1 contract
    const nodeBind = await hre.ethers.deployContract("NodeBindV1", [manager]);
    await nodeBind.waitForDeployment();

    const days1080RewardRate = hre.ethers.parseUnits("0.36", "ether");
    const nodeStake = await hre.ethers.deployContract("NodeStakeV5", [nodeBind, rewardToken, scheduleRelease, days1080RewardRate, 36, "Staking Token", "STST"]);
    // const nodeStake = await hre.ethers.deployContract("NodeStakeV3", [rewardToken, scheduleRelease, manager, days1080RewardRate, 36, stakingToken]);
    await nodeStake.waitForDeployment();


    // get staking token contract¬
    const stakingTokenAddress = await nodeStake.stakingToken();
    console.log("stakingTokenAddress:\t\t%o", stakingTokenAddress);
    const stakingTokenContract = await ethers.getContractFactory("StakingToken");
    const stakingToken = stakingTokenContract.attach(stakingTokenAddress);
    console.log("stakingToken:\t\t%s", stakingToken.target);

    const stakingTokenTotalSupply = await stakingToken.totalSupply();
    console.log("stakingTokenTotalSupply:\t\t%d", stakingTokenTotalSupply);
    const stakingTokenName = await stakingToken.name();
    console.log("stakingTokenName:\t\t\t%s", stakingTokenName);
    const stakingTokenTotalSymbol = await stakingToken.symbol();
    console.log("stakingTokenTotalSymbol:\t\t%s", stakingTokenTotalSymbol);


    await rewardToken.transfer(staker1, hre.ethers.parseUnits("3000", 18));
    await rewardToken.transfer(staker2, hre.ethers.parseUnits("5000", 18));

    await expect(stakingToken.mint(test2, hre.ethers.parseUnits("3000", 18)))
      .to.be.revertedWith("Ownable: caller is not the owner");

    return { rewardToken, nodeStake, scheduleRelease, owner, staker1, staker2, manager, test1, test2, stakingToken, nodeBind };
  }


  it("Should deposit token by the staker", async function () {

    const { rewardToken, nodeStake, scheduleRelease, owner, staker1, staker2, manager, stakingToken, nodeBind } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(100e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(100e18));

    // deposit tokens 
    console.log("\n----staker1 bindNode 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU----");
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.be.revertedWith("signature validation failed");
    await expect(nodeBind.connect(staker2).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker2.address.toLowerCase(), "a01232")))
      .to.be.revertedWith("signature validation failed");
    await expect(nodeBind.connect(staker2).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address, "a01232", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker2.address.toLowerCase(), "a01232")))
      .to.be.revertedWith("caller is not beneficiary");
    await expect(nodeBind.connect(staker2).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.be.revertedWith("caller is not beneficiary");

    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address, "b01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "b01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await expect(nodeBind.connect(staker2).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    console.log("\n----staker1 deposits 1000 tokens to 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU----");
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(0), BigInt(1000e18));

    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("1000", "ether"));


    console.log("\n----staker1 bindNode 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG----");
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1.address, "a01232", makeBindSign(manager, '16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG', staker1.address.toLowerCase(), "a01232")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    console.log("\n----staker1 rebind 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG to staker2----");
    await expect(nodeBind.connect(staker1).rebind("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker2.address))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    await expect(nodeStake.connect(manager).setCanDeposit(false))
      .to.be.revertedWith("caller is not the owner");

    await expect(nodeStake.connect(manager).setCanWithdraw(false))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setCanDeposit(false);
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1000e18)))
      .to.be.revertedWith("Deposit has been banned");

    await nodeStake.connect(owner).setCanDeposit(true);

    console.log("\n----staker1 deposits 1000 tokens to 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG----");
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(0), BigInt(1000e18)))
      .to.emit(nodeStake, "Deposited")
      .withArgs(staker2.address,
        BigInt(1000e18),
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG",
        BigInt(0));

    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("2000", "ether"));

    schedules = await nodeStake.getSchedules(staker1);
    expect(schedules.length).to.equal(1);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]: depositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    staker1DepositBalance = await nodeStake.balanceOfNodeByDepositType(staker1.address, "", BigInt(0));
    console.log("staker1DepositBalance:\t\t%d", ethers.formatUnits(staker1DepositBalance, 18));
    expect(staker1DepositBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    schedules = await nodeStake.getSchedules(staker2);
    expect(schedules.length).to.equal(1);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]: depositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    staker2DepositBalance = await nodeStake.balanceOfNodeByDepositType(staker2.address, "", BigInt(0));
    console.log("staker2DepositBalance:\t\t%d", ethers.formatUnits(staker2DepositBalance, 18));
    expect(staker2DepositBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

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
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    // On 30th days after
    timeTo = startTime + 30 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n30th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("250", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("10", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("10", "ether"));

    // On 60th days after
    timeTo = startTime + 60 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n60th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("350", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("20", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("20", "ether"));

    // On 90th days after
    timeTo = startTime + 90 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n90th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("500", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("30", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("30", "ether"));

    // On 120th days after
    timeTo = startTime + 120 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n120th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("750", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("40", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("40", "ether"));

    // On 150th days after
    timeTo = startTime + 150 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n180th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("50", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("50", "ether"));


    // On 180th days after
    timeTo = startTime + 180 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n180th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("60", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("60", "ether"));

    // On 210th days after
    timeTo = startTime + 210 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n210th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("70", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("70", "ether"));

    // On 360th days after
    timeTo = startTime + 360 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n360th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("120", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("120", "ether"));

    // On 1080th days after
    timeTo = startTime + 1080 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n1080th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("360", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("360", "ether"));

    // On 1110th days after
    timeTo = startTime + 1110 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n1110th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);
    [amountBalance, rewardBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("360", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("360", "ether"));


    console.log("\n----staker2 rebind 16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG to staker1----");
    await expect(nodeBind.connect(staker2).rebind("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1.address))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    console.log("\n----staker2 bindNode 16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC----");
    await expect(nodeBind.connect(staker2).bindNode("16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC", staker2.address, "a01233", makeBindSign(manager, '16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC', staker2.address.toLowerCase(), "a01233")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC");

    await rewardToken.connect(staker2).approve(nodeStake, BigInt(1e18));
    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC", BigInt(1), BigInt(1e18)))
      .to.be.revertedWith("less than minimum limit");

    console.log("\n----staker2 deposits 1000 tokens to 16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC----");
    await rewardToken.connect(staker2).approve(nodeStake, BigInt(1000e18));
    await nodeStake.connect(staker2).deposit("16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC", BigInt(0), BigInt(1000e18));

    schedules = await nodeStake.getSchedules(staker2);
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]: depositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    staker2DepositBalance = await nodeStake.balanceOfNodeByDepositType(staker2.address, "", BigInt(0));
    console.log("staker2DepositBalance:\t\t%d", ethers.formatUnits(staker2DepositBalance, 18));
    expect(staker2DepositBalance).to.equal(hre.ethers.parseUnits("2000", "ether"));

    staker2Node2DepositBalance = await nodeStake.balanceOfNodeByDepositType(staker2.address, "16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfs_", BigInt(0));
    console.log("staker2Node2DepositBalance:\t\t%d", ethers.formatUnits(staker2Node2DepositBalance, 18));
    expect(staker2Node2DepositBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    staker2Node2DepositBalance = await nodeStake.balanceOfNodeByDepositType(staker2.address, "16Uiu2HAmQkbuGb3K3DmCyEDvKumSVCphVJCGPGHNoc4CobJbxfsC", BigInt(0));
    console.log("staker2Node2DepositBalance:\t\t%d", ethers.formatUnits(staker2Node2DepositBalance, 18));
    expect(staker2Node2DepositBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("3000", "ether"));

    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("2000", "ether"));

    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("3000", "ether"));

  });

  it("Should withdrw and claim token by the staker who deposit", async function () {

    const { rewardToken, nodeStake, scheduleRelease, owner, staker1, staker2, manager, stakingToken, nodeBind } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(100e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(100e18));

    // deposit tokens 
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await rewardToken.connect(staker1).approve(nodeStake, BigInt(1100e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(0), BigInt(1000e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(1), BigInt(100e18));

    // contractBalance = await hre.ethers.provider.getBalance(nodeStake.target);
    // expect(contractBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("1000", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("100", "ether"));

    // await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1.address, "a01232", makeBindSign(manager, '16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG', staker1.address.toLowerCase(), "a01232")))
    //   .to.emit(nodeStake, "Bind")
    //   .withArgs(staker1.address,
    //     "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    // await rewardToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    // await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1000e18)))
    //   .to.emit(nodeStake, "Deposited")
    //   .withArgs(staker1.address,
    //     BigInt(1000e18),
    //     "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));
    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("1100", "ether"));

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));

    schedules = await nodeStake.getSchedules(staker1);
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]: depositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    await rewardToken.connect(staker2).approve(nodeStake, BigInt(1e18));
    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1), BigInt(1e18)))
      .to.be.revertedWith("less than minimum limit");

    staker1DepositBalance0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("staker1DepositBalance0:\t\t%d", ethers.formatUnits(staker1DepositBalance0, 18));
    expect(staker1DepositBalance0).to.equal(hre.ethers.parseUnits("1000", "ether"));

    staker1DepositBalance1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    console.log("staker1DepositBalance1:\t\t%d", ethers.formatUnits(staker1DepositBalance1, 18));
    expect(staker1DepositBalance1).to.equal(hre.ethers.parseUnits("100", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("1100", "ether"));

    // transfer reward tokens to node
    await rewardToken.connect(owner).approve(nodeStake, BigInt(100e18));
    await expect(nodeStake.connect(owner).transferRewardTo("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(40e18)))
      .to.emit(nodeStake, "TransferReward")
      .withArgs(owner.address,
        hre.ethers.parseUnits("40", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await expect(nodeStake.connect(owner).transferRewardTo("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(60e18)))
      .to.emit(nodeStake, "TransferReward")
      .withArgs(owner.address,
        hre.ethers.parseUnits("60", "ether"),
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    claimableRewardBalance = await nodeStake.claimableRewardBalance(staker1.address);
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("100", "ether"));

    claimableInterestBalance = await nodeStake.claimableInterestBalance(staker1.address);
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("0", "ether"));


    const startTime = await time.latest() + 60;

    // On 15th days after
    timeTo = startTime + 15 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n15th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("100", "ether"));

    await expect(nodeStake.connect(staker1).withdraw(0, staker1.address))
      .to.be.revertedWith("withdrawableBalance is zero");
    await expect(nodeStake.connect(staker2).claim(staker1.address, staker2.address))
      .to.be.revertedWith("beneficiary is invalid");
    await expect(nodeStake.connect(staker2).withdraw(0, staker2.address))
      .to.be.revertedWith("schedule is not exsit");

    // On 30th days after
    timeTo = startTime + 30 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n30th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("250", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("10", "ether"));

    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("111", "ether")); // 100+10+1
    claimableRewardBalance = await nodeStake.claimableRewardBalance(staker1.address);
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    claimableInterestBalance = await nodeStake.claimableInterestBalance(staker1);
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("11", "ether"));

    console.log("\n----staker1 rebind 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU to staker2----");
    await expect(nodeBind.connect(staker1).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    console.log("--withdraw %d tokens--", ethers.formatUnits(withdrawableBalance, 18));
    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));
    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("1100", "ether"));

    await stakingToken.connect(staker1).transfer(staker2, hre.ethers.parseUnits("1000", 18));

    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));
    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("1100", "ether"));

    await stakingToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await expect(nodeStake.connect(staker1).withdraw(0, staker2.address))
      .to.be.revertedWith("ERC20: burn amount exceeds balance");

    await stakingToken.connect(staker2).transfer(staker1, hre.ethers.parseUnits("1000", 18));

    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("1100", "ether"));
    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("1100", "ether"));

    // await stakingToken.connect(staker2).approve(nodeStake, BigInt(1000e18));
    await nodeStake.connect(owner).setCanWithdraw(false);

    await expect(nodeStake.connect(staker1).withdraw(0, staker2.address))
      .to.be.revertedWith("withdrawls and claims have been banned");

    await nodeStake.connect(owner).setCanWithdraw(true);

    await expect(nodeStake.connect(staker1).withdraw(0, staker2.address))
      .to.emit(nodeStake, "Withdrawed")
      .withArgs(staker1.address,
        staker2.address,
        hre.ethers.parseUnits("250", "ether"),
        0)
      .to.emit(nodeStake, "Claimed")
      .withArgs(staker1.address,
        staker2.address,
        hre.ethers.parseUnits("0", "ether"),
        hre.ethers.parseUnits("10", "ether"));

    staker1StBalance = await stakingToken.balanceOf(staker1);
    expect(staker1StBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    staker2StBalance = await stakingToken.balanceOf(staker2);
    expect(staker2StBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    stakingTokenTotalSupply = await stakingToken.totalSupply();
    expect(stakingTokenTotalSupply).to.equal(hre.ethers.parseUnits("100", "ether"));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(staker2.address);
    expect(vesingScheduleList.length).to.equal(1);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
    }

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("0", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("100", "ether"));

    schedules = await nodeStake.getSchedules(staker1.address);
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, withdrawed=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), ethers.formatEther(schedule.withdrawed), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("101", "ether")); //100 + 1
    claimableRewardBalance = await nodeStake.claimableRewardBalance(staker1.address);
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    claimableInterestBalance = await nodeStake.claimableInterestBalance(staker1.address);
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("1", "ether"));

    console.log("--claim %d tokens--", ethers.formatUnits(claimableBalance, 18));
    await nodeStake.connect(owner).setCanWithdraw(false);

    await expect(nodeStake.connect(staker1).claim(staker1.address, staker2.address))
      .to.be.revertedWith("withdrawls and claims have been banned");

    await nodeStake.connect(owner).setCanWithdraw(true);

    await expect(nodeStake.connect(staker1).claim(staker1.address, staker2.address))
      .to.emit(nodeStake, "Claimed")
      .withArgs(staker1.address,
        staker2.address,
        hre.ethers.parseUnits("100", "ether"),
        hre.ethers.parseUnits("1", "ether"));
    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    schedules = await nodeStake.getSchedules(staker1.address);
    expect(schedules.length).to.equal(2);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, withdrawed=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), ethers.formatEther(schedule.withdrawed), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    // On 60th days after
    timeTo = startTime + 60 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n60th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("0", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("100", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));

    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("1", "ether"));

    await expect(nodeStake.connect(staker1).withdraw(0, staker2.address))
      .to.be.revertedWith("withdrawableBalance is zero");

    // await expect(nodeStake.connect(staker1).claim("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address))
    //   .to.be.revertedWith("claimable balance is zero");

    schedules = await nodeStake.getSchedules(staker2.address);
    expect(schedules.length).to.equal(0);

  });

  it("Should withdrw 50% token by the staker who deposit", async function () {

    const { rewardToken, nodeStake, scheduleRelease, owner, staker1, staker2, manager, test1, test2, stakingToken, nodeBind } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(100e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(100e18));

    // deposit tokens 
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await rewardToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(0), BigInt(1000e18));

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("1000", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    schedules = await nodeStake.getSchedules(staker1.address);
    expect(schedules.length).to.equal(1);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime);
    }

    const startTime = await time.latest() + 60;

    // On 15th days after
    timeTo = startTime + 15 * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n15th days after:\t%o", new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d 30days", elapsed, 36);

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("nodeBalanceType0:\t\t%d", ethers.formatUnits(nodeBalanceType0, 18));
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("1000", "ether"));
    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    console.log("nodeBalanceType1:\t\t%d", ethers.formatUnits(nodeBalanceType1, 18));
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    expect(amountBalance).to.equal(hre.ethers.parseUnits("1000", "ether"));

    await expect(nodeStake.connect(staker1).withdraw(0, staker1.address))
      .to.be.revertedWith("withdrawableBalance is zero");
    await expect(nodeStake.connect(staker2).claim(staker1.address, staker2.address))
      .to.be.revertedWith("beneficiary is invalid");
    await expect(nodeStake.connect(staker2).withdraw(0, staker2.address))
      .to.be.revertedWith("schedule is not exsit");

    // On 90th days after
    passedDays = 90;
    timeTo = startTime + passedDays * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n%dth days after:\t%o", passedDays, new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d x30days", elapsed, 36);

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    console.log("nodeBalanceType0:\t\t%d", ethers.formatUnits(nodeBalanceType0, 18));
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("1000", "ether"));
    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    console.log("nodeBalanceType1:\t\t%d", ethers.formatUnits(nodeBalanceType1, 18));
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("500", "ether")); // 500 = 1000 * 0.5
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("30", "ether")); // 30 = 1000 * 0.01 * 3

    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("30", "ether")); // 30
    claimableRewardBalance = await nodeStake.claimableRewardBalance(staker1.address);
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    claimableInterestBalance = await nodeStake.claimableInterestBalance(staker1.address);
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("30", "ether"));

    console.log("\n----staker1 rebind 16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU to staker2----");
    await expect(nodeBind.connect(staker1).rebind("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker2.address))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker2.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    console.log("--withdraw %d tokens--", ethers.formatUnits(withdrawableBalance, 18));
    await stakingToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await expect(nodeStake.connect(staker1).withdraw(0, test1.address))
      .to.emit(nodeStake, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("500", "ether"),
        0)
      .to.emit(nodeStake, "Claimed")
      .withArgs(
        staker1.address,
        test1.address,
        hre.ethers.parseUnits("0", "ether"),
        hre.ethers.parseUnits("30", "ether"));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(1);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
      expect(vesingSchedule.beneficiary).to.equal(test1.address);
    }

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("0", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    test1Balance = await rewardToken.balanceOf(test1);
    expect(test1Balance).to.equal(hre.ethers.parseUnits("30", "ether"));


  });

  it("Should withdrw 100% token by the staker who deposit", async function () {

    const { rewardToken, nodeStake, scheduleRelease, owner, staker1, staker2, manager, test1, test2, stakingToken, nodeBind } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(100e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(100e18));

    await rewardToken.transfer(nodeStake.target, hre.ethers.parseUnits("60", 18));
    // const tx = await owner.sendTransaction({ to: nodeStake.target, value: hre.ethers.parseUnits("60", "ether") });
    // await tx.wait();

    // deposit tokens 
    await expect(nodeBind.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeBind, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

    await rewardToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(0), BigInt(1000e18));

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1060", "ether"));

    console.log("contractBalance:\t%d", ethers.formatUnits(contractBalance, 18));
    expect(contractBalance).to.equal(hre.ethers.parseUnits("1060", "ether"));

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("1000", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    schedules = await nodeStake.getSchedules(staker1.address);
    expect(schedules.length).to.equal(1);

    for (let i = 0; i < schedules.length; i++) {
      schedule = schedules[i]
      console.log("schedule[%d]:\t\tdepositType=%d, start=%d, duration=%d, amountTotal=%d Ether, yieldRate=%d, rewarded=%d Ether, withdrawedTime=%d, nodeId=%s",
        i, schedule.depositType, schedule.start, schedule.duration, ethers.formatEther(schedule.amountTotal), schedule.yieldRate, ethers.formatEther(schedule.rewarded), schedule.withdrawedTime, schedule.nodeId);
    }

    const startTime = await time.latest() + 60;

    // On 150 days after
    passedDays = 150;
    timeTo = startTime + passedDays * ONE_DAY_IN_SECS;
    await time.increaseTo(timeTo);
    console.log("\n%dth days after:\t%o", passedDays, new Date((timeTo) * 1000));
    elapsed = BigInt(timeTo - startTime) / BigInt(ONE_DAY_IN_SECS * 30);
    console.log("elapsed:\t\t%d/%d x30days", elapsed, 36);

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("1000", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    [withdrawableBalance, rewardBalance, amountBalance] = await nodeStake.balanceOfSchedule(staker1.address, 0);
    console.log("withdrawableBalance:\t%d", ethers.formatUnits(withdrawableBalance, 18));
    console.log("rewardBalance:\t\t%d", ethers.formatUnits(rewardBalance, 18));
    console.log("amountBalance:\t\t%d", ethers.formatUnits(amountBalance, 18));
    expect(withdrawableBalance).to.equal(hre.ethers.parseUnits("1000", "ether")); // 1000 
    expect(rewardBalance).to.equal(hre.ethers.parseUnits("50", "ether")); // 50 = 1000 * 0.01 * 5

    claimableBalance = await nodeStake.claimableBalance(staker1.address);
    console.log("claimableBalance:\t%d", ethers.formatUnits(claimableBalance, 18));
    expect(claimableBalance).to.equal(hre.ethers.parseUnits("50", "ether")); // 50 = 1000 * 0.01 * 5
    claimableRewardBalance = await nodeStake.claimableRewardBalance(staker1.address);
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    claimableInterestBalance = await nodeStake.claimableInterestBalance(staker1.address);
    console.log("claimableInterestBalance:\t%d", claimableInterestBalance);
    expect(claimableInterestBalance).to.equal(hre.ethers.parseUnits("50", "ether")); // 50 = 1000 * 0.01 * 5

    console.log("--withdraw %d tokens--", ethers.formatUnits(withdrawableBalance, 18));
    await stakingToken.connect(staker1).approve(nodeStake, BigInt(1000e18));
    await expect(nodeStake.connect(staker1).withdraw(0, test1.address))
      .to.emit(nodeStake, "Withdrawed")
      .withArgs(staker1.address,
        test1.address,
        hre.ethers.parseUnits("1000", "ether"),
        0)
      .to.emit(nodeStake, "Claimed")
      .withArgs(
        staker1.address,
        test1.address,
        hre.ethers.parseUnits("0", "ether"),
        hre.ethers.parseUnits("50", "ether"));

    vesingScheduleList = await scheduleRelease.getVestingSchedule(test1.address);
    expect(vesingScheduleList.length).to.equal(1);

    for (let i = 0; i < vesingScheduleList.length; i++) {
      vesingSchedule = vesingScheduleList[i]
      console.log("vesingSchedule[%d]: beneficiary=%s, start=%d, duration=%d, durationUnits=%d, amountTotal=%d Ether",
        i, vesingSchedule.beneficiary, vesingSchedule.start, vesingSchedule.duration, vesingSchedule.durationUnits, ethers.formatEther(vesingSchedule.amountTotal));
      expect(vesingSchedule.beneficiary).to.equal(test1.address);
    }

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("0", "ether"));

    nodeBalanceType1 = await nodeStake.balanceOfNodeByDepositType(staker1.address, "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 1);
    expect(nodeBalanceType1).to.equal(hre.ethers.parseUnits("0", "ether"));

    test1Balance = await rewardToken.balanceOf(test1);
    console.log("test1Balance:\t\t%d", ethers.formatUnits(test1Balance, 18));
    expect(test1Balance).to.equal(hre.ethers.parseUnits("50", "ether"));


  });

  it("Should transfer token to contract", async function () {
    const { rewardToken, nodeStake, scheduleRelease, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );

    console.log(await hre.ethers.provider.getBalance(nodeStake.target));

    await rewardToken.transfer(nodeStake.target, hre.ethers.parseUnits("100", 18));

    // const tx = await owner.sendTransaction({ to: nodeStake.target, value: hre.ethers.parseUnits("100", "ether") });
    // await tx.wait();

    contractBalance = await rewardToken.balanceOf(nodeStake.target);
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
