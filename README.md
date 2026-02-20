# 🏗 Local Omnichain Asset Bridge with Governance Recovery System

## 📌 Project Overview

This project implements a **two-chain local asset bridge** with a **Node.js relayer** and a **cross-chain governance emergency recovery system**.

It simulates real-world DeFi bridge architecture including:

- Lock & Mint bridging model
- Burn & Unlock reverse bridging
- Replay attack protection
- Confirmation delay handling
- Persistent relayer storage
- Governance-triggered emergency pause
- Crash recovery mechanism
- Docker-based infrastructure orchestration

The entire system runs locally using two independent blockchain nodes.

---

# 🧱 System Architecture

## 🔵 Chain A (Settlement Chain)

- VaultToken (ERC20)
- BridgeLock (Locks & Unlocks tokens)
- GovernanceEmergency (Pauses bridge)

## 🟢 Chain B (Execution Chain)

- WrappedVaultToken (Mintable ERC20)
- BridgeMint (Mint & Burn logic)
- GovernanceVoting (Cross-chain governance)

## 🔁 Relayer (Off-chain Service)

- Listens to events from both chains
- Waits for block confirmations
- Prevents replay attacks
- Persists processed nonces
- Handles RPC failures
- Recovers from crashes

---

# 📁 Project Structure

omnichain-bridge/
│
├── contracts/
│ ├── VaultToken.sol
│ ├── BridgeLock.sol
│ ├── GovernanceEmergency.sol
│ ├── WrappedVaultToken.sol
│ ├── BridgeMint.sol
│ └── GovernanceVoting.sol
│
├── scripts/
│ ├── deployChainA.js
│ └── deployChainB.js
│
├── tests/
│ ├── lock-mint.test.js
│ ├── burn-unlock.test.js
│ ├── replay-protection.test.js
│ ├── governance.test.js
│ └── relayer-recovery.test.js
│
├── relayer/
│ ├── index.js
│ ├── db.js
│ ├── Dockerfile
│ └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md

---

# ⚙️ Prerequisites

- Docker Desktop
- Node.js (for local development)
- Hardhat
- npm

---

# 🚀 Running the Entire System

## 1️⃣ Clone Repository

git clone <repository-url>
cd omnichain-bridge

## 2️⃣ Setup Environment File

cp .env.example .env

## 3️⃣ Start Everything

docker-compose up --build

This will start:

- Chain A → http://localhost:8545 (chainId: 1111)
- Chain B → http://localhost:9545 (chainId: 2222)
- Relayer Service

---

# 🔐 Environment Variables

Example .env.example:

CHAIN_A_RPC_URL=http://chain-a:8545
CHAIN_B_RPC_URL=http://chain-b:9545
DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CONFIRMATION_DEPTH=3
DB_PATH=./data/bridge.db

---

# 🔵 Chain A Contracts

## VaultToken.sol

- Standard ERC20 token
- Minted at deployment

## BridgeLock.sol

Functions:

- lock(uint256 amount)
- unlock(address user, uint256 amount, uint256 nonce)
- pauseBridge()

Features:

- Replay protection via nonce mapping
- Pausable pattern
- Relayer-only unlock

## GovernanceEmergency.sol

- Executes emergency pause triggered by relayer

---

# 🟢 Chain B Contracts

## WrappedVaultToken.sol

- ERC20 token
- Mintable & Burnable
- Only BridgeMint can mint/burn

## BridgeMint.sol

Functions:

- mintWrapped(address user, uint256 amount, uint256 nonce)
- burn(uint256 amount)

Features:

- Replay protection
- Emits Burned event

## GovernanceVoting.sol

- Token-based voting
- Emits ProposalPassed event
- Triggers cross-chain emergency

---

# 🔁 Relayer Responsibilities

- Listen for Locked events on Chain A
- Listen for Burned events on Chain B
- Listen for ProposalPassed events
- Wait configurable block confirmations
- Prevent duplicate processing
- Persist nonces using SQLite
- Recover missed events after crash
- Retry failed RPC transactions

---

# 🔄 Bridge Flow

## 🔐 Lock → Mint Flow

1. User approves VaultToken
2. User calls lock()
3. Locked event emitted
4. Relayer waits 3 confirmations
5. Relayer calls mintWrapped()
6. WrappedVaultToken minted on Chain B

---

## 🔥 Burn → Unlock Flow

1. User calls burn()
2. Burned event emitted
3. Relayer waits confirmations
4. Relayer calls unlock()
5. Original VaultToken returned on Chain A

---

# ⚖ Supply Invariant

The system guarantees:

# VaultToken.balanceOf(BridgeLock)

WrappedVaultToken.totalSupply()

This ensures supply consistency across chains.

---

# 🛡 Replay Protection

Both BridgeLock and BridgeMint use:

mapping(uint256 => bool) processed;

If a nonce is reused:

- Transaction reverts
- Replay attack prevented

---

# 🏛 Cross-Chain Governance

1. Proposal created on Chain B
2. Token holders vote
3. ProposalPassed event emitted
4. Relayer detects event
5. pauseBridge() executed on Chain A
6. BridgeLock enters paused state
7. lock() calls revert

---

# 💥 Relayer Crash Recovery

1. Stop relayer container
2. Perform lock() while relayer offline
3. Restart relayer
4. Relayer loads stored nonces
5. Relayer scans missed blocks
6. Processes missed events safely

SQLite ensures atomic state persistence.

---

# 🧪 Tests Included

- Lock → Mint integration
- Burn → Unlock integration
- Replay attack prevention
- Governance pause verification
- Relayer crash recovery simulation
- Access control tests

Run tests locally:

npx hardhat test

---

# 🐳 Docker Services

## chain-a

- Anvil node
- chainId: 1111
- Port: 8545

## chain-b

- Anvil node
- chainId: 2222
- Port: 9545

## relayer

- Node.js service
- Depends on healthy chain nodes
- Volume-mounted SQLite database

---

# 🔒 Security Considerations

- Role-based access control
- Idempotent contract design
- Nonce-based replay protection
- Confirmation depth for reorg safety
- Persistent relayer state
- Emergency pause mechanism

---

# 🎯 Core Requirements Completed

- Two independent local chains
- Dockerized environment
- Confirmation delay logic
- Replay protection
- Crash recovery
- Governance emergency system
- Persistent relayer storage
- End-to-end bridge flow
- Supply invariant enforcement

---

# 📈 Future Improvements

- Multi-relayer redundancy
- Signature-based message verification
- Light-client verification
- Web dashboard
- Multi-chain support
- Monitoring & alerting system

---
