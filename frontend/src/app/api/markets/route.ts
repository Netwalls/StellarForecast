import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import * as StellarSdk from "@stellar/stellar-sdk";
const { rpc: SorobanRpc, scValToNative, xdr } = StellarSdk;
import { RPC_URL, CONTRACT_ID } from "@/lib/stellar";

const rpc = new SorobanRpc.Server(RPC_URL);

// Helper to handle SDK scValToNative issues in some environments
function robustScValToNative(scVal: any): any {
  try {
    return scValToNative(scVal);
  } catch (e) {
    // Fallback for Map/Vec if scValToNative fails
    const type = scVal.switch().name;
    if (type === 'scvMap') {
      const res: any = {};
      scVal.map().forEach((entry: any) => {
        const key = robustScValToNative(entry.key());
        const val = robustScValToNative(entry.val());
        res[key] = val;
      });
      return res;
    }
    if (type === 'scvVec') {
      return scVal.vec().map((v: any) => robustScValToNative(v));
    }
    // Handle BigInt types manually if .toBigInt() is missing
    if (type === 'scvU64' || type === 'scvI64' || type === 'scvU128' || type === 'scvI128') {
      return scVal.value().toString();
    }
    if (type === 'scvSymbol' || type === 'scvString') {
      return scVal.value().toString();
    }
    if (type === 'scvAddress') {
      return scVal.address().toString();
    }
    return scVal.value();
  }
}

export async function GET() {
  console.log("Fetching markets for contract:", CONTRACT_ID);
  try {
    if (!CONTRACT_ID) {
      return NextResponse.json({ markets: [], message: "Contract ID missing" });
    }

    const markets: any[] = [];
    
    // Brute force search from 1 to 20 to find markets
    // DataKey::Market(u64) -> Vec([Symbol("Market"), U64(i)])
    for (let i = 1; i <= 20; i++) {
        try {
            const key = xdr.ScVal.scvVec([
                xdr.ScVal.scvSymbol("Market"),
                xdr.ScVal.scvU64(xdr.Uint64.fromString(i.toString()))
            ]);

            const marketData = await rpc.getContractData(
                CONTRACT_ID,
                key,
                "persistent" as any
            ).catch(() => null);

            if (marketData) {
                console.log(`Found market ${i}`);
                const rawMarket = robustScValToNative(marketData.val.contractData().val());
                
                console.log(`Market ${i} raw state:`, JSON.stringify(rawMarket.state));
                // Robust state parsing: could be string "Resolved", object { Resolved: [] }, or array ["Resolved"]
                let state = "Open";
                if (rawMarket.state !== undefined && rawMarket.state !== null) {
                    if (typeof rawMarket.state === 'string') {
                        state = rawMarket.state;
                    } else if (Array.isArray(rawMarket.state)) {
                        // Soroban enum encoded as vec: ["Open"] or ["Open", value]
                        state = (rawMarket.state[0] || "Open").toString();
                    } else if (typeof rawMarket.state === 'object') {
                        state = Object.keys(rawMarket.state)[0] || "Open";
                    }
                }

                markets.push({
                    id: Number(rawMarket.id),
                    creator: rawMarket.creator?.toString() || "",
                    question: rawMarket.question?.toString() || "",
                    end_time: Number(rawMarket.end_time),
                    yes_pool: rawMarket.yes_pool?.toString() || "0",
                    no_pool: rawMarket.no_pool?.toString() || "0",
                    state: state.toLowerCase(),
                    outcome: Number(rawMarket.outcome || 0),
                    evidence_hash: rawMarket.evidence_hash?.toString() || "",
                });
            }
        } catch (e) {
            console.error(`Error fetching market ${i}:`, e);
        }
    }

    console.log(`Retrieved ${markets.length} markets`);
    return NextResponse.json(
        { markets: markets.reverse() },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (e: any) {
    console.error("Critical error in /api/markets:", e);
    return NextResponse.json({ markets: [], error: e.message || "Unknown error" }, { status: 500 });
  }
}
