const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

function Enum(...options) {
  return Object.fromEntries(options.map((key, i) => [key, i]));
}


const ONE_DAY_IN_SECS = 24 * 60 * 60;
const ONE_ETHER = BigInt(1e18);
const ONE_USDT = BigInt(1e6);


describe("NodeStake Contract V1", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, staker1, staker2, manager] = await ethers.getSigners();

    // deploy reward and fund token contract, then tranfer tokens to test account
    const rewardToken = await hre.ethers.deployContract("TestToken", [100000]);
    await rewardToken.waitForDeployment();


    // deploy NodeStake contract
    const scheduleRelease = await hre.ethers.deployContract("ScheduledRelease", [rewardToken, 0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeStake contract
    const nodeStake = await hre.ethers.deployContract("NodeStakeV1", [rewardToken, scheduleRelease]);
    await nodeStake.waitForDeployment();

    await rewardToken.transfer(staker1, hre.ethers.parseUnits("30", 18));
    await rewardToken.transfer(staker2, hre.ethers.parseUnits("80", 18));

    return { nodeStake, scheduleRelease, rewardToken, owner, staker1, staker2, manager };
  }



  it("Should withdrw token by the staker who deposit", async function () {

    const { nodeStake, scheduleRelease, rewardToken, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );


    // deposit tokens 
    console.log("\n----staker1 deposits 30 tokens----");
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(5e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(5e18));
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(5e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(5e18));

    await rewardToken.connect(staker1).approve(nodeStake, BigInt(20e18));
    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(20e18)))
      .to.emit(nodeStake, "Deposited")
      .withArgs(staker1.address,
        BigInt(20e18),
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    staker1Balance = await nodeStake.balanceOf(staker1);
    console.log("staker1Balance:\t\t%d", ethers.formatUnits(staker1Balance, 18));
    expect(staker1Balance).to.equal(hre.ethers.parseUnits("30", "ether"));

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("10", "ether"));

    node2Balance = await nodeStake.balanceOfNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");
    console.log("node2Balance:\t\t%d", ethers.formatUnits(node2Balance, 18));
    expect(node2Balance).to.equal(hre.ethers.parseUnits("20", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("30", "ether"));


    console.log("\n----staker1 withdraws 20 ether----");
    await expect(
      nodeStake.connect(staker1).withdraw("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1, hre.ethers.parseUnits("21", "ether"))
    ).to.be.revertedWith("withdraw: amount not good");

    withdrawAmount = hre.ethers.parseUnits("20", "ether");
    await expect(
      nodeStake.connect(staker1).withdraw("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1, withdrawAmount)
    ).to.emit(nodeStake, "Withdrawed")
      .withArgs(staker1.address,
        withdrawAmount,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");

    staker1Balance = await nodeStake.balanceOf(staker1);
    console.log("staker1Balance:\t\t%d", ethers.formatUnits(staker1Balance, 18));
    expect(staker1Balance).to.equal(hre.ethers.parseUnits("10", "ether"));

    node1Balance = await nodeStake.balanceOfNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("node1Balance:\t\t%d", ethers.formatUnits(node1Balance, 18));
    expect(node1Balance).to.equal(hre.ethers.parseUnits("10", "ether"));

    node2Balance = await nodeStake.balanceOfNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");
    console.log("node2Balance:\t\t%d", ethers.formatUnits(node2Balance, 18));
    expect(node2Balance).to.equal(hre.ethers.parseUnits("0", "ether"));

    staker1Pending = await scheduleRelease.balanceOf(staker1);
    console.log("staker1Pending:\t\t%d", ethers.formatUnits(staker1Pending, 18));
    expect(staker1Pending).to.equal(hre.ethers.parseUnits("20", "ether"));

    staker1Releasable = await scheduleRelease.getReleasableAmount(staker1);
    console.log("staker1Releasable:\t%d", ethers.formatUnits(staker1Releasable, 18));
    expect(staker1Releasable).to.equal(hre.ethers.parseUnits("0", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("10", "ether"));


    console.log("\n----staker2 deposits 80 tokens----");
    await rewardToken.connect(staker2).approve(nodeStake, BigInt(80e18));
    await nodeStake.connect(staker2).deposit("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT", BigInt(80e18));

    node3Balance = await nodeStake.balanceOfNode("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT");
    console.log("node3Balance:\t\t%d", ethers.formatUnits(node3Balance, 18));
    expect(node3Balance).to.equal(hre.ethers.parseUnits("80", "ether"));

    staker1Balance = await nodeStake.balanceOf(staker1);
    console.log("staker1Balance:\t\t%d", ethers.formatUnits(staker1Balance, 18));
    expect(staker1Balance).to.equal(hre.ethers.parseUnits("10", "ether"));

    staker2Balance = await nodeStake.balanceOf(staker2);
    console.log("staker2Balance:\t\t%d", ethers.formatUnits(staker2Balance, 18));
    expect(staker2Balance).to.equal(hre.ethers.parseUnits("80", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("90", "ether"));


    console.log("\n----staker1 releases 20 tokens from ScheduleRelease contract----");
    const now = await time.latest();

    timeTo = now + 5 * ONE_DAY_IN_SECS + 15 * 60;
    await time.increaseTo(timeTo);

    staker1Pending = await scheduleRelease.balanceOf(staker1);
    console.log("staker1Pending:\t\t%d", ethers.formatUnits(staker1Pending, 18));
    expect(staker1Pending).to.equal(hre.ethers.parseUnits("20", "ether"));

    staker1Releasable = await scheduleRelease.getReleasableAmount(staker1);
    console.log("staker1Releasable:\t%d", ethers.formatUnits(staker1Releasable, 18));
    expect(staker1Releasable).to.equal(hre.ethers.parseUnits("20", "ether"));

    await expect(
      scheduleRelease.connect(staker1).release(staker1)
    ).to.emit(scheduleRelease, "TokensReleased")
      .withArgs(
        staker1.address,
        hre.ethers.parseUnits("20", "ether"));

    staker1Pending = await scheduleRelease.balanceOf(staker1);
    console.log("staker1Pending:\t\t%d", ethers.formatUnits(staker1Pending, 18));
    expect(staker1Pending).to.equal(hre.ethers.parseUnits("0", "ether"));

    staker1Releasable = await scheduleRelease.getReleasableAmount(staker1);
    console.log("staker1Releasable:\t%d", ethers.formatUnits(staker1Releasable, 18));
    expect(staker1Releasable).to.equal(hre.ethers.parseUnits("0", "ether"));

    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance).to.equal(hre.ethers.parseUnits("20", "ether"));

  });



});



