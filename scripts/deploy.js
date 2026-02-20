const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    let DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
    if (!DEPLOYER_PRIVATE_KEY) {
        console.log("No DEPLOYER_PRIVATE_KEY found, generating a random one for this deployment...");
        DEPLOYER_PRIVATE_KEY = ethers.Wallet.createRandom().privateKey;
    }

    const providerA = new ethers.JsonRpcProvider(process.env.CHAIN_A_RPC_URL || "http://127.0.0.1:8545");
    const providerB = new ethers.JsonRpcProvider(process.env.CHAIN_B_RPC_URL || "http://127.0.0.1:9545");

    const walletA = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, providerA);
    const walletB = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, providerB);

    console.log("Deploying contracts with the account:", walletA.address);
    console.log("Nonce on Chain A:", await providerA.getTransactionCount(walletA.address));
    console.log("Nonce on Chain B:", await providerB.getTransactionCount(walletB.address));

    console.log("Deploying to Chain A...");
    console.log("Chain A Nonce:", await providerA.getTransactionCount(walletA.address));
    const VaultToken = await ethers.getContractFactory("VaultToken", walletA);
    const vaultToken = await VaultToken.deploy();
    await vaultToken.waitForDeployment();
    const vaultTokenAddress = await vaultToken.getAddress();
    console.log("VaultToken deployed to:", vaultTokenAddress);

    const BridgeLock = await ethers.getContractFactory("BridgeLock", walletA);
    const bridgeLock = await BridgeLock.deploy(vaultTokenAddress);
    await bridgeLock.waitForDeployment();
    const bridgeLockAddress = await bridgeLock.getAddress();
    console.log("BridgeLock deployed to:", bridgeLockAddress);

    const GovernanceEmergency = await ethers.getContractFactory("GovernanceEmergency", walletA);
    const governanceEmergency = await GovernanceEmergency.deploy(bridgeLockAddress);
    await governanceEmergency.waitForDeployment();
    const governanceEmergencyAddress = await governanceEmergency.getAddress();
    console.log("GovernanceEmergency deployed to:", governanceEmergencyAddress);

    console.log("Deploying to Chain B...");
    console.log("Chain B Nonce:", await providerB.getTransactionCount(walletB.address));
    const WrappedVaultToken = await ethers.getContractFactory("WrappedVaultToken", walletB);
    const wrappedVaultToken = await WrappedVaultToken.deploy();
    await wrappedVaultToken.waitForDeployment();
    const wrappedVaultTokenAddress = await wrappedVaultToken.getAddress();
    console.log("WrappedVaultToken deployed to:", wrappedVaultTokenAddress);

    const BridgeMint = await ethers.getContractFactory("BridgeMint", walletB);
    const bridgeMint = await BridgeMint.deploy(wrappedVaultTokenAddress);
    await bridgeMint.waitForDeployment();
    const bridgeMintAddress = await bridgeMint.getAddress();
    console.log("BridgeMint deployed to:", bridgeMintAddress);

    const GovernanceVoting = await ethers.getContractFactory("GovernanceVoting", walletB);
    const governanceVoting = await GovernanceVoting.deploy(wrappedVaultTokenAddress);
    await governanceVoting.waitForDeployment();
    const governanceVotingAddress = await governanceVoting.getAddress();
    console.log("GovernanceVoting deployed to:", governanceVotingAddress);

    console.log("Setting up roles...");
    const RELAYER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("RELAYER_ROLE"));
    const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));

    await (await bridgeLock.grantRole(RELAYER_ROLE, walletA.address)).wait();
    await (await bridgeLock.grantRole(GOVERNANCE_ROLE, governanceEmergencyAddress)).wait();
    await (await governanceEmergency.grantRole(RELAYER_ROLE, walletA.address)).wait();
    await (await wrappedVaultToken.transferOwnership(bridgeMintAddress)).wait();
    await (await bridgeMint.grantRole(RELAYER_ROLE, walletB.address)).wait();

    const config = {
        chainA: {
            VaultToken: vaultTokenAddress,
            BridgeLock: bridgeLockAddress,
            GovernanceEmergency: governanceEmergencyAddress
        },
        chainB: {
            WrappedVaultToken: wrappedVaultTokenAddress,
            BridgeMint: bridgeMintAddress,
            GovernanceVoting: governanceVotingAddress
        }
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const configPath = path.join(deploymentsDir, "config.json");
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Configuration saved to ${configPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
