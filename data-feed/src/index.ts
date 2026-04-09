import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Keypair, Asset, Horizon, Networks, TransactionBuilder, Operation } from "@stellar/stellar-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// The data feed provider's key (where x402 payments go)
const PROVIDER_SK = process.env.PROVIDER_SK || "";
const PROVIDER_PK = process.env.PROVIDER_PK || "";

if (!PROVIDER_SK || !PROVIDER_PK) {
    console.error("ERROR: PROVIDER_SK and PROVIDER_PK must be set in .env");
    process.exit(1);
}

// Data symbol mapping for public APIs
const SYMBOL_MAP = {
    "BTC_USD": "bitcoin",
    "ETH_USD": "ethereum"
};

/**
 * GET /data/:symbol
 * Implements x402 logic:
 * 1. If no payment proof header, return 402 with payment request details.
 * 2. If payment proof present, verify on Stellar, then return data.
 */
app.get("/data/:symbol", async (req, res) => {
    const { symbol } = req.params;
    const paymentHash = req.headers["x-payment-proof"];

    if (!paymentHash) {
        // x402 Challenge: 402 Payment Required
        // In a real system, the amount would be proportional to data value
        return res.status(402).json({
            message: "Payment Required for Premium Data-Feed",
            amount: "0.1", // 0.1 XLM for this demo
            asset: "NATIVE",
            destination: PROVIDER_PK,
            network: "TESTNET",
            memo: `x402_${symbol}_${Date.now().toString().slice(-6)}`
        });
    }

    // Verify paymentHash on Stellar Horizon
    try {
        const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
        const tx = await horizon.transactions().transaction(paymentHash.toString()).call();
        
        // Basic verification for x402
        if (tx.successful) {
            // Fetch real data from public source
            const coinId = SYMBOL_MAP[symbol as keyof typeof SYMBOL_MAP];
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
            const priceData = (await response.json()) as Record<string, { usd: number }>;
            const price = priceData[coinId as string]?.usd;

            return res.json({
                symbol,
                data: { price: price.toString(), timestamp: Date.now() },
                proof: paymentHash,
                source: "CoinGecko (x402 Verified)"
            });
        }
    } catch (e) {
        console.error("Payment verification failed", e);
        return res.status(401).json({ error: "Invalid payment proof or verification error" });
    }

    return res.status(402).json({ error: "Payment required" });
});

app.listen(PORT, async () => {
    console.log(`x402 Data Feed Service running on port ${PORT}`);
    
    // Auto-fund the provider account so it exists on the ledger to receive payments
    try {
        console.log(`Checking/Funding Provider Account: ${PROVIDER_PK} ...`);
        await fetch(`https://friendbot.stellar.org?addr=${PROVIDER_PK}`);
    } catch (e) {
        console.error("Failed to auto-fund provider account", e);
    }
});
