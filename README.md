# GitHub Native Bounty Board Oracle 🪙 🤖

This repository implements a decentralized **Bounty Board** ecosystem designed to run natively with GitHub workflows. By combining an **Ethereum Smart Contract** acting as an escrow vault with a secure **Node.js/TypeScript Webhook Server (Oracle)**, project maintainers can financialize development tasks. 

When a developer submits a Pull Request that fixes an issue, and that PR gets **merged**, the oracle automatically validates the event and triggers an on-chain smart contract transaction to transfer crypto rewards directly to the contributor's wallet.

---

## 🛠 Architecture & Workflow

1. **Bounty Escrow**: The repository maintainer interacts directly with the smart contract to fund a specific issue reward using a unique composite identifier (`repositoryId_issueId`).
2. **Contribution**: A developer writes code and submits a Pull Request containing standard linking keywords (e.g., `Closes #42`).
3. **Automated Validation**: Once the PR is approved and merged, GitHub fires a webhook payload to this project's oracle backend server.
4. **On-Chain Settlement**: The backend validates the cryptographic signature from GitHub, pulls the developer's registered public EVM wallet address, and safely invokes the contract's payout function.

---

## 📂 Project Structure

```text
github-bounty-board/
├── contracts/
│   └── GitHubBountyBoard.sol   # Solidity Smart Contract (Escrow Mechanism)
├── src/
│   ├── index.ts                # Primary Express.js Server & Webhook Logic
│   └── services/
│       └── database.ts         # User Mapping Subsystem (GitHub User -> EVM Wallet)
├── .env                        # Local Environment Constants (Secret Configurations)
├── package.json                # Project Dependencies and Executable Commands
├── tsconfig.json               # TypeScript Compiler Engine Constraints
└── README.md                   # System Architecture Manual
```

---

## ⚙️ Quick Start Installation

Follow these steps to set up and run the system locally for testing:

### 1. Clone & Install Dependencies
First, clone your repository workspace and fetch the package modules:
```bash
npm install
```

### 2. Configure Environment Constants
Create a `.env` file in the root directory and populate it with your environment parameters:
```env
PORT=3000
GITHUB_WEBHOOK_SECRET=your_webhook_secure_secret_here
ORACLE_PRIVATE_KEY=your_ethereum_wallet_private_key_acting_as_oracle
BLOCKCHAIN_RPC_URL=https://sepolia.org
BOUNTY_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
```

### 3. Deploy the Smart Contract
Deploy `GitHubBountyBoard.sol` to your chosen EVM network (e.g., Ethereum Sepolia, Base Sepolia). Make sure to pass the public address of your `ORACLE_PRIVATE_KEY` wallet into the contract constructor during deployment.

### 4. Expose Localhost for Webhooks
GitHub cannot send webhooks directly to your local computer (`localhost`). Use a forwarding tool like **ngrok** to expose your server port safely:
```bash
ngrok http 3000
```
Copy the secure forwarding URL provided by ngrok (e.g., `https://ngrok-free.app`).

### 5. Setup Webhook on GitHub
1. Go to your target GitHub Repository -> **Settings** -> **Webhooks** -> **Add webhook**.
2. **Payload URL**: Paste your ngrok address appending the path: `https://your-ngrok-url.app`.
3. **Content type**: Select `application/json`.
4. **Secret**: Enter the exact key matching your `GITHUB_WEBHOOK_SECRET`.
5. **Which events**: Choose *Let me select individual events* and check **Pull requests**.
6. Click **Add webhook**.

### 6. Run the Oracle Server
Boot up the webhook server instance in development mode:
```bash
npm run dev
```

---

## 🔒 Security Specifications

* **Payload Validation**: The webhook backend uses cryptographical HMAC SHA-256 verification using the `X-Hub-Signature-256` header to ensure instructions exclusively originate from official GitHub infrastructure.
* **Oracle Isolation**: The `resolveBounty` function inside the Smart Contract utilizes the `onlyOracle` modifier, completely preventing external bad actors from triggering unauthorized payout distributions.
