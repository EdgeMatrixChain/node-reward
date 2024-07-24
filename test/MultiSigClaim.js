const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

function Enum(...options) {
  return Object.fromEntries(options.map((key, i) => [key, i]));
}


const ONE_DAY_IN_SECS = 24 * 60 * 60;
const ONE_ETHER = BigInt(1e18);
const ONE_USDT = BigInt(1e6);


describe("MultiSigClaim Contract V1", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, signerA, signerB, signerC, staker1, staker2, staker3] = await ethers.getSigners();

  console.log("staker3:\t\t%s", staker3.address);



    // deploy reward and fund token contract, then tranfer tokens to test account
    const rewardToken = await hre.ethers.deployContract("TestToken", [100000]);
    await rewardToken.waitForDeployment();


    // deploy ReleaseVesting contract
    const scheduleRelease = await hre.ethers.deployContract("ReleaseVestingV1", [rewardToken, 0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeStake contract
    const nodeStake = await hre.ethers.deployContract("NodeStakeV1", [rewardToken, scheduleRelease, signerA]);
    await nodeStake.waitForDeployment();

    // deploy MultiSigClaim contract
    const multiSigClaim = await hre.ethers.deployContract("MultiSigClaim", [rewardToken, nodeStake, signerA, signerB, signerC]);
    await multiSigClaim.waitForDeployment();

    await rewardToken.transfer(multiSigClaim, hre.ethers.parseUnits("100", 18));
    // await rewardToken.transfer(staker2, hre.ethers.parseUnits("81", 18));

    return { nodeStake, multiSigClaim, rewardToken, owner, staker1, staker2, signerA, signerB, signerC };
  }

  it("Should claim reward with signature", async function () {
    const { nodeStake, multiSigClaim, rewardToken, owner, staker1, staker2, signerA, signerB, signerC } = await loadFixture(
      deployContractFixture
    );


    await expect(nodeStake.connect(staker1)
      .bindNode("16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT", staker1.address, "b001", makeBindSign(signerA, '16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT', staker1.address.toLowerCase(), "b001")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT");


    staker1TokenBalance0 = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance0:\t%d", ethers.formatUnits(staker1TokenBalance0, 18));

    await expect(multiSigClaim.connect(owner).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0001",
      makeClaimSign(
        signerA,
        hre.ethers.parseUnits("10", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001"),
      makeClaimSign(
        signerB,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001"),
      makeClaimSign(
        signerC,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001")))
      .to.be.revertedWith("verifyClaimSigner: signatureA validation failed");

    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance).to.equal(staker1TokenBalance0);

    await expect(multiSigClaim.connect(owner).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0001",
      makeClaimSign(
        signerA,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001"),
      makeClaimSign(
        signerB,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0000"),
      makeClaimSign(
        signerC,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001")))
      .to.be.revertedWith("verifyClaimSigner: signatureB validation failed");

    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance).to.equal(staker1TokenBalance0);

    await expect(multiSigClaim.connect(owner).ClaimWithSignature(
      hre.ethers.parseUnits("50", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0001",
      makeClaimSign(
        signerA,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001"),
      makeClaimSign(
        signerB,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0001"),
      makeClaimSign(
        signerC,
        hre.ethers.parseUnits("50", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0000")))
      .to.be.revertedWith("verifyClaimSigner: signatureC validation failed");

    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance).to.equal(staker1TokenBalance0);

    await expect(multiSigClaim.connect(owner).ClaimWithSignature(
      hre.ethers.parseUnits("1", 18),
      staker2.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0002",
      makeClaimSign(
        signerA,
        hre.ethers.parseUnits("1", 18),
        staker2.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002"),
      makeClaimSign(
        signerB,
        hre.ethers.parseUnits("1", 18),
        staker2.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002"),
      makeClaimSign(
        signerC,
        hre.ethers.parseUnits("1", 18),
        staker2.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002")))
      .to.be.revertedWith("verifyClaimSigner: _beneficiary not good");

    await expect(multiSigClaim.connect(owner).ClaimWithSignature(
      hre.ethers.parseUnits("1", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhB",
      "c0002",
      makeClaimSign(
        signerA,
        hre.ethers.parseUnits("1", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhB",
        "c0002"),
      makeClaimSign(
        signerB,
        hre.ethers.parseUnits("1", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhB",
        "c0002"),
      makeClaimSign(
        signerC,
        hre.ethers.parseUnits("1", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhB",
        "c0002")))
      .to.be.revertedWith("verifyClaimSigner: _beneficiary not good");

    await expect(multiSigClaim.connect(owner).ClaimWithSignature(
      hre.ethers.parseUnits("1", 18),
      staker1.address,
      "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
      "c0002",
      makeClaimSign(
        signerA,
        hre.ethers.parseUnits("1", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002"),
      makeClaimSign(
        signerB,
        hre.ethers.parseUnits("1", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002"),
      makeClaimSign(
        signerC,
        hre.ethers.parseUnits("1", 18),
        staker1.address,
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002")))
      .to.emit(multiSigClaim, "Claimed")
      .withArgs(staker1.address,
        hre.ethers.parseUnits("1", 18),
        "16Uiu2HAmKS1Sfixq3i6Pt1rqXhSsAvv5EML8C2AL3Y8WK7BamKhT",
        "c0002");

    staker1TokenBalance = await rewardToken.balanceOf(staker1);
    console.log("staker1TokenBalance:\t%d", ethers.formatUnits(staker1TokenBalance, 18));
    expect(staker1TokenBalance - staker1TokenBalance0).to.equal(hre.ethers.parseUnits("1", "ether"));


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


async function makeClaimSign(signer, tokenAmount, beneficiary, nodeId, nonce) {
  chainId = await hre.network.config.chainId;
  // console.log("\nchainId:\t\t%d", chainId);
  // console.log("tokenAmount:\t\t%d", tokenAmount);
  // console.log("nodeId:\t\t\t%s", nodeId);
  // console.log("beneficiary:\t\t%s", beneficiary);
  // console.log("nonce:\t\t\t%s", nonce);
  signature = '';

  dataHash = ethers.solidityPackedKeccak256(['uint256', 'uint256', 'string', 'address', 'string'], [chainId, tokenAmount, nodeId, beneficiary, nonce]);
  messageBytes = ethers.getBytes(dataHash);

  signature = await signer.signMessage(messageBytes);
  console.log("\nsginer:\t\t\t%s", signer.address)
  console.log("dataHash:\t\t%s", dataHash)
  console.log("signature:\t\t%s", signature)


  // signature2 = await signer.signMessage("hello");
  // console.log("signature2:\t\t%s", signature2)

  return signature;
}
