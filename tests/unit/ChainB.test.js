const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Chain B Unit Tests", function () {
    let wrappedVaultToken, bridgeMint, governanceVoting;
    let owner, addr1;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        const WrappedVaultTokenFactory = await ethers.getContractFactory("WrappedVaultToken");
        wrappedVaultToken = await WrappedVaultTokenFactory.deploy();
        await wrappedVaultToken.waitForDeployment();

        const BridgeMintFactory = await ethers.getContractFactory("BridgeMint");
        bridgeMint = await BridgeMintFactory.deploy(await wrappedVaultToken.getAddress());
        await bridgeMint.waitForDeployment();

        const GovernanceVotingFactory = await ethers.getContractFactory("GovernanceVoting");
        governanceVoting = await GovernanceVotingFactory.deploy(await wrappedVaultToken.getAddress());
        await governanceVoting.waitForDeployment();

        const RELAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RELAYER_ROLE"));
        await bridgeMint.grantRole(RELAYER_ROLE, owner.address);
        await wrappedVaultToken.transferOwnership(await bridgeMint.getAddress());
    });

    it("Should mint tokens (Relayer)", async function () {
        const amount = 100;
        await bridgeMint.mintWrapped(addr1.address, amount, 1);
        expect(await wrappedVaultToken.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should burn tokens", async function () {
        const amount = 50;
        await bridgeMint.mintWrapped(owner.address, 100, 1);
        await expect(bridgeMint.burn(amount))
            .to.emit(bridgeMint, "Burned")
            .withArgs(owner.address, amount, 1);
    });

    it("Should create and vote on governance proposal", async function () {
        await bridgeMint.mintWrapped(owner.address, 100, 1);
        await governanceVoting.createProposal("0x");
        await expect(governanceVoting.vote(1))
            .to.emit(governanceVoting, "ProposalPassed");
    });
});
