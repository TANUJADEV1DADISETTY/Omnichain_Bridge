const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Chain A Unit Tests", function () {
    let vaultToken, bridgeLock, governanceEmergency;
    let owner, addr1;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();
        await vaultToken.waitForDeployment();

        const BridgeLockFactory = await ethers.getContractFactory("BridgeLock");
        bridgeLock = await BridgeLockFactory.deploy(await vaultToken.getAddress());
        await bridgeLock.waitForDeployment();

        const GovernanceEmergencyFactory = await ethers.getContractFactory("GovernanceEmergency");
        governanceEmergency = await GovernanceEmergencyFactory.deploy(await bridgeLock.getAddress());
        await governanceEmergency.waitForDeployment();

        const RELAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RELAYER_ROLE"));
        const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));
        await bridgeLock.grantRole(RELAYER_ROLE, owner.address);
        await bridgeLock.grantRole(GOVERNANCE_ROLE, await governanceEmergency.getAddress());
        await governanceEmergency.grantRole(RELAYER_ROLE, owner.address);
    });

    it("Should lock tokens", async function () {
        const amount = 100;
        await vaultToken.approve(await bridgeLock.getAddress(), amount);
        await expect(bridgeLock.lock(amount))
            .to.emit(bridgeLock, "Locked")
            .withArgs(owner.address, amount, 1);
    });

    it("Should unlock tokens (Relayer)", async function () {
        const amount = 50;
        await vaultToken.transfer(await bridgeLock.getAddress(), 100);
        await bridgeLock.unlock(addr1.address, amount, 1);
        expect(await vaultToken.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should pause bridge via governance", async function () {
        await governanceEmergency.pauseBridge();
        expect(await bridgeLock.paused()).to.be.true;
    });
});
