import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";
const { rpc: SorobanRpc, TransactionBuilder } = StellarSdk;
import { RPC_URL, NETWORK_PASSPHRASE } from "@/lib/stellar";

const rpc = new SorobanRpc.Server(RPC_URL);

export async function POST(req: NextRequest) {
  try {
    const { xdr } = await req.json();
    if (!xdr) return NextResponse.json({ error: "Missing xdr" }, { status: 400 });

    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    const result = await rpc.sendTransaction(tx);

    if (result.status === "ERROR") {
      return NextResponse.json({ error: result.errorResult?.toString() }, { status: 400 });
    }

    // Poll for confirmation
    let attempts = 0;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 1500));
      const status = await rpc.getTransaction(result.hash);
      if (status.status === "SUCCESS") {
        return NextResponse.json({ hash: result.hash, status: "success" });
      }
      if (status.status === "FAILED") {
        return NextResponse.json({ error: "Transaction failed onchain" }, { status: 400 });
      }
      attempts++;
    }

    return NextResponse.json({ hash: result.hash, status: "pending" });
  } catch (e: any) {
    console.error("submit-tx error", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
