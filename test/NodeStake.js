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
    const scheduleRelease = await hre.ethers.deployContract("ReleaseVestingV1", [rewardToken, 0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeStake contract
    const nodeStake = await hre.ethers.deployContract("NodeStakeV1", [rewardToken, scheduleRelease, manager]);
    await nodeStake.waitForDeployment();

    await rewardToken.transfer(staker1, hre.ethers.parseUnits("30", 18));
    await rewardToken.transfer(staker2, hre.ethers.parseUnits("81", 18));

    return { nodeStake, scheduleRelease, rewardToken, owner, staker1, staker2, manager };
  }

  it("Should claim reward with signature", async function () {
    const { nodeStake, scheduleRelease, rewardToken, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );
    console.log(owner.address);
    await rewardToken.transfer(nodeStake, hre.ethers.parseUnits("300", 18));

    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      BigInt("107718786558253467500"),
      '0x2e7858c7ae0c7b2a10cced64f22b85c2d1b65c94',
      "16Uiu2HAkusoXqi4dj6hyXqcSYEBLM1MS7q4AiqyPPAhRdkpvcA2V",
      "65ce2f41fccb4dc59e7a514e",
      "0xfdc0341efb9c0eb04dcedc1c0a0edcf0dc0534848e5eecab5614daffe658151d74fca562b9b153e83cbfeb4eee6161ac8ee3b07d3c22a6f77ed96333715b7ebf1c"))
      .to.be.revertedWith("verifyClaimSigner: signature validation failed");

  });

  it("Should claim reward", async function () {
    const { nodeStake, scheduleRelease, rewardToken, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );

    await rewardToken.transfer(nodeStake, hre.ethers.parseUnits("100", 18));

    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0001",
      makeClaimSign(
        manager,
        hre.ethers.parseUnits("10", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001")))
      .to.be.revertedWith("verifyClaimSigner: signature validation failed");

    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0001",
      makeClaimSign(
        manager,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002")))
      .to.be.revertedWith("verifyClaimSigner: signature validation failed");

    await expect(nodeStake.connect(staker1).revoke("c0001"))
      .to.be.revertedWith("caller is not the manager");

    await expect(nodeStake.connect(staker1).setManager(staker1))
      .to.be.revertedWith("caller is not the owner");

    await expect(nodeStake.connect(staker1).transferOwnership(staker1))
      .to.be.revertedWith("caller is not the owner");

    await expect(nodeStake.connect(owner).transferOwnership(staker1))
      .to.emit(nodeStake, "OwnershipTransferred")
      .withArgs(owner.address, staker1.address);

    await expect(nodeStake.connect(owner).setManager(staker1))
      .to.be.revertedWith("caller is not the owner");

    await expect(nodeStake.connect(staker1).transferOwnership(owner))
      .to.emit(nodeStake, "OwnershipTransferred")
      .withArgs(staker1.address, owner.address);

    await nodeStake.connect(owner).setManager(staker1)
    await expect(nodeStake.connect(manager).revoke("c0001"))
      .to.be.revertedWith("caller is not the manager");

    await nodeStake.connect(owner).setManager(manager)

    await nodeStake.connect(manager).revoke("c0001");
    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0001",
      makeClaimSign(
        manager,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001")))
      .to.be.revertedWith("verifyClaimSigner: signature validation failed");


    await expect(nodeStake.connect(manager).setCanClaim(false))
      .to.be.revertedWith("caller is not the owner");

    nodeStake.connect(owner).setCanClaim(false);
    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker2.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0002",
      makeClaimSign(
        manager,
        hre.ethers.parseUnits("50", 18),
        staker2.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002")))
      .to.be.revertedWith("claim stop");


    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance).to.equal(hre.ethers.parseUnits("30", "ether"));

    staker2TokenBalance = await rewardToken.balanceOf(staker2);
    console.log("staker2TokenBalance:\t%d", ethers.formatUnits(staker2TokenBalance, 18));
    expect(staker2TokenBalance).to.equal(hre.ethers.parseUnits("81", "ether"));

    nodeStake.connect(owner).setCanClaim(true);
    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker2.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0002",
      makeClaimSign(
        manager,
        hre.ethers.parseUnits("50", 18),
        staker2.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002")))
      .to.emit(nodeStake, "Claimed")
      .withArgs(staker2.address,
        hre.ethers.parseUnits("50", 18),
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002");


    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance).to.equal(hre.ethers.parseUnits("30", "ether"));

    staker2TokenBalance = await rewardToken.balanceOf(staker2);
    console.log("staker2TokenBalance:\t%d", ethers.formatUnits(staker2TokenBalance, 18));
    expect(staker2TokenBalance).to.equal(hre.ethers.parseUnits("131", "ether"));

    await expect(nodeStake.connect(staker1).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0002",
      makeClaimSign(
        manager,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002")))
      .to.be.revertedWith("verifyClaimSigner: signature validation failed");

    nodeStakeTokenBalance = await rewardToken.balanceOf(nodeStake);
    console.log("nodeStakeTokenBalance:\t%d", ethers.formatUnits(nodeStakeTokenBalance, 18));
    expect(nodeStakeTokenBalance).to.equal(hre.ethers.parseUnits("50", "ether"));

    await expect(nodeStake.connect(staker1).withdrawRewardForEmergency(hre.ethers.parseUnits("50", 18)))
      .to.be.revertedWith("caller is not the owner");

    await expect(nodeStake.connect(owner).withdrawRewardForEmergency(hre.ethers.parseUnits("51", 18)))
      .to.be.revertedWith("withdrawRewardForEmergency: balance of tokens is not enough");


    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(5e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(5e18));
    nodeStakeTokenBalance = await rewardToken.balanceOf(nodeStake);
    console.log("nodeStakeTokenBalance:\t%d", ethers.formatUnits(nodeStakeTokenBalance, 18));
    expect(nodeStakeTokenBalance).to.equal(hre.ethers.parseUnits("55", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("5", "ether"));

    await expect(nodeStake.connect(owner).withdrawRewardForEmergency(hre.ethers.parseUnits("51", 18)))
      .to.be.revertedWith("withdrawRewardForEmergency: rewardInPool is not enough");


    await expect(nodeStake.connect(owner).withdrawRewardForEmergency(hre.ethers.parseUnits("25", 18)))
      .to.emit(nodeStake, "WithdrawedForEmergency")
      .withArgs(owner.address,
        hre.ethers.parseUnits("25", 18));

    nodeStakeTokenBalance = await rewardToken.balanceOf(nodeStake);
    console.log("nodeStakeTokenBalance:\t%d", ethers.formatUnits(nodeStakeTokenBalance, 18));
    expect(nodeStakeTokenBalance).to.equal(hre.ethers.parseUnits("30", "ether"));

    await expect(nodeStake.connect(owner).withdrawRewardForEmergency(hre.ethers.parseUnits("26", 18)))
      .to.be.revertedWith("withdrawRewardForEmergency: rewardInPool is not enough");

    await expect(nodeStake.connect(owner).withdrawRewardForEmergency(hre.ethers.parseUnits("25", 18)))
      .to.emit(nodeStake, "WithdrawedForEmergency")
      .withArgs(owner.address,
        hre.ethers.parseUnits("25", 18));

    nodeStakeTokenBalance = await rewardToken.balanceOf(nodeStake);
    console.log("nodeStakeTokenBalance:\t%d", ethers.formatUnits(nodeStakeTokenBalance, 18));
    expect(nodeStakeTokenBalance).to.equal(hre.ethers.parseUnits("5", "ether"));


  });


  it("Should withdrw token by the staker who deposit", async function () {

    const { nodeStake, scheduleRelease, rewardToken, owner, staker1, staker2, manager } = await loadFixture(
      deployContractFixture
    );

    await expect(nodeStake.connect(staker1).setLimit(BigInt(5e18), BigInt(30e18)))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setLimit(BigInt(5e18), BigInt(80e18));

    // deposit tokens 
    console.log("\n----staker1 deposits 30 tokens----");

    // dataHash = ethers.solidityPackedKeccak256(['address', 'string'], [staker1.address.toLowerCase(), "a01231"]);
    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");


    await rewardToken.connect(staker1).approve(nodeStake, BigInt(5e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(5e18));
    await rewardToken.connect(staker1).approve(nodeStake, BigInt(5e18));
    await nodeStake.connect(staker1).deposit("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", BigInt(5e18));

    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker1.address, "a01232", makeBindSign(manager, '16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG', staker1.address.toLowerCase(), "a01232")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");


    await rewardToken.connect(staker1).approve(nodeStake, BigInt(20e18));

    await expect(nodeStake.connect(manager).setCanDeposit(false))
      .to.be.revertedWith("caller is not the owner");

    await nodeStake.connect(owner).setCanDeposit(false);
    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(20e18)))
      .to.be.revertedWith("deposit stop");

    await nodeStake.connect(owner).setCanDeposit(true);

    await expect(nodeStake.connect(staker1).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(20e18)))
      .to.emit(nodeStake, "Deposited")
      .withArgs(staker1.address,
        BigInt(20e18),
        "16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG");


    await rewardToken.connect(staker2).approve(nodeStake, BigInt(1e18));
    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(1e18)))
      .to.be.revertedWith("deposit: less than minimum limit");

    await rewardToken.connect(staker2).approve(nodeStake, BigInt(81e18));
    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(81e18)))
      .to.be.revertedWith("deposit: greater than maximum limit");

    await rewardToken.connect(staker2).approve(nodeStake, BigInt(5e18));
    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", BigInt(5e18)))
      .to.be.revertedWith("deposit: beneficiary not good");

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
      nodeStake.connect(staker2).withdraw("16Uiu2HAmDevknQd5BncjmLiwiLLdmbDRutqDb5rohFDUX2eDZssG", staker2, hre.ethers.parseUnits("20", "ether"))
    ).to.be.revertedWith("withdraw: beneficiary not good");
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
    await nodeStake.connect(staker2).bindNode("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT", staker2.address, "a01233", makeBindSign(manager, '16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT', staker2.address.toLowerCase(), "a01233"));
    await rewardToken.connect(staker2).approve(nodeStake, BigInt(80e18));
    await nodeStake.connect(staker2).deposit("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT", BigInt(80e18));

    node3Balance = await nodeStake.balanceOfNode("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT");
    console.log("node3Balance:\t\t%d", ethers.formatUnits(node3Balance, 18));
    expect(node3Balance).to.equal(hre.ethers.parseUnits("80", "ether"));

    await rewardToken.connect(staker2).approve(nodeStake, BigInt(5e18));
    await expect(nodeStake.connect(staker2).deposit("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT", BigInt(5e18)))
      .to.be.revertedWith("deposit: greater than maximum limit");

    staker1Balance = await nodeStake.balanceOf(staker1);
    console.log("staker1Balance:\t\t%d", ethers.formatUnits(staker1Balance, 18));
    expect(staker1Balance).to.equal(hre.ethers.parseUnits("10", "ether"));

    staker2Balance = await nodeStake.balanceOf(staker2);
    console.log("staker2Balance:\t\t%d", ethers.formatUnits(staker2Balance, 18));
    expect(staker2Balance).to.equal(hre.ethers.parseUnits("80", "ether"));

    tokenInPool = await nodeStake.tokenInPool();
    console.log("tokenInPool:\t\t%d", ethers.formatUnits(tokenInPool, 18));
    expect(tokenInPool).to.equal(hre.ethers.parseUnits("90", "ether"));


    console.log("\n----staker1 releases 20 tokens from ReleaseVestingV1 contract----");
    const now = await time.latest();

    timeTo = now + 30 * ONE_DAY_IN_SECS + 15 * 60;
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



async function makeBindSign(manager, nodeId, caller, nonce) {
  chainId = await hre.network.config.chainId;
  // console.log("chainId:\t\t%d", chainId);
  signature = '';
  dataHash = ethers.solidityPackedKeccak256(['uint256', 'address', 'string', 'string'], [chainId, caller, nodeId, nonce]);

  messageBytes = ethers.getBytes(dataHash);
  signature = await manager.signMessage(messageBytes);
  return signature;
}


async function makeClaimSign(manager, tokenAmount, beneficiary, nodeId, nonce) {
  chainId = await hre.network.config.chainId;
  // console.log("chainId:\t\t%d", chainId);
  signature = '';
  dataHash = ethers.solidityPackedKeccak256(['uint256', 'uint256', 'address', 'string', 'string'], [chainId, tokenAmount, beneficiary, nodeId, nonce]);

  messageBytes = ethers.getBytes(dataHash);
  signature = await manager.signMessage(messageBytes);
  return signature;
}
