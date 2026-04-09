const StellarSdk = require('./oracle/node_modules/@stellar/stellar-sdk');
const { rpc: rpcNs, xdr, scValToNative } = StellarSdk;

const RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = "CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH";
const rpc = new rpcNs.Server(RPC_URL);

async function main() {
    try {
        console.log("Querying contract data for token address...");
        // Usually stored under DataKey::Token or similar. We can dump all entries.
        // Wait, Soroban RPC doesn't let us dump all easily.
        // Let's just create an operation to add trustline to CBIELTK... manually!
    } catch (e) {
        console.error(e);
    }
}
main();
