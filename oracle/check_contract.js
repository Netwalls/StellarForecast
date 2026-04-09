const StellarSdk = require('@stellar/stellar-sdk');
const { rpc: SorobanRpc, scValToNative, xdr } = StellarSdk;

const RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = "CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH";
const rpc = new SorobanRpc.Server(RPC_URL);

async function main() {
    try {
        const key = xdr.ScVal.scvSymbol("Config");
        const entry = await rpc.getContractData(CONTRACT_ID, key, "instance");
        console.log("Config:", JSON.stringify(scValToNative(entry.val.contractData().val()), null, 2));
        
        const countKey = xdr.ScVal.scvSymbol("MarketCount");
        const countEntry = await rpc.getContractData(CONTRACT_ID, countKey, "instance");
        console.log("Market Count:", scValToNative(countEntry.val.contractData().val()).toString());
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
