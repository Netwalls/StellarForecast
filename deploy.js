const StellarSdk = require("@stellar/stellar-sdk");
const { SorobanRpc, Keypair, TransactionBuilder, Networks, Contract, Address, nativeToScVal, xdr, scValToNative, Operation } = StellarSdk;
const { rpc: rpcNamespace } = StellarSdk;
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

// 1. Generate & Fund Admin
const adminKp = Keypair.random();
const rpc = new rpcNamespace.Server(RPC_URL);

async function run() {
    console.log("Admin PK:", adminKp.publicKey());
    console.log("Admin SK:", adminKp.secret());

    console.log("Funding admin via Friendbot...");
    const fund = await fetch(`https://friendbot.stellar.org?addr=${adminKp.publicKey()}`);
    if (!fund.ok) throw new Error("Friendbot failed");
    await new Promise(r => setTimeout(r, 4000));

    // 2. Upload WASM
    const wasmPath = path.join(__dirname, "contracts/target/wasm32v1-none/release/stellar_predict.wasm");
    const wasm = fs.readFileSync(wasmPath);
    
    console.log("Uploading WASM...");
    let account = await rpc.getAccount(adminKp.publicKey());
    let tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(Operation.uploadContractWasm({ wasm }))
        .setTimeout(30)
        .build();
    
    const sim = await rpc.simulateTransaction(tx);
    tx = rpcNamespace.assembleTransaction(tx, sim);
    tx.sign(adminKp);
    let res = await rpc.sendTransaction(tx);
    console.log("Upload Tx Hash:", res.hash);

    // Wait for status
    let status = "PENDING";
    while (status === "PENDING") {
        await new Promise(r => setTimeout(r, 2000));
        const txRes = await rpc.getTransaction(res.hash);
        status = txRes.status;
        if (status === "SUCCESS") {
            const wasmId = txRes.returnValue.bytes().toString("hex");
            console.log("WASM ID:", wasmId);

            // 3. Create Contract
            console.log("Instantiating Contract...");
            account = await rpc.getAccount(adminKp.publicKey());
            tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: NETWORK_PASSPHRASE })
                .addOperation(Operation.createContract({ wasmId, address: adminKp.publicKey() })) // This is the simplified Operation.createContract
                .setTimeout(30)
                .build();
            
            const sim2 = await rpc.simulateTransaction(tx);
            tx = rpcNamespace.assembleTransaction(tx, sim2);
            tx.sign(adminKp);
            res = await rpc.sendTransaction(tx);
            console.log("Instantiate Tx Hash:", res.hash);
            
            // Wait for instantiate
            let status2 = "PENDING";
            while (status2 === "PENDING") {
                await new Promise(r => setTimeout(r, 2000));
                const txRes2 = await rpc.getTransaction(res.hash);
                status2 = txRes2.status;
                if (status2 === "SUCCESS") {
                    const contractId = Address.fromScVal(txRes2.returnValue).toString();
                    console.log("!!! CONTRACT_ID:", contractId);

                    // 4. Initialize
                    console.log("Initializing Contract...");
                    const contract = new Contract(contractId);
                    account = await rpc.getAccount(adminKp.publicKey());
                    
                    // Circle testnet USDC — derive Soroban contract ID from the classic asset
                    const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
                    const usdcContractId = new StellarSdk.Asset("USDC", USDC_ISSUER).contractId(NETWORK_PASSPHRASE);

                    // initialize(token, oracle, oracle_fee_bps)  ← correct order
                    tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: NETWORK_PASSPHRASE })
                        .addOperation(contract.call("initialize",
                            new Address(usdcContractId).toScVal(),       // token (USDC)
                            new Address(adminKp.publicKey()).toScVal(),   // oracle (admin for demo)
                            nativeToScVal(200, { type: "u32" })          // fee bps (2%)
                        ))
                        .setTimeout(30)
                        .build();

                    const sim3 = await rpc.simulateTransaction(tx);
                    tx = rpcNamespace.assembleTransaction(tx, sim3);
                    tx.sign(adminKp);
                    await rpc.sendTransaction(tx);
                    console.log("Initialization complete!");
                    
                    fs.writeFileSync(".env.local", `NEXT_PUBLIC_CONTRACT_ID=${contractId}\nORACLE_SK=${adminKp.secret()}\n`);
                    console.log("Saved to .env.local");
                    return;
                }
            }
        }
    }
}

// Add Operation ref
// Operation is already declared at the top

run().catch(console.error);
