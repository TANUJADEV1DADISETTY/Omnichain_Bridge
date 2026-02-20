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

describe("Relayer Recovery Test", function () {
    let config;
    let providerA, providerB;
    let walletA, walletB;
    let bridgeLock, vaultToken;
    let bridgeMint, wrappedVaultToken;

    before(async function () {
        const configPath = path.join(__dirname, "../../deployments/config.json");
        if (!fs.existsSync(configPath)) {
            this.skip();
            return;
        }
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        providerA = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        providerB = new ethers.JsonRpcProvider("http://127.0.0.1:9545");

        const pk = process.env.DEPLOYER_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        walletA = new ethers.Wallet(pk, providerA);
        walletB = new ethers.Wallet(pk, providerB);

        vaultToken = await ethers.getContractAt("VaultToken", config.chainA.VaultToken, walletA);
        bridgeLock = await ethers.getContractAt("BridgeLock", config.chainA.BridgeLock, walletA);
        wrappedVaultToken = await ethers.getContractAt("WrappedVaultToken", config.chainB.WrappedVaultToken, walletB);
        bridgeMint = await ethers.getContractAt("BridgeMint", config.chainB.BridgeMint, walletB);
    });

    it("Should process events that occurred while relayer was 'offline'", async function () {
        const amount = 10n;
        await (await vaultToken.approve(await bridgeLock.getAddress(), amount)).wait();

        console.log("Locking tokens while simulating relayer downtime...");
        const tx = await bridgeLock.lock(amount);
        const receipt = await tx.wait();
        console.log(`Locked at block ${receipt.blockNumber}`);

        for (let i = 0; i < 5; i++) {
            await providerA.send("evm_mine", []);
        }

        console.log("Waiting for relayer to recover and process missed event...");
        const success = await waitFor(async () => {
            const balance = await wrappedVaultToken.balanceOf(walletB.address);
            return balance >= amount;
        }, 60000);

        expect(success).to.be.true;
    });
});
