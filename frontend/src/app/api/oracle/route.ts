import { NextRequest, NextResponse } from "next/server";

// POST /api/oracle — trigger the oracle agent to resolve a market
// The actual resolution logic lives in the oracle/ service, but we expose
// a webhook here so the frontend can trigger it for demo purposes.
export async function POST(req: NextRequest) {
  try {
    const { market_id } = await req.json();
    if (!market_id) {
      return NextResponse.json({ error: "market_id required" }, { status: 400 });
    }

    const oracleUrl = process.env.ORACLE_URL || "http://localhost:3001";
    const res = await fetch(`${oracleUrl}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market_id }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
