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

    const abi = [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "_releaseContract",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "_manager",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "_scheduleYieldRate",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_scheduleDuration",
            "type": "uint256"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "address",
            "name": "holder",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "nodeId",
            "type": "string"
          }
        ],
        "name": "Bind",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "address",
            "name": "holder",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "rewardAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "interestAmount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "nodeId",
            "type": "string"
          }
        ],
        "name": "Claimed",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "address",
            "name": "holder",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "nodeId",
            "type": "string"
          }
        ],
        "name": "Deposited",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "address",
            "name": "previousOwner",
            "type": "address"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "newOwner",
            "type": "address"
          }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "address",
            "name": "from",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "nodeId",
            "type": "string"
          }
        ],
        "name": "TransferReward",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "string",
            "name": "nodeId",
            "type": "string"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "start",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "duration",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "amountTotal",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "yieldRate",
            "type": "uint256"
          }
        ],
        "name": "VestingScheduleCreated",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "internalType": "address",
            "name": "holder",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "indexed": false,
            "internalType": "string",
            "name": "nodeId",
            "type": "string"
          }
        ],
        "name": "Withdrawed",
        "type": "event"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          }
        ],
        "name": "balanceOfNode",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "_scheduleIndex",
            "type": "uint256"
          }
        ],
        "name": "balanceOfSchedule",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "_beneficiary",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "_nonce",
            "type": "string"
          },
          {
            "internalType": "bytes",
            "name": "_signature",
            "type": "bytes"
          }
        ],
        "name": "bindNode",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "canDeposit",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "_beneficiary",
            "type": "address"
          }
        ],
        "name": "claim",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          }
        ],
        "name": "claimableBalance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          }
        ],
        "name": "claimableInterestBalance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          }
        ],
        "name": "claimableRewardBalance",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "_depositType",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_amount",
            "type": "uint256"
          }
        ],
        "name": "deposit",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          }
        ],
        "name": "getSchedules",
        "outputs": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "depositType",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "start",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "duration",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "amountTotal",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "withdrawed",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "yieldRate",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "rewarded",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "withdrawedTime",
                "type": "uint256"
              }
            ],
            "internalType": "struct NodeStakeNativeV1.VestingSchedule[]",
            "name": "",
            "type": "tuple[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "manager",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "maxLimit",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "minLimit",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          }
        ],
        "name": "nodeInfo",
        "outputs": [
          {
            "internalType": "address",
            "name": "beneficiary",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "accumulated",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "debt",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "address",
            "name": "_beneficiary",
            "type": "address"
          }
        ],
        "name": "rebind",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "releaseContract",
        "outputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "bool",
            "name": "_canDeposit",
            "type": "bool"
          }
        ],
        "name": "setCanDeposit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "_minLimit",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "_maxLimit",
            "type": "uint256"
          }
        ],
        "name": "setLimit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "_manager",
            "type": "address"
          }
        ],
        "name": "setManager",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "tokenInPool",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "newOwner",
            "type": "address"
          }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "_amount",
            "type": "uint256"
          }
        ],
        "name": "transferRewardTo",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "vestingSchedules",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "depositType",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "start",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "duration",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "amountTotal",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "withdrawed",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "yieldRate",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "rewarded",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "withdrawedTime",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "string",
            "name": "_nodeId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "_scheduleIndex",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "_beneficiary",
            "type": "address"
          }
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];

    // call setManager
    tx = createTx(
      nodeStake.target,
      abi,
      "setManager",
      [manager2.address]);

    console.log("contract:\t\t%s", nodeStake.target);
    console.log("functoinName:\t\t%s", "setManager");
    console.log("args:\t\t\t[%s]", manager2.address);
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

    // call setLimit
    tx = createTx(
      nodeStake.target,
      abi,
      "setLimit",
      [1000, 5000]);

    console.log("contract:\t\t%s", nodeStake.target);
    console.log("functoinName:\t\t%s", "setLimit");
    console.log("args:\t\t\t[%s]", manager2.address);
    console.log(tx);

    await expect(multiSigManager.connect(signerA).submitTransaction(tx.to, BigInt(0e18), tx.data))
      .to.emit(multiSigManager, "SubmitTransaction")
      .withArgs(signerA.address, 1, nodeStake.target, 0, tx.data);

    // emit ConfirmTransaction(msg.sender, _txIndex);
    await expect(multiSigManager.connect(signerA).confirmTransaction(1))
      .to.emit(multiSigManager, "ConfirmTransaction")
      .withArgs(signerA.address, 1);

    await expect(multiSigManager.connect(signerB).confirmTransaction(1))
      .to.emit(multiSigManager, "ConfirmTransaction")
      .withArgs(signerB.address, 1);

    [to, value, data, executed, numConfirmations] = await multiSigManager.getTransaction(1);
    expect(to).to.equal(nodeStake.target);
    expect(value).to.equal(0);
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(2);

    // emit ExecuteTransaction(msg.sender, _txIndex);
    await expect(multiSigManager.connect(signerB).executeTransaction(1))
      .to.emit(multiSigManager, "ExecuteTransaction")
      .withArgs(signerB.address, 1);

    minLimit = await nodeStake.minLimit();
    expect(minLimit).to.equal(1000);
    maxLimit = await nodeStake.maxLimit();
    expect(maxLimit).to.equal(5000);

  });


  it("Should transfer ETH to contract", async function () {
    const { nodeStake, multiSigManager, contractOwner, signerA, signerB, signerC, caller1, manager1, manager2 } = await loadFixture(
      deployContractFixture
    );

    console.log(await hre.ethers.provider.getBalance(multiSigManager.target));

    const tx = await contractOwner.sendTransaction({ to: multiSigManager.target, value: hre.ethers.parseUnits("100", "ether") });

    await tx.wait();

    contractBalance = await hre.ethers.provider.getBalance(multiSigManager.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    console.log("multiSigManagerBalance:\t%d", ethers.formatUnits(contractBalance, 18));

    // const arrayBuffer = new ArrayBuffer(0);
    // const emptyByteArray = new Uint8Array(arrayBuffer);
    await expect(multiSigManager.connect(signerA).submitTransaction(nodeStake.target, BigInt(100e18), new Uint8Array()))
      .to.emit(multiSigManager, "SubmitTransaction")
      .withArgs(signerA.address, 0, nodeStake.target, BigInt(100e18), new Uint8Array());

    await expect(multiSigManager.connect(signerA).confirmTransaction(0))
      .to.emit(multiSigManager, "ConfirmTransaction")
      .withArgs(signerA.address, 0);

    await expect(multiSigManager.connect(signerB).confirmTransaction(0))
      .to.emit(multiSigManager, "ConfirmTransaction")
      .withArgs(signerB.address, 0);

    [to, value, data, executed, numConfirmations] = await multiSigManager.getTransaction(0);
    expect(to).to.equal(nodeStake.target);
    expect(value).to.equal(BigInt(100e18));
    expect(executed).to.equal(false);
    expect(numConfirmations).to.equal(2);

    // emit ExecuteTransaction(msg.sender, _txIndex);
    await expect(multiSigManager.connect(signerB).executeTransaction(0))
      .to.emit(multiSigManager, "ExecuteTransaction")
      .withArgs(signerB.address, 0);

    [to, value, data, executed, numConfirmations] = await multiSigManager.getTransaction(0);
    expect(to).to.equal(nodeStake.target);
    expect(value).to.equal(BigInt(100e18));
    expect(executed).to.equal(true);
    expect(numConfirmations).to.equal(2);

    contractBalance = await hre.ethers.provider.getBalance(multiSigManager.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    console.log("multiSigManagerBalance:\t%d", ethers.formatUnits(contractBalance, 18));

    contractBalance = await hre.ethers.provider.getBalance(nodeStake.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    console.log("nodeStakeBalance:\t%d", ethers.formatUnits(contractBalance, 18));


  });

  function createTx(contractAddress, abi, functionName, args) {
    const contract = new ethers.Contract(contractAddress, abi, hre.ethers.provider);
    const calldata = contract.interface.encodeFunctionData(functionName, args);
    console.log(`Calldata\t\t${calldata}`);
    tx = {
      to: contractAddress,
      data: calldata,
    };
    return tx;
  }

  function createSetManagerTx(contractAddress, newOwner) {
    const abi = [
      "function setManager(address _manager) public"
    ];
    const contract = new ethers.Contract(contractAddress, abi, hre.ethers.provider);
    const functionName = "setManager";
    const args = [newOwner.address];

    const calldata = contract.interface.encodeFunctionData(functionName, args);
    console.log(`Calldata\t\t${calldata}`);
    tx = {
      to: contractAddress,
      data: calldata,
    };
    return tx;
  }
});
