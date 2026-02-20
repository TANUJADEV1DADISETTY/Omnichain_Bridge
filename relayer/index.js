const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const {
    isNonceProcessed,
    markNonceProcessed,
    getLastProcessedBlock,
    updateLastProcessedBlock
} = require('./database');
require('dotenv').config();

const CONFIG_PATH = process.env.CONFIG_PATH || '/usr/src/app/deployments/config.json';
const RETRY_DELAY = 5000;
const POLL_INTERVAL = 2000;
const CONFIRMATION_DEPTH = parseInt(process.env.CONFIRMATION_DEPTH || '3');

async function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`Config file not found at ${CONFIG_PATH}`);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

async function processChainA(bridgeLock, bridgeMint, lastBlock, currentBlock) {
    const fromBlock = lastBlock + 1;
    const toBlock = currentBlock - CONFIRMATION_DEPTH;

    if (fromBlock > toBlock) return lastBlock;

    console.log(`[Chain A -> B] Scanning from ${fromBlock} to ${toBlock}`);

    const filter = bridgeLock.filters.Locked();
    const events = await bridgeLock.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
        const { user, amount, nonce } = event.args;
        console.log(`[Locked] User: ${user}, Amount: ${amount}, Nonce: ${nonce}`);

        if (await isNonceProcessed(1111, nonce.toString())) {
            console.log(`Nonce ${nonce} already processed`);
            continue;
        }

        try {
            console.log(`Relaying to Chain B: mintWrapped(${user}, ${amount}, ${nonce})`);
            const tx = await bridgeMint.mintWrapped(user, amount, nonce);
            await tx.wait(1);
            console.log(`Minted on Chain B: ${tx.hash}`);
            await markNonceProcessed(1111, nonce.toString());
        } catch (e) {
            console.error(`Failed to mint on Chain B: ${e.message}`);
        }
    }

    return toBlock;
}

async function processChainB(bridgeMint, bridgeLock, lastBlock, currentBlock) {
    const fromBlock = lastBlock + 1;
    const toBlock = currentBlock - CONFIRMATION_DEPTH;

    if (fromBlock > toBlock) return lastBlock;

    console.log(`[Chain B -> A] Scanning from ${fromBlock} to ${toBlock}`);

    // Burned Events
    const burnedFilter = bridgeMint.filters.Burned();
    const burnedEvents = await bridgeMint.queryFilter(burnedFilter, fromBlock, toBlock);

    for (const event of burnedEvents) {
        const { user, amount, nonce } = event.args;
        console.log(`[Burned] User: ${user}, Amount: ${amount}, Nonce: ${nonce}`);

        if (await isNonceProcessed(2222, nonce.toString())) {
            continue;
        }

        try {
            console.log(`Relaying to Chain A: unlock(${user}, ${amount}, ${nonce})`);
            const tx = await bridgeLock.unlock(user, amount, nonce);
            await tx.wait(1);
            console.log(`Unlocked on Chain A: ${tx.hash}`);
            await markNonceProcessed(2222, nonce.toString());
        } catch (e) {
            console.error(`Failed to unlock on Chain A: ${e.message}`);
        }
    }

    return toBlock;
}

async function processGovernance(governanceVoting, governanceEmergency, lastBlock, currentBlock) {
    const fromBlock = lastBlock + 1;
    const toBlock = currentBlock - CONFIRMATION_DEPTH;

    if (fromBlock > toBlock) return lastBlock;

    const filter = governanceVoting.filters.ProposalPassed();
    const events = await governanceVoting.queryFilter(filter, fromBlock, toBlock);

    for (const event of events) {
        const { proposalId, data } = event.args;
        console.log(`[ProposalPassed] ProposalId: ${proposalId}`);
        const govNonce = `gov-${proposalId}`;

        if (await isNonceProcessed(2222, govNonce)) {
            continue;
        }

        try {
            console.log(`Relaying to Chain A: pauseBridge()`);
            const tx = await governanceEmergency.pauseBridge();
            await tx.wait(1);
            console.log(`Bridge Paused on Chain A: ${tx.hash}`);
            await markNonceProcessed(2222, govNonce);
        } catch (e) {
            console.error(`Failed to pause bridge: ${e.message}`);
        }
    }

    return toBlock;
}

async function main() {
    console.log("Starting Relayer Service...");

    let config;
    while (!config) {
        try {
            config = await loadConfig();
            console.log("Config loaded");
        } catch (e) {
            console.log("Waiting for config...");
            await new Promise(r => setTimeout(r, RETRY_DELAY));
        }
    }

    const providerA = new ethers.JsonRpcProvider(process.env.CHAIN_A_RPC_URL || 'http://chain-a:8545');
    const providerB = new ethers.JsonRpcProvider(process.env.CHAIN_B_RPC_URL || 'http://chain-b:9545');

    const walletA = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, providerA);
    const walletB = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, providerB);

    const bridgeLock = new ethers.Contract(config.chainA.BridgeLock, [
        "event Locked(address indexed user, uint256 amount, uint256 nonce)",
        "event Unlocked(address indexed user, uint256 amount, uint256 nonce)",
        "function unlock(address user, uint256 amount, uint256 nonce)"
    ], walletA);

    const governanceEmergency = new ethers.Contract(config.chainA.GovernanceEmergency, [
        "function pauseBridge()"
    ], walletA);

    const bridgeMint = new ethers.Contract(config.chainB.BridgeMint, [
        "event Burned(address indexed user, uint256 amount, uint256 nonce)",
        "event Minted(address indexed user, uint256 amount, uint256 nonce)",
        "function mintWrapped(address user, uint256 amount, uint256 nonce)"
    ], walletB);

    const governanceVoting = new ethers.Contract(config.chainB.GovernanceVoting, [
        "event ProposalPassed(uint256 proposalId, bytes data)"
    ], walletB);

    console.log("Relayer service active. Monitoring both chains...");

    while (true) {
        try {
            const [currentBlockA, currentBlockB] = await Promise.all([
                providerA.getBlockNumber(),
                providerB.getBlockNumber()
            ]);

            // Sync Chain A -> B
            let lastProcessedA = await getLastProcessedBlock(1111);
            if (lastProcessedA === null) lastProcessedA = currentBlockA - 1;

            const newLastA = await processChainA(bridgeLock, bridgeMint, lastProcessedA, currentBlockA);
            if (newLastA !== lastProcessedA) {
                await updateLastProcessedBlock(1111, newLastA);
            }

            // Sync Chain B -> A
            let lastProcessedB = await getLastProcessedBlock(2222);
            if (lastProcessedB === null) lastProcessedB = currentBlockB - 1;

            const newLastB = await processChainB(bridgeMint, bridgeLock, lastProcessedB, currentBlockB);
            await processGovernance(governanceVoting, governanceEmergency, lastProcessedB, currentBlockB);

            if (newLastB !== lastProcessedB) {
                await updateLastProcessedBlock(2222, newLastB);
            }

        } catch (e) {
            console.error(`Error in polling loop: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

main().catch(console.error);
