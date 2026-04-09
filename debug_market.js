const StellarSdk = require('@stellar/stellar-sdk');
const { rpc: SorobanRpc, scValToNative, xdr } = StellarSdk;

const RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = "CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH";
const rpc = new SorobanRpc.Server(RPC_URL);

async function main() {
    const id = 4;
    const key = xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("Market"),
        xdr.ScVal.scvU64(xdr.Uint64.fromString(id.toString()))
    ]);

    try {
        const marketData = await rpc.getContractData(CONTRACT_ID, key, "persistent");
        const rawMarket = scValToNative(marketData.val.contractData().val());
        console.log("Market State Raw:", JSON.stringify(rawMarket.state, null, 2));
        console.log("Market State Value:", rawMarket.state);
        console.log("Market Outcome:", rawMarket.outcome);
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
