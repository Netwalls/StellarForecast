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
        const entry = await rpc.getContractData(CONTRACT_ID, key, SorobanRpc.Durability.Persistent);
        const val = entry.val.contractData().val();
        
        // Use scValToNative
        const native = scValToNative(val);
        console.log("Native Market State:", JSON.stringify(native.state, null, 2));
        console.log("Type of State:", typeof native.state);
        
        // Print raw XDR for state
        const rawStateXdr = val.map().find(e => e.key().symbol().toString() === "state").val();
        console.log("Raw State XDR Tag:", rawStateXdr.switch().name);
        
        if (rawStateXdr.switch().name === 'scvSymbol') {
            console.log("State Symbol Value:", rawStateXdr.symbol().toString());
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
