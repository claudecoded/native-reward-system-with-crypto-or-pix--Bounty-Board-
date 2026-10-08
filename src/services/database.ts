import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import { fetchContributorWalletAddress } from './services/database';

// Load variables from .env file
dotenv.config();

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY || "";
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "";
const CONTRACT_ADDRESS = process.env.BOUNTY_CONTRACT_ADDRESS || "";

// Operational Contract Application Binary Interface (ABI)
const CONTRACT_ABI = [
    "function resolveBounty(string calldata _issueKey, address payable _hunter) external"
];

// Initialize Ethers components securely
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const bountyContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

/**
 * Validates that requests are genuinely coming from configured GitHub Webhooks
 */
const verifySignature = (req: Request, res: Response, next: Function) => {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return res.status(401).send('Missing GitHub validation signature.');

    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = Buffer.from('sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex'), 'utf8');
    const checksum = Buffer.from(signature, 'utf8');

    if (digest.length !== checksum.length || !crypto.timingSafeEqual(digest, checksum)) {
        return res.status(403).send('Request validation signature mismatch.');
    }
    return next();
};

/**
 * Handle incoming payload events captured by your repository
 */
app.post('/webhook', verifySignature, async (req: Request, res: Response) => {
    const event = req.headers['x-github-event'];
    const { action, pull_request } = req.body;

    if (event === 'pull_request' && action === 'closed') {
        const isMerged = pull_request?.merged;
        
        if (isMerged) {
            const prBody = pull_request.body || "";
            const repoId = req.body.repository.id;
            
            // Matches syntax keywords linking PRs to issues (e.g. "Closes #15")
            const issueRegex = /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi;
            const match = issueRegex.exec(prBody);

            if (match) {
                const issueId = match[1];
                const issueKey = `${repoId}_${issueId}`;
                const contributorUsername = pull_request.user.login;

                console.log(`[ORACLE] Intercepted approved PR by ${contributorUsername}. Processing issue: ${issueKey}`);

                try {
                    const hunterCryptoWallet = await fetchContributorWalletAddress(contributorUsername);

                    if (hunterCryptoWallet && ethers.isAddress(hunterCryptoWallet)) {
                        console.log(`[BLOCKCHAIN] Dispatched execution order to wallet: ${hunterCryptoWallet}`);
                        
                        // Execute cross-chain trigger
                        const tx = await bountyContract.resolveBounty(issueKey, hunterCryptoWallet);
                        await tx.wait();
                        
                        console.log(`[SUCCESS] On-chain payout successfully settled. Hash: ${tx.hash}`);
                        return res.status(200).send({ status: 'payout_settled', txHash: tx.hash });
                    } else {
                        console.warn(`[ABORT] No verified Web3 payout route found for GitHub profile: ${contributorUsername}`);
                        return res.status(400).send({ status: 'error', message: 'User destination wallet not registered.' });
                    }
                } catch (error) {
                    console.error('[CRITICAL] Failed contract interaction step:', error);
                    return res.status(500).send({ status: 'error', message: 'Transaction routing pipeline exception.' });
                }
            }
        }
    }

    return res.status(200).send({ status: 'ignored' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[ONLINE] Oracle core processing events safely on port ${PORT}`));
