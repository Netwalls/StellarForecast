import Anthropic from "@anthropic-ai/sdk";
import * as StellarSdk from "@stellar/stellar-sdk";

const {
    rpc: SorobanRpc,
    Keypair,
    TransactionBuilder,
    Networks,
    Horizon,
    Contract,
    nativeToScVal,
    scValToNative,
    Operation,
    Asset,
} = StellarSdk;

import { xdr } from "@stellar/stellar-sdk";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RPC_URL      = process.env.RPC_URL      || "https://soroban-testnet.stellar.org";
const HORIZON_URL  = process.env.HORIZON_URL  || "https://horizon-testnet.stellar.org";
const CONTRACT_ID  = process.env.CONTRACT_ID  || "";
const ORACLE_SK    = process.env.ORACLE_SK    || "";
const DATA_FEED_URL = process.env.DATA_FEED_URL || "http://localhost:3001";

if (!ORACLE_SK)   { console.error("ERROR: ORACLE_SK must be set in .env"); process.exit(1); }
if (!CONTRACT_ID) { console.error("ERROR: CONTRACT_ID must be set in .env"); process.exit(1); }

const rpc      = new SorobanRpc.Server(RPC_URL);
const horizon  = new Horizon.Server(HORIZON_URL);
const oracleKp = Keypair.fromSecret(ORACLE_SK);
const contract = new Contract(CONTRACT_ID);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

const USDC_ASSET = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

async function setupTrustline() {
    const pk = oracleKp.publicKey();
    console.log(`\n🔍 Checking Oracle Account: ${pk}`);
    
    try {
        let accountInfo;
        try {
            accountInfo = await horizon.loadAccount(pk);
        } catch (e: any) {
            if (e.response?.status === 404) {
                console.log("📍 Oracle account not found. Requesting Friendbot funding...");
                const fundRes = await axios.get(`https://friendbot.stellar.org?addr=${pk}`);
                console.log("✅ Friendbot funded account.");
                // Wait for ledger to close
                await new Promise(r => setTimeout(r, 5000));
                accountInfo = await horizon.loadAccount(pk);
            } else {
                throw e;
            }
        }

        const hasTrustline = accountInfo.balances.some((b: any) => 
            b.asset_code === "USDC" && b.asset_issuer === USDC_ASSET.issuer
        );

        if (hasTrustline) {
            console.log("✅ Oracle already has USDC trustline.");
            return;
        }

        console.log("🚀 Adding USDC trustline for oracle...");
        
        const source = await horizon.loadAccount(pk);
        const tx = new TransactionBuilder(source, {
            fee: "1000",
            networkPassphrase: Networks.TESTNET,
        })
        .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
        .setTimeout(30)
        .build();

        tx.sign(oracleKp);
        const sub = await horizon.submitTransaction(tx);
        console.log(`✅ USDC Trustline established. Tx: ${sub.hash}\n`);
    } catch (e: any) {
        if (e.response?.data?.extras) {
            console.error("❌ Trustline setup failed:", JSON.stringify(e.response.data.extras, null, 2));
        } else {
            console.error("❌ Trustline setup error:", e.message || e);
        }
    }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function run() {
    console.log(`Oracle Agent started — address: ${oracleKp.publicKey()}`);
    await setupTrustline();

    while (true) {
        try {
            // Scan IDs from 1 upward; stop at the first missing entry
            for (let i = 1; i <= 200; i++) {
                const market = await fetchMarket(i);
                if (!market) break;
                if (isReadyToResolve(market)) {
                    console.log(`Market #${i} ready → "${market.question}"`);
                    await resolveMarket(i, String(market.question));
                }
            }
        } catch (e) {
            console.error("Oracle loop error:", e);
        }

        await new Promise(r => setTimeout(r, 60_000));
    }
}

// ── Contract reads (direct ledger) ───────────────────────────────────────────

async function fetchMarket(id: number): Promise<any> {
    // DataKey::Market(u64) -> Vec([Symbol("Market"), U64(i)])
    try {
        const entry = await rpc.getContractData(
            CONTRACT_ID,
            xdr.ScVal.scvVec([
                xdr.ScVal.scvSymbol("Market"),
                xdr.ScVal.scvU64(xdr.Uint64.fromString(String(id))),
            ]),
            SorobanRpc.Durability.Persistent
        );
        if (!entry) return null;
        // val is LedgerEntryData; .contractData().val() gives the stored ScVal
        return scValToNative(entry.val.contractData().val());
    } catch {
        return null;
    }
}

function isReadyToResolve(market: any): boolean {
    const now     = Math.floor(Date.now() / 1000);
    const state   = market.state ? Object.keys(market.state)[0] : "Open";
    const endTime = Number(market.end_time);
    const outcome = Number(market.outcome);
    return outcome === 0 && endTime < now && state !== "Resolved";
}

// ── Resolution pipeline ───────────────────────────────────────────────────────

async function resolveMarket(id: number, question: string) {
    try {
        const symbol    = detectSymbol(question);
        const priceData = await fetchWithPayment(symbol);
        if (!priceData) {
            console.error(`Could not fetch price data for market #${id}`);
            return;
        }

        const outcome = await askClaude(question, priceData);
        console.log(
            `Market #${id} | ${symbol}: $${priceData.price} | ` +
            `Claude says: ${outcome === 1 ? "YES ✓" : "NO ✗"}`
        );

        const evidence = JSON.stringify({
            symbol,
            price:     priceData.price,
            timestamp: priceData.timestamp,
            source:    priceData.source,
            outcome:   outcome === 1 ? "YES" : "NO",
        });

        await submitResolution(id, outcome, evidence);
    } catch (e) {
        console.error(`resolveMarket #${id} error:`, e);
    }
}

// Detect relevant asset from the question text
function detectSymbol(question: string): string {
    const q = question.toLowerCase();
    if (q.includes("eth") || q.includes("ethereum")) return "ETH_USD";
    return "BTC_USD"; // default
}

// ── x402 data fetch ───────────────────────────────────────────────────────────

async function fetchWithPayment(
    symbol: string
): Promise<{ price: string; timestamp: number; source: string } | null> {
    try {
        // Attempt without payment first
        const resp = await axios.get(`${DATA_FEED_URL}/data/${symbol}`);
        return resp.data.data;
    } catch (err: any) {
        if (err.response?.status === 402) {
            console.log("x402 challenge received — paying for data…");
            const challenge    = err.response.data;
            const paymentHash  = await payForData(challenge);

            const retryResp = await axios.get(`${DATA_FEED_URL}/data/${symbol}`, {
                headers: { "x-payment-proof": paymentHash },
            });
            return retryResp.data.data;
        }
        console.error("Data feed error:", err.message);
        return null;
    }
}

async function payForData(challenge: any): Promise<string> {
    const source = await rpc.getAccount(oracleKp.publicKey());
    
    let op;
    try {
        await horizon.loadAccount(challenge.destination);
        // Exists, use normal payment
        op = Operation.payment({
            destination: challenge.destination,
            asset:       Asset.native(),
            amount:      challenge.amount,
        });
    } catch {
        // Doesn't exist, fund and create it
        op = Operation.createAccount({
            destination: challenge.destination,
            startingBalance: challenge.amount,
        });
    }

    const tx = new TransactionBuilder(source, {
        fee: "100",
        networkPassphrase: Networks.TESTNET,
    })
    .addOperation(op)
    .setTimeout(30)
    .build();

    tx.sign(oracleKp);
    try {
        const submission = await horizon.submitTransaction(tx);
        return submission.hash;
    } catch (err: any) {
        if (err.response?.data?.extras) {
            console.error("Payment Tx Failed Extras:", JSON.stringify(err.response.data.extras, null, 2));
        }
        throw err;
    }
}

// ── Claude AI oracle decision ─────────────────────────────────────────────────

async function askClaude(
    question: string,
    priceData: { price: string; timestamp: number; source: string }
): Promise<number> {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("⚠️ ANTHROPIC_API_KEY is not set. Defaulting to YES outcome for testing.");
        return 1;
    }

    const response = await anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{
            role: "user",
            content:
                `You are a prediction market oracle. Evaluate whether the market question resolves YES or NO.\n\n` +
                `Market Question: "${question}"\n` +
                `Current Price: $${priceData.price}\n` +
                `Data Source: ${priceData.source}\n` +
                `Timestamp: ${new Date(priceData.timestamp).toISOString()}\n\n` +
                `Reply with ONLY the word YES or NO.`,
        }],
    });

    const text = (response.content[0] as Anthropic.TextBlock).text.trim().toUpperCase();
    return text.startsWith("YES") ? 1 : 2;
}

