const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
// const { AddressZero } = require("ethers");

function Enum(...options) {
  return Object.fromEntries(options.map((key, i) => [key, i]));
}


const ONE_DAY_IN_SECS = 24 * 60 * 60;
const ONE_ETHER = BigInt(1e18);
const ONE_USDT = BigInt(1e6);


describe("WrappedToke test", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, staker1, staker2] = await ethers.getSigners();

    // deploy reward and fund token contract, then tranfer tokens to test account
    const rewardToken = await hre.ethers.deployContract("TestToken", [100000]);
    await rewardToken.waitForDeployment();


    // deploy reward and fund token contract, then tranfer tokens to test account
    const wToken = await hre.ethers.deployContract("WrappedToken", [rewardToken, "Wrapped TST", "WTST"]);
    await rewardToken.waitForDeployment();

    await rewardToken.transfer(staker1, hre.ethers.parseUnits("1000", 18));

    return { wToken, rewardToken, owner, staker1, staker2 };
  }


  it("Should mint and burn wrapped token", async function () {
    const { wToken, rewardToken, owner, staker1, staker2 } = await loadFixture(
      deployContractFixture
    );

    tokenName = await wToken.name();
    expect(tokenName).to.equal("Wrapped TST");

    tokenSymbol = await wToken.symbol();
    expect(tokenSymbol).to.equal("WTST");

    await rewardToken.connect(staker1).approve(wToken, BigInt(100e18));
    // emit Transfer(address(0), account, amount);
    await expect(wToken.connect(staker1).depositFor(staker1.address, BigInt(100e18)))
      .to.emit(wToken, "Transfer")
      .withArgs("0x0000000000000000000000000000000000000000",
        staker1.address,
        BigInt(100e18),
      );

    totalSupplyOfWToken = await wToken.totalSupply();
    expect(totalSupplyOfWToken).to.equal(hre.ethers.parseUnits("100", "ether"));

    wTokensOfStake1 = await wToken.balanceOf(staker1.address);
    expect(wTokensOfStake1).to.equal(hre.ethers.parseUnits("100", "ether"));

    tokensOfStake1 = await rewardToken.balanceOf(staker1.address);
    expect(tokensOfStake1).to.equal(hre.ethers.parseUnits("900", "ether"));

    await wToken.connect(staker1).transfer(staker2, hre.ethers.parseUnits("40", 18));

    wTokensOfStake1 = await wToken.balanceOf(staker1.address);
    expect(wTokensOfStake1).to.equal(hre.ethers.parseUnits("60", "ether"));

    wTokensOfStake2 = await wToken.balanceOf(staker2.address);
    expect(wTokensOfStake2).to.equal(hre.ethers.parseUnits("40", "ether"));

    tokensOfStake2 = await rewardToken.balanceOf(staker2.address);
    expect(tokensOfStake2).to.equal(hre.ethers.parseUnits("0", "ether"));

    // await rewardToken.connect(staker2).approve(wToken, BigInt(100e18));
    //emit Transfer(account, address(0), amount);
    await expect(wToken.connect(staker2).withdrawTo(staker2.address, BigInt(30e18)))
      .to.emit(wToken, "Transfer")
      .withArgs(staker2.address,
        "0x0000000000000000000000000000000000000000",
        BigInt(30e18),
      );

    totalSupplyOfWToken = await wToken.totalSupply();
    expect(totalSupplyOfWToken).to.equal(hre.ethers.parseUnits("70", "ether"));

    wTokensOfStake2 = await wToken.balanceOf(staker2.address);
    expect(wTokensOfStake2).to.equal(hre.ethers.parseUnits("10", "ether"));

    tokensOfStake2 = await rewardToken.balanceOf(staker2.address);
    expect(tokensOfStake2).to.equal(hre.ethers.parseUnits("30", "ether"));


  });



});
