const StellarSdk = require('@stellar/stellar-sdk');
const { rpc: SorobanRpc, scValToNative, xdr } = StellarSdk;

const RPC_URL = "https://soroban-testnet.stellar.org";
const CONTRACT_ID = "CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH";
const rpc = new SorobanRpc.Server(RPC_URL);

async function main() {
    for (let i = 1; i <= 20; i++) {
        const key = xdr.ScVal.scvVec([
            xdr.ScVal.scvSymbol("Market"),
            xdr.ScVal.scvU64(xdr.Uint64.fromString(i.toString()))
        ]);

        try {
            const marketData = await rpc.getContractData(CONTRACT_ID, key, "persistent").catch(() => null);
            if (!marketData) continue;
            const rawMarket = scValToNative(marketData.val.contractData().val());
            console.log(`ID: ${i} | Question: ${rawMarket.question} | State: ${JSON.stringify(rawMarket.state)} | Outcome: ${rawMarket.outcome}`);
        } catch (e) {
            // skip
        }
    }
}
main();
