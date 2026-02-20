const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'processed_nonces.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS processed_nonces (chain_id INTEGER, nonce TEXT, PRIMARY KEY (chain_id, nonce))");
    db.run("CREATE TABLE IF NOT EXISTS sync_state (chain_id INTEGER PRIMARY KEY, last_processed_block INTEGER)");
});

function isNonceProcessed(chainId, nonce) {
    return new Promise((resolve, reject) => {
        db.get("SELECT nonce FROM processed_nonces WHERE chain_id = ? AND nonce = ?", [chainId, nonce], (err, row) => {
            if (err) reject(err);
            resolve(!!row);
        });
    });
}

function markNonceProcessed(chainId, nonce) {
    return new Promise((resolve, reject) => {
        db.run("INSERT OR IGNORE INTO processed_nonces (chain_id, nonce) VALUES (?, ?)", [chainId, nonce], (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

function getLastProcessedBlock(chainId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT last_processed_block FROM sync_state WHERE chain_id = ?", [chainId], (err, row) => {
            if (err) reject(err);
            resolve(row ? row.last_processed_block : null);
        });
    });
}

function updateLastProcessedBlock(chainId, blockNumber) {
    return new Promise((resolve, reject) => {
        db.run("INSERT OR REPLACE INTO sync_state (chain_id, last_processed_block) VALUES (?, ?)", [chainId, blockNumber], (err) => {
            if (err) reject(err);
            resolve();
        });
    });
}

module.exports = {
    isNonceProcessed,
    markNonceProcessed,
    getLastProcessedBlock,
    updateLastProcessedBlock
};
