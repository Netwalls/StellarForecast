/**
 * Initializes an already-deployed prediction market contract.
 * Run this if the contract exists but initialize() was never called.
 *
 *   node initialize.js
 */

const StellarSdk = require("@stellar/stellar-sdk");
const { rpc: rpcNs, Keypair, TransactionBuilder, Networks, Contract, Address, nativeToScVal, Asset } = StellarSdk;
const fs = require("fs");

const RPC_URL          = "https://soroban-testnet.stellar.org";
const NETWORK          = Networks.TESTNET;
const CONTRACT_ID      = "CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH";
const USDC_ISSUER      = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const ORACLE_FEE_BPS   = 200; // 2%

const rpc = new rpcNs.Server(RPC_URL);

async function main() {
    // Derive the Soroban token contract ID for Circle testnet USDC
    const usdcAsset      = new Asset("USDC", USDC_ISSUER);
    const usdcContractId = usdcAsset.contractId(NETWORK);
    console.log("USDC contract ID:", usdcContractId);

    // Generate a fresh oracle keypair and fund it via Friendbot
    const oracleKp = Keypair.random();
    console.log("Oracle PK:", oracleKp.publicKey());
    console.log("Oracle SK:", oracleKp.secret());

    console.log("Funding oracle via Friendbot...");
    const fundRes = await fetch(`https://friendbot.stellar.org?addr=${oracleKp.publicKey()}`);
    if (!fundRes.ok) throw new Error("Friendbot failed: " + await fundRes.text());
    await new Promise(r => setTimeout(r, 4000)); // wait for ledger

    // Build initialize() call
    // Signature: initialize(token: Address, oracle: Address, oracle_fee_bps: u32)
    const contract = new Contract(CONTRACT_ID);
    const account  = await rpc.getAccount(oracleKp.publicKey());

    let tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: NETWORK })
        .addOperation(contract.call(
            "initialize",
            new Address(usdcContractId).toScVal(),    // token (USDC)
            new Address(oracleKp.publicKey()).toScVal(), // oracle
            nativeToScVal(ORACLE_FEE_BPS, { type: "u32" })
        ))
        .setTimeout(30)
        .build();

    const sim = await rpc.simulateTransaction(tx);
    if (rpcNs.Api.isSimulationError(sim)) {
        // AlreadyInitialized (error #1) is harmless — just means it was already done
        if (sim.error.includes("#1")) {
            console.log("Contract is already initialized. Nothing to do.");
            console.log("If you need the oracle SK, redeploy or use the existing one.");
            return;
        }
        throw new Error("Simulation failed: " + sim.error);
    }

    tx = rpcNs.assembleTransaction(tx, sim).build();
    tx.sign(oracleKp);

    const result = await rpc.sendTransaction(tx);
    console.log("Initialize tx submitted:", result.hash);

    // Poll for confirmation
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const status = await rpc.getTransaction(result.hash);
        if (status.status === "SUCCESS") {
            console.log("\n✓ Contract initialized successfully!\n");
            break;
        }
        if (status.status === "FAILED") {
            throw new Error("Transaction failed: " + JSON.stringify(status));
        }
    }

    // Save to oracle .env
    const envContent = [
        `CONTRACT_ID=${CONTRACT_ID}`,
        `ORACLE_SK=${oracleKp.secret()}`,
        `RPC_URL=${RPC_URL}`,
        `HORIZON_URL=https://horizon-testnet.stellar.org`,
        `DATA_FEED_URL=http://localhost:3001`,
        `ANTHROPIC_API_KEY=`,
    ].join("\n") + "\n";

    fs.writeFileSync("oracle/.env", envContent);
    console.log("Oracle .env written to oracle/.env");
    console.log("Add your ANTHROPIC_API_KEY to oracle/.env, then run: cd oracle && npm start");
}

main().catch(e => {
    console.error(e.message || e);
    process.exit(1);
});
