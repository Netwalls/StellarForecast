"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import WalletConnect from "@/components/WalletConnect";
import Navbar from "@/components/Navbar";
import { useWallet } from "@/hooks/useWallet";
import { Market } from "@/lib/types";
import {
  rpc,
  loadAccount,
  buildContractTx,
  buildTrustTx,
  addressToScVal,
  u64ToScVal,
  i128ToScVal,
  boolToScVal,
  formatUSDC,
  usdcToStroops,
} from "@/lib/stellar";

export default function MarketPage() {
  const { id } = useParams<{ id: string }>();
  const { publicKey, signAndSubmit } = useWallet();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [usdcBalance, setUsdcBalance] = useState<string>("0");
  const [amount, setAmount] = useState("1");
  const [betting, setBetting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [oracleLog, setOracleLog] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        const m = d.markets?.find((x: Market) => x.id === Number(id));
        setMarket(m || null);
      })
      .finally(() => setLoading(false));

    if (publicKey) {
      loadAccount(publicKey)
        .then(acc => {
          const usdc = acc.balances.find((b: any) => b.asset_code === "USDC");
          setUsdcBalance(usdc ? usdc.balance : "0");
        })
        .catch(() => setUsdcBalance("0"));
    }
  }, [id, txHash, publicKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-8">
        <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
        <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-brand-fg">Decoding Reality...</h2>
            <p className="text-brand-fg/40 font-medium">Synchronizing with the Stellar network</p>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
       <div className="min-h-screen">
          <Navbar />
          <div className="max-w-xl mx-auto px-8 py-40 text-center space-y-8">
             <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-red/5 text-brand-red border border-brand-red/10">
                <span className="text-4xl">?</span>
             </div>
             <div className="space-y-4">
                <h1 className="text-4xl font-bold text-brand-fg font-serif">Market Not Found</h1>
                <p className="text-brand-fg/40 font-medium text-lg">The prediction market you are looking for does not exist or hasn't propagated to the network yet.</p>
             </div>
             <Link href="/markets" className="btn-primary inline-block">
                Return to Explorer
             </Link>
          </div>
       </div>
    );
  }

  const total = BigInt(market.yes_pool) + BigInt(market.no_pool);
  const yesPercent = total > 0n
    ? Math.round(Number((BigInt(market.yes_pool) * 100n) / total))
    : 50;

  const endsIn = () => {
    const diff = market.end_time - Math.floor(Date.now() / 1000);
    if (diff <= 0) return "Outcome reached";
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`;
  };

  const placeBet = async (isYes: boolean) => {
    if (!publicKey) { setError("Please connect your wallet first"); return; }
    setBetting(true);
    setError("");
    try {
      const stroops = usdcToStroops(amount);
      const xdr = await buildContractTx(publicKey, "bet", [
        addressToScVal(publicKey),
        u64ToScVal(Number(id)),
        boolToScVal(isYes),
        i128ToScVal(stroops),
      ]);
      const hash = await signAndSubmit(xdr);
      setTxHash(hash);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBetting(false);
    }
  };

  const claimWinnings = async () => {
    if (!publicKey) return;
    setClaiming(true);
    setError("");
    try {
      const xdr = await buildContractTx(publicKey, "claim", [
        addressToScVal(publicKey),
        u64ToScVal(Number(id)),
      ]);
      const hash = await signAndSubmit(xdr);
      setTxHash(hash);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setClaiming(false);
    }
  };

  const setupWallet = async () => {
    if (!publicKey) return;
    setSettingUp(true);
    setError("");
    try {
      const xdr = await buildTrustTx(publicKey);
      const hash = await signAndSubmit(xdr);
      setTxHash(hash);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSettingUp(false);
    }
  };

  const triggerOracle = async () => {
    setTriggering(true);
    setOracleLog("");
    setError("");
    try {
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market_id: Number(id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOracleLog(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="max-w-3xl mx-auto px-8 py-20">
        {/* Main Content */}
        <div className="space-y-12">
          {/* Header */}
          <div className="space-y-8">
            <div className="flex items-center gap-4">
               {market.state === "resolved" ? (
                <span className="badge-resolved">Outcome Reached</span>
              ) : market.state === "closed" ? (
                <span className="badge-closed">In Deliberation</span>
              ) : (
                <span className="badge-open">Open for Participation</span>
              )}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold leading-[1.1] text-brand-fg font-serif tracking-tight">
              {market.question}
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8">
               <div className="space-y-4">
                  <div className="flex items-center justify-between font-bold text-xs uppercase tracking-widest">
                    <span className="text-brand-green">{yesPercent}% Yes Confidence</span>
                    <span className="text-brand-fg/20">{formatUSDC(market.yes_pool)} USDC</span>
                  </div>
                  <div className="h-3 rounded-full bg-brand-muted overflow-hidden">
                    <div className="h-full bg-brand-green transition-all" style={{ width: `${yesPercent}%` }} />
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="flex items-center justify-between font-bold text-xs uppercase tracking-widest">
                    <span className="text-brand-red">{100 - yesPercent}% No Anticipation</span>
                    <span className="text-brand-fg/20">{formatUSDC(market.no_pool)} USDC</span>
                  </div>
                  <div className="h-3 rounded-full bg-brand-muted overflow-hidden">
                    <div className="h-full bg-brand-red transition-all" style={{ width: `${100 - yesPercent}%` }} />
                  </div>
               </div>
            </div>
          </div>

          {/* Action Panels */}
          <div className="grid gap-12 pt-12 border-t border-brand-fg/5">
            {market.state !== "resolved" && market.state !== "closed" && (
              <div className="card space-y-10">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-bold text-brand-fg">Participate in the prediction</h2>
                  <p className="text-brand-fg/40 font-medium">Contribute to the collective intelligence by placing a bet.</p>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col gap-3">
                    <label className="text-[10px] font-bold text-brand-fg/30 uppercase tracking-widest">Contribution Amount (USDC)</label>
                    <div className="flex flex-wrap items-center gap-4">
                      <input
                        type="number"
                        value={amount}
                        min="0.01"
                        step="0.01"
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-brand-muted border-none rounded-2xl px-6 py-4 text-brand-fg w-40 focus:ring-2 focus:ring-brand-accent/20 outline-none text-lg font-bold"
                      />
                      <div className="flex gap-2">
                        {["10", "50", "250"].map((v) => (
                          <button
                            key={v}
                            onClick={() => setAmount(v)}
                            className="bg-brand-fg/5 hover:bg-brand-fg text-brand-fg hover:text-brand-bg px-4 py-3 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
                          >
                            ${v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 pt-4">
                    <button onClick={() => placeBet(true)} disabled={betting || !publicKey} className="btn-yes text-lg py-5">
                      {betting ? "Syncing..." : "Support Yes"}
                    </button>
                    <button onClick={() => placeBet(false)} disabled={betting || !publicKey} className="btn-no text-lg py-5">
                      {betting ? "Syncing..." : "Support No"}
                    </button>
                  </div>
                  
                  {error && error.toLowerCase().includes("trustline") && (
                    <div className="p-6 rounded-[2rem] bg-brand-yellow/10 border border-brand-yellow/20 space-y-4">
                        <p className="text-brand-yellow font-bold text-sm">Action Required: Missing USDC Trustline</p>
                        <p className="text-brand-fg/50 text-xs leading-relaxed">To hold and bet with USDC, your wallet must trust the issuer. Click below to add the required trustline.</p>
                        <button 
                            onClick={setupWallet} 
                            disabled={settingUp}
                            className="w-full py-4 rounded-xl bg-brand-yellow text-brand-bg font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all"
                        >
                            {settingUp ? "Adding Trustline..." : "Add USDC Trustline to Wallet"}
                        </button>
                    </div>
                  )}
                  {error && (
                    <div className="p-6 rounded-[1.5rem] bg-brand-red/5 border border-brand-red/10 text-brand-red text-center text-sm font-semibold">
                      {error.includes("#10") ? "Insufficient USDC: You need to acquire Testnet USDC to place this bet." : 
                       error.includes("#13") ? "Missing Trustline: Please use the box below to prepare your wallet." :
                       error}
                    </div>
                  )}

                  {Number(usdcBalance) === 0 && (
                    <div className="p-6 rounded-[2rem] bg-brand-accent/5 border border-brand-accent/10 space-y-4">
                        <p className="text-brand-accent font-bold text-sm">Action Required: Get Testnet USDC</p>
                        <p className="text-brand-fg/50 text-xs leading-relaxed">Your account has 0 USDC. Since this is Testnet, you can swap XLM for USDC using a Testnet DEX to participate.</p>
                        <a 
                            href="https://stellarterm.com/exchange/USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5/XLM-native?network=testnet"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block w-full text-center py-4 rounded-xl bg-brand-accent text-white font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all"
                        >
                            Swap XLM for Testnet USDC
                        </a>
                    </div>
                  )}

                  {!publicKey && (
                    <p className="text-center text-brand-fg/40 text-xs font-semibold uppercase tracking-widest">Please connect your wallet to participate</p>
                  )}
                </div>
              </div>
            )}

            {market.state === "resolved" && (
              <div className="card space-y-8 bg-brand-accent/5 border-brand-accent/10">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-bold text-brand-fg">Redeem your share</h2>
                  <p className="text-brand-fg/50 font-medium leading-relaxed">
                    The conversation has concluded. Outcomes are final based on the consensus truth.
                    The official result is <span className={`font-bold ${market.outcome === 1 ? "text-brand-green" : "text-brand-red"}`}>{market.outcome === 1 ? "YES" : "NO"}</span>.
                  </p>
                </div>
                <button onClick={claimWinnings} disabled={claiming || !publicKey} className="btn-primary w-full py-6 text-xl">
                  {claiming ? "Redeeming..." : "Redeem Share of Pool"}
                </button>

                {market.evidence_hash && (
                  <div className="bg-white rounded-[1.5rem] p-6 shadow-sm">
                    <p className="text-[10px] font-bold text-brand-fg/30 uppercase tracking-widest mb-4">Official Evidence Hash</p>
                    <p className="text-[10px] text-brand-fg/40 break-all font-mono leading-relaxed">{market.evidence_hash}</p>
                  </div>
                )}
              </div>
            )}

            {market.state === "closed" && (
              <div className="card space-y-8 bg-brand-yellow/5 border-brand-yellow/10">
                <div className="flex flex-col gap-2">
                  <h2 className="text-3xl font-bold text-brand-fg">Consult AI Oracle</h2>
                  <p className="text-brand-fg/50 font-medium leading-relaxed">
                    Participation is closed. The AI Oracle is ready to analyze the reality and conclude the discussion.
                  </p>
                </div>
                <button onClick={triggerOracle} disabled={triggering} className="bg-brand-fg text-brand-bg hover:bg-brand-accent hover:text-white font-bold py-6 rounded-[1.5rem] transition-all w-full text-xl shadow-xl shadow-brand-fg/10">
                  {triggering ? "Analyzing global feeds..." : "Invoke Consensus Oracle"}
                </button>
                {oracleLog && (
                  <div className="bg-brand-muted/50 rounded-[1.5rem] p-6 text-xs text-brand-fg font-mono overflow-auto max-h-48 shadow-inner italic">
                     {oracleLog}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transaction Metadata */}
          {txHash && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-8 rounded-[2rem] bg-brand-green/5 border border-brand-green/10 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex flex-col gap-1">
                <p className="text-brand-green font-bold text-xs uppercase tracking-widest">Transaction Confirmed</p>
                <p className="text-brand-fg/40 text-[10px] font-mono break-all line-clamp-1">{txHash}</p>
              </div>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-brand-green text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:shadow-lg hover:shadow-brand-green/20 transition-all font-sans"
              >
                View on Ledger
              </a>
            </motion.div>
          )}

          {error && (
            <div className="p-6 rounded-[1.5rem] bg-brand-red/5 border border-brand-red/10 text-brand-red text-center text-sm font-semibold">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
