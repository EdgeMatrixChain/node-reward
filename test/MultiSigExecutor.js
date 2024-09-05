const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
// const { ethers } = require("hardhat");


describe("MultiSigExecutor Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractFixture() {

    // Contracts are deployed using the first signer/account by default
    const [contractOwner, signerA, signerB, signerC, staker1, manager1, manager2] = await ethers.getSigners();

    // deploy multiSigManager contract
    const multiSigManager = await hre.ethers.deployContract("MultiSigManager", [[signerA, signerB], 2]);
    await multiSigManager.waitForDeployment();

    // deploy MultiSigExecutor contract
    const multiSigExecutor = await hre.ethers.deployContract("MultiSigExecutor", [signerA, signerB, signerC]);
    await multiSigExecutor.waitForDeployment();

    // deploy ReleaseVestingNativeV1 contract
    const scheduleRelease = await hre.ethers.deployContract("ReleaseVestingNativeV1", [0]);
    await scheduleRelease.waitForDeployment();

    // deploy NodeStakeNativeV1 contract
    const days1080RewardRate = hre.ethers.parseUnits("0.36", "ether");
    const nodeStake = await hre.ethers.deployContract("NodeStakeNativeV1", [scheduleRelease, manager1, days1080RewardRate, 36]);
    await nodeStake.waitForDeployment();

    return { multiSigExecutor, multiSigManager, nodeStake, contractOwner, signerA, signerB, signerC, staker1, manager1, manager2 };
  }


  it("Should call other contract", async function () {
    const { multiSigExecutor, multiSigManager, nodeStake, contractOwner, signerA, signerB, signerC, staker1, manager1, manager2 } = await loadFixture(
      deployContractFixture
    );

    const transferTx = await contractOwner.sendTransaction({ to: multiSigExecutor.target, value: hre.ethers.parseUnits("100", "ether") });
    await transferTx.wait();

    contractBalance = await hre.ethers.provider.getBalance(multiSigExecutor.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("100", "ether"));
    console.log(contractBalance);

    await expect(nodeStake.connect(staker1).bindNode("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", staker1.address, "a01231", makeBindSign(manager1, '16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU', staker1.address.toLowerCase(), "a01231")))
      .to.emit(nodeStake, "Bind")
      .withArgs(staker1.address,
        "16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");

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
      "transferRewardTo",
      ["16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", hre.ethers.parseUnits("50", "ether")]);

    await expect(multiSigExecutor.connect(manager2).executeTransaction(tx.to, BigInt(50e18), tx.data, "c0001",
      makeExecuteSign(
        signerA,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0001"),
      makeExecuteSign(
        signerB,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0001"),
      makeExecuteSign(
        signerC,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0001")
    )).to.emit(multiSigExecutor, "ExecuteTransaction")
      .withArgs(manager2.address, "c0001", nodeStake.target, BigInt(50e18), tx.data);

    await expect(multiSigExecutor.connect(manager2).executeTransaction(tx.to, BigInt(50e18), tx.data, "c0001",
      makeExecuteSign(
        signerA,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0001"),
      makeExecuteSign(
        signerB,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0001"),
      makeExecuteSign(
        signerC,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0001")
    )).to.be.revertedWith("tx already executed");

    console.log("contract:\t\t%s", nodeStake.target);
    console.log("functoinName:\t\t%s", "transferRewardTo");
    console.log("args:\t\t\t[%s]", manager2.address);
    console.log(tx);

    claimableRewardBalance = await nodeStake.claimableRewardBalance("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU");
    console.log("claimableRewardBalance:\t%d", claimableRewardBalance);
    expect(claimableRewardBalance).to.equal(hre.ethers.parseUnits("50", "ether"));

    tx = createTx(
      nodeStake.target,
      abi,
      "deposit",
      ["16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0, BigInt(50e18)]);

    await expect(multiSigExecutor.connect(manager2).executeTransaction(tx.to, BigInt(50e18), tx.data, "c0002",
      makeExecuteSign(
        signerA,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0002"),
      makeExecuteSign(
        signerB,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0002"),
      makeExecuteSign(
        signerC,
        tx.to,
        BigInt(50e18),
        tx.data,
        "c0002")
    )).to.emit(multiSigExecutor, "ExecuteTransaction")
      .withArgs(manager2.address, "c0002", nodeStake.target, BigInt(50e18), tx.data);

    nodeBalanceType0 = await nodeStake.balanceOfNodeByDepositType("16Uiu2HAm2xsgciiJfwP8E1o8ckAw4QJAgG4wsjXqCBgdZVVVLAZU", 0);
    expect(nodeBalanceType0).to.equal(hre.ethers.parseUnits("50", "ether"));

    contractBalance = await hre.ethers.provider.getBalance(multiSigExecutor.target);
    expect(contractBalance).to.equal(hre.ethers.parseUnits("0", "ether"));
    console.log(contractBalance);

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

  async function makeBindSign(manager, nodeId, caller, nonce) {
    chainId = await hre.network.config.chainId;
    // console.log("chainId:\t\t%d", chainId);
    signature = '';
    dataHash = ethers.solidityPackedKeccak256(['uint256', 'address', 'string', 'string'], [chainId, caller, nodeId, nonce]);

    messageBytes = ethers.getBytes(dataHash);
    signature = await manager.signMessage(messageBytes);
    return signature;
  }

  async function makeExecuteSign(signer, to, value, data, nonce) {
    chainId = await hre.network.config.chainId;
    signature = '';

    dataHash = ethers.solidityPackedKeccak256(['uint256', 'address', 'uint256', 'bytes', 'string'], [chainId, to, value, data, nonce]);
    messageBytes = ethers.getBytes(dataHash);

    signature = await signer.signMessage(messageBytes);
    console.log("\nsginer:\t\t\t%s", signer.address)
    console.log("dataHash:\t\t%s", dataHash)
    console.log("signature:\t\t%s", signature)

    return signature;
  }

});