// ── On-chain submission ───────────────────────────────────────────────────────

async function submitResolution(id: number, outcome: number, evidence: string) {
    const source = await rpc.getAccount(oracleKp.publicKey());

    const op = contract.call(
        "resolve",
        nativeToScVal(BigInt(id), { type: "u64" }),
        nativeToScVal(outcome,    { type: "u32" }),
        nativeToScVal(evidence,   { type: "string" })
    );

    const tx = new TransactionBuilder(source, {
        fee: "1000",
        networkPassphrase: Networks.TESTNET,
    })
    .addOperation(op)
    .setTimeout(30)
    .build();

    // Soroban mandates a simulate → assemble → sign → submit flow for writes
    const sim = await rpc.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(sim)) {
        console.error("❌ Resolution Simulation Failed!");
        console.error("Simulation response:", JSON.stringify(sim, null, 2));
        throw new Error(`Simulation failed: ${(sim as any).error}`);
    }

    console.log("📝 Resolution simulation successful. Assembling transaction...");
    const preparedTx = SorobanRpc.assembleTransaction(tx, sim).build();
    preparedTx.sign(oracleKp);

    const submitResult = await rpc.sendTransaction(preparedTx);
    console.log(`✉️ Resolution submitted. Tx: ${submitResult.hash}. Polling for confirmation...`);

    // Poll until confirmed
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2_000));
        const status = await rpc.getTransaction(submitResult.hash);
        if (status.status === "SUCCESS") {
            console.log(`Market #${id} resolved on-chain ✓`);
            return;
        }
        if (status.status === "FAILED") {
            console.error("❌ Resolution Transaction Failed on-chain!");
            console.error("Transaction details:", JSON.stringify(status, null, 2));
            throw new Error(`Tx failed: ${JSON.stringify(status)}`);
        }
    }
    throw new Error("❌ Resolution Tx not confirmed within timeout");
}

run();
