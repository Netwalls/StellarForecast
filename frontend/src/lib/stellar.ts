import * as StellarSdk from "@stellar/stellar-sdk";

const {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  rpc: SorobanRpc,
  Contract,
  nativeToScVal,
  scValToNative,
  Address,
} = StellarSdk;

import { xdr } from "@stellar/stellar-sdk";

export {
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Keypair,
  SorobanRpc,
  Contract,
  nativeToScVal,
  scValToNative,
  xdr,
  Address,
};

export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

// Testnet USDC issued by Circle
export const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
export const USDC_ASSET = new Asset("USDC", USDC_ISSUER);

// Set NEXT_PUBLIC_CONTRACT_ID in frontend/.env.local after deploying
export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "CBCUO5ELKJXQS2K2QI625CXZYS3DCHCBFIOYW5YPMDCX7EOB235C2QHH";

export const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ── Contract client helpers ───────────────────────────────────────────────

export function getContract() {
  return new Contract(CONTRACT_ID);
}

export async function loadAccount(publicKey: string) {
  const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
  if (!response.ok) throw new Error("Account not found — fund it at friendbot first");
  return response.json();
}

export async function simulateAndAssemble(
  tx: any,
  publicKey: string
): Promise<string> {
  try {
    const prepared = await rpc.prepareTransaction(tx);
    return prepared.toEnvelope().toXDR("base64");
  } catch (e: any) {
    if (e.message?.includes("Simulation failed")) {
      throw new Error(`Simulation failed: ${e.message}`);
    }
    throw e;
  }
}

// ── Build a contract call XDR for wallet signing ──────────────────────────

export async function buildContractTx(
  publicKey: string,
  method: string,
  params: xdr.ScVal[]
): Promise<string> {
  const account = await rpc.getAccount(publicKey);
  const contract = getContract();

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...params))
    .setTimeout(30)
    .build();

  return await simulateAndAssemble(tx, publicKey);
}

export async function buildTrustTx(publicKey: string): Promise<string> {
  const account = await rpc.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: "1000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: USDC_ASSET,
      })
    )
    .setTimeout(30)
    .build();

  return tx.toEnvelope().toXDR("base64");
}

// ── Helpers to encode contract args ──────────────────────────────────────

export function addressToScVal(addr: string): xdr.ScVal {
  return new Address(addr).toScVal();
}

export function u64ToScVal(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: "u64" });
}

export function i128ToScVal(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: "i128" });
}

export function boolToScVal(b: boolean): xdr.ScVal {
  return xdr.ScVal.scvBool(b);
}

export function stringToScVal(env_str: string): xdr.ScVal {
  return nativeToScVal(env_str, { type: "string" });
}

// ── Parse contract return values ──────────────────────────────────────────

export function parseMarket(scVal: xdr.ScVal) {
  const raw = scValToNative(scVal) as Record<string, any>;
  return {
    id: Number(raw.id),
    creator: raw.creator.toString(),
    question: raw.question.toString(),
    end_time: Number(raw.end_time),
    yes_pool: raw.yes_pool.toString(),
    no_pool: raw.no_pool.toString(),
    state: raw.state ? Object.keys(raw.state)[0] : "Open",
    outcome: Number(raw.outcome),
    evidence_hash: raw.evidence_hash?.toString() || "",
  };
}

// ── Friendbot funder (testnet only) ──────────────────────────────────────

export async function fundTestnet(publicKey: string) {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  );
  return res.ok;
}

// ── Format USDC display ───────────────────────────────────────────────────

export function formatUSDC(stroops: string | bigint): string {
  const amount = BigInt(stroops);
  const whole = amount / 10_000_000n;
  const frac = amount % 10_000_000n;
  return `${whole}.${frac.toString().padStart(7, "0").slice(0, 2)}`;
}

export function usdcToStroops(usdc: string): bigint {
  const [whole, frac = "0"] = usdc.split(".");
  const fracPadded = frac.padEnd(7, "0").slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
}
