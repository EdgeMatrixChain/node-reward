const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
// const { ethers } = require("hardhat");

function Enum(...options) {
  return Object.fromEntries(options.map((key, i) => [key, i]));
}

const proposalType = Enum('AddOwner', 'RemoveOwner');
const proposalTypeName = ['AddOwner', 'RemoveOwner'];


describe("MultiSigManager Contract V1", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [contractOwner, signerA, signerB, signerC, caller1, manager1, manager2] = await ethers.getSigners();

    // deploy multiSigTrans contract
    const multiSigManager = await hre.ethers.deployContract("MultiSigManager", [[signerA, signerB], 2]);
    await multiSigManager.waitForDeployment();

    // deploy ReleaseVestingNativeV1 contract
    const scheduleRelease = await hre.ethers.deployContract("ReleaseVestingNativeV1", [0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeStakeNativeV1 contract
    const days1080RewardRate = hre.ethers.parseUnits("0.36", "ether");
    const nodeStake = await hre.ethers.deployContract("NodeStakeNativeV1", [scheduleRelease, manager1, days1080RewardRate, 36]);
    await nodeStake.waitForDeployment();

    return { nodeStake, multiSigManager, contractOwner, signerA, signerB, signerC, caller1, manager1, manager2 };

  }

  it("Should manage owners", async function () {
    const { nodeStake, multiSigManager, contractOwner, signerA, signerB, signerC, caller1, manager1, manager2 } = await loadFixture(
      deployContractFixture
    );

    owners = await multiSigManager.getOwners();
    expect(owners.length).to.equal(2);

    for (let i = 0; i < owners.length; i++) {
      console.log("owners[%d]:\t\t%s",
        i, owners[i]);
    }

    proposalCount = await multiSigManager.getProposalCount();
    expect(proposalCount).to.equal(0);

    await expect(multiSigManager.connect(caller1).proposeOwner(signerC, proposalType.AddOwner))
      .to.be.revertedWith("not owner");

    await expect(multiSigManager.connect(signerA).proposeOwner(signerB, proposalType.AddOwner))
      .to.be.revertedWith("already a owner");

    await expect(multiSigManager.connect(signerA).proposeOwner(signerC, proposalType.AddOwner))
      .to.emit(multiSigManager, "ProposeOwner")
      .withArgs(signerA.address, 0, proposalType.AddOwner, signerC.address);

    proposalCount = await multiSigManager.getProposalCount();
    expect(proposalCount).to.equal(1);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(0);
    expect(owner).to.equal(signerC.address);
    expect(type).to.equal(proposalType.AddOwner);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(0);

    await expect(multiSigManager.connect(caller1).confirmProposal(0))
      .to.be.revertedWith("not owner");

    await expect(multiSigManager.connect(signerA).confirmProposal(1))
      .to.be.revertedWith("proposal does not exist");

    await expect(multiSigManager.connect(signerA).confirmProposal(0))
      .to.emit(multiSigManager, "ConfirmProposal")
      .withArgs(signerA.address, 0);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(0);
    expect(owner).to.equal(signerC.address);
    expect(type).to.equal(proposalType.AddOwner);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(1);

    await expect(multiSigManager.connect(signerA).confirmProposal(0))
      .to.be.revertedWith("proposal already confirmed");

    await expect(multiSigManager.connect(signerA).executeProposal(1))
      .to.be.revertedWith("proposal does not exist");

    await expect(multiSigManager.connect(caller1).executeProposal(0))
      .to.be.revertedWith("not owner");

    await expect(multiSigManager.connect(signerA).executeProposal(0))
      .to.be.revertedWith("cannot execute proposal");

    await expect(multiSigManager.connect(signerB).confirmProposal(0))
      .to.emit(multiSigManager, "ConfirmProposal")
      .withArgs(signerB.address, 0);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(0);
    expect(owner).to.equal(signerC.address);
    expect(type).to.equal(proposalType.AddOwner);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(2);

    await expect(multiSigManager.connect(signerA).executeProposal(0))
      .to.emit(multiSigManager, "ExecuteProposal")
      .withArgs(signerA.address, 0);

    console.log("executeProposal:\tindx=%d proposalType=AddOwner", 0);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(0);
    expect(owner).to.equal(signerC.address);
    expect(type).to.equal(proposalType.AddOwner);
    expect(executed).to.equal(true);
    expect(numConfirmations).to.equal(2);

    owners = await multiSigManager.getOwners();
    expect(owners.length).to.equal(3);

    for (let i = 0; i < owners.length; i++) {
      console.log("owners[%d]:\t\t%s",
        i, owners[i]);
    }

    await expect(multiSigManager.connect(signerC).executeProposal(0))
      .to.be.revertedWith("proposal already executed");


    await expect(multiSigManager.connect(caller1).proposeOwner(signerC, proposalType.RemoveOwner))
      .to.be.revertedWith("not owner");

    await expect(multiSigManager.connect(signerC).proposeOwner(caller1, proposalType.RemoveOwner))
      .to.be.revertedWith("not a owner");

    await expect(multiSigManager.connect(signerA).proposeOwner(signerB, proposalType.RemoveOwner))
      .to.emit(multiSigManager, "ProposeOwner")
      .withArgs(signerA.address, 1, proposalType.RemoveOwner, signerB.address);

    proposalCount = await multiSigManager.getProposalCount();
    expect(proposalCount).to.equal(2);

    await expect(multiSigManager.connect(signerA).confirmProposal(1))
      .to.emit(multiSigManager, "ConfirmProposal")
      .withArgs(signerA.address, 1);

    await expect(multiSigManager.connect(signerC).confirmProposal(1))
      .to.emit(multiSigManager, "ConfirmProposal")
      .withArgs(signerC.address, 1);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(1);
    expect(owner).to.equal(signerB.address);
    expect(type).to.equal(proposalType.RemoveOwner);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(2);

    await expect(multiSigManager.connect(caller1).revokeProposal(1))
      .to.be.revertedWith("not owner");

    await expect(multiSigManager.connect(signerC).revokeProposal(2))
      .to.be.revertedWith("proposal does not exist");

    await expect(multiSigManager.connect(signerC).revokeProposal(0))
      .to.be.revertedWith("proposal already executed");

    await expect(multiSigManager.connect(signerA).revokeProposal(1))
      .to.emit(multiSigManager, "RevokeProposal")
      .withArgs(signerA.address, 1);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(1);
    expect(owner).to.equal(signerB.address);
    expect(type).to.equal(proposalType.RemoveOwner);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(1);

    await expect(multiSigManager.connect(signerA).executeProposal(1))
      .to.be.revertedWith("cannot execute proposal");

    await expect(multiSigManager.connect(signerB).confirmProposal(1))
      .to.emit(multiSigManager, "ConfirmProposal")
      .withArgs(signerB.address, 1);

    [owner, type, proposedTime, executed, numConfirmations] = await multiSigManager.getProposal(1);
    expect(owner).to.equal(signerB.address);
    expect(type).to.equal(proposalType.RemoveOwner);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(2);

    await expect(multiSigManager.connect(signerA).executeProposal(1))
      .to.emit(multiSigManager, "ExecuteProposal")
      .withArgs(signerA.address, 1);

    console.log("executeProposal:\tindx=%d proposalType=RemoveOwner", 1);

    owners = await multiSigManager.getOwners();
    expect(owners.length).to.equal(2);

    for (let i = 0; i < owners.length; i++) {
      console.log("owners[%d]:\t\t%s",
        i, owners[i]);
    }

    await expect(multiSigManager.connect(signerB).proposeOwner(signerA, proposalType.RemoveOwner))
      .to.be.revertedWith("not owner");

    await expect(multiSigManager.connect(signerC).proposeOwner(signerA, proposalType.RemoveOwner))
      .to.be.revertedWith("the number of owner is too small");

  });

  it("Should call other contract", async function () {
    const { nodeStake, multiSigManager, contractOwner, signerA, signerB, signerC, caller1, manager1, manager2 } = await loadFixture(
      deployContractFixture
    );

    console.log("contractOwner:\t\t%s", contractOwner.address);
    // await expect(nodeStake.connect(owner).transferOwnership(staker1))
    //   .to.emit(nodeStake, "OwnershipTransferred")
    //   .withArgs(owner.address, staker1.address);

    await expect(nodeStake.connect(contractOwner).transferOwnership(multiSigManager))
      .to.emit(nodeStake, "OwnershipTransferred")
      .withArgs(contractOwner.address, multiSigManager.target);

    owners = await multiSigManager.getOwners();
    expect(owners.length).to.equal(2);

    for (let i = 0; i < owners.length; i++) {
      console.log("owners[%d]:\t\t%s",
        i, owners[i]);
    }

    transactionCount = await multiSigManager.getTransactionCount();
    expect(transactionCount).to.equal(0);

    tx = createTransaction(nodeStake.target, manager2);
    console.log("nodeStake contract:\t%s", nodeStake.target);
    console.log(tx);

    // emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data)
    await expect(multiSigManager.connect(signerA).submitTransaction(tx.to, BigInt(0e18), tx.data))
      .to.emit(multiSigManager, "SubmitTransaction")
      .withArgs(signerA.address, 0, nodeStake.target, 0, tx.data);

    // emit ConfirmTransaction(msg.sender, _txIndex);
    await expect(multiSigManager.connect(signerA).confirmTransaction(0))
      .to.emit(multiSigManager, "ConfirmTransaction")
      .withArgs(signerA.address, 0);

    await expect(multiSigManager.connect(signerB).confirmTransaction(0))
      .to.emit(multiSigManager, "ConfirmTransaction")
      .withArgs(signerB.address, 0);

    [to, value, data, executed, numConfirmations] = await multiSigManager.getTransaction(0);
    expect(to).to.equal(nodeStake.target);
    expect(value).to.equal(0);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(2);

    // emit ExecuteTransaction(msg.sender, _txIndex);
    await expect(multiSigManager.connect(signerB).executeTransaction(0))
      .to.emit(multiSigManager, "ExecuteTransaction")
      .withArgs(signerB.address, 0);

    newManager = await nodeStake.manager();
    expect(newManager).to.equal(manager2.address);


  });

  function createTransaction(contractAddress, newOwner) {
    const abi = [
      "function setManager(address _manager) public"
    ];
    const contract = new ethers.Contract(contractAddress, abi, hre.ethers.provider);
    const functionName = "setManager";
    const args = [newOwner.address];

    const calldata = contract.interface.encodeFunctionData(functionName, args);
    console.log(`Calldata: ${calldata}`);
    tx = {
      to: contractAddress,
      data: calldata,
    };
    return tx;
  }
});
