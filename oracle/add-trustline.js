const StellarSdk = require('@stellar/stellar-sdk');
const { Horizon, Keypair, TransactionBuilder, Networks, Operation, Asset } = StellarSdk;

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const oracleKp = Keypair.fromSecret("SD23JQ5TAXTYJFV6EF574PTRZCBPBXRJTBSKXX7FOF3K3L7D7HF5VK42");
const USDC_ASSET = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");

async function main() {
    console.log("Loading oracle account:", oracleKp.publicKey());
    const accountInfo = await horizon.loadAccount(oracleKp.publicKey());
    
    console.log("Balances:", accountInfo.balances.map(b => `${b.asset_code || 'XLM'}: ${b.balance}`));

    console.log("Submitting changeTrust for USDC...");
    const tx = new TransactionBuilder(accountInfo, {
        fee: "1000",
        networkPassphrase: Networks.TESTNET,
    })
    .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
    .setTimeout(30)
    .build();

    tx.sign(oracleKp);
    try {
        const sub = await horizon.submitTransaction(tx);
        console.log("Trustline added! Tx hash:", sub.hash);
    } catch (e) {
        console.error("Failed to add trustline:", e.response ? JSON.stringify(e.response.data.extras || e.response.data, null, 2) : e.message);
    }
}
main();
