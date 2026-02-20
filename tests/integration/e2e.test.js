const { ethers } = require("hardhat");
const { expect } = require("chai");
const fs = require("fs");
const path = require("path");

async function waitFor(condition, timeout = 30000, interval = 1000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await condition()) return true;
        await new Promise(r => setTimeout(r, interval));
    }
    return false;
}

describe("Integration Tests (End-to-End)", function () {
    let config;
    let providerA, providerB;
    let walletA, walletB;
    let bridgeLock, vaultToken;
    let bridgeMint, wrappedVaultToken;
    let governanceVoting, governanceEmergency;

    before(async function () {
        const configPath = path.join(__dirname, "../../deployments/config.json");
        if (!fs.existsSync(configPath)) {
            console.log("Config not found. Skipping integration tests.");
            this.skip();
            return;
        }
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        providerA = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        providerB = new ethers.JsonRpcProvider("http://127.0.0.1:9545");

        try {
            await providerA.getNetwork();
            await providerB.getNetwork();
        } catch (e) {
            console.log("Local chains not accessible. Skipping integration tests.");
            this.skip();
            return;
        }

        const pk = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        walletA = new ethers.Wallet(pk, providerA);
        walletB = new ethers.Wallet(pk, providerB);

        vaultToken = await ethers.getContractAt("VaultToken", config.chainA.VaultToken, walletA);
        bridgeLock = await ethers.getContractAt("BridgeLock", config.chainA.BridgeLock, walletA);
        governanceEmergency = await ethers.getContractAt("GovernanceEmergency", config.chainA.GovernanceEmergency, walletA);

        wrappedVaultToken = await ethers.getContractAt("WrappedVaultToken", config.chainB.WrappedVaultToken, walletB);
        bridgeMint = await ethers.getContractAt("BridgeMint", config.chainB.BridgeMint, walletB);
        governanceVoting = await ethers.getContractAt("GovernanceVoting", config.chainB.GovernanceVoting, walletB);
    });

    it("Should lock on Chain A and mint on Chain B", async function () {
        const amount = 100n;
        const recipient = walletB.address;

        await (await vaultToken.approve(await bridgeLock.getAddress(), amount)).wait();
        console.log("Locking tokens...");
        await (await bridgeLock.lock(amount)).wait();

        console.log("Waiting for Relayer...");
        const success = await waitFor(async () => {
            const balance = await wrappedVaultToken.balanceOf(recipient);
            return balance >= amount;
        });

        expect(success).to.be.true;
        expect(await wrappedVaultToken.balanceOf(recipient)).to.equal(amount);
    });
});
