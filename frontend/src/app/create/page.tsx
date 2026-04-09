"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { buildContractTx, addressToScVal, stringToScVal, u64ToScVal } from "@/lib/stellar";
import Navbar from "@/components/Navbar";

export default function CreateMarket() {
  const router = useRouter();
  const { publicKey, signAndSubmit } = useWallet();
  const [question, setQuestion] = useState("");
  const [endTime, setEndTime] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>("Crypto");

  const categorizedSuggestions: Record<string, string[]> = {
    Crypto: [
      "Will Stellar XLM reach $1.00 by 2026?",
      "Will BTC hit $100k by end of year?",
      "Will ETH 2.0 staking rewards exceed 5% next month?",
      "Will Solana have zero downtime for 3 consecutive months?",
      "Will a new Layer 2 reach $10B TVL by June?"
    ],
    Sports: [
      "Will Manchester City win the Premier League?",
      "Will the Lakers make the NBA playoffs?",
      "Will Kylian Mbappé win the Ballon d'Or in 2026?",
      "Will a non-European team win the next World Cup?",
      "Will the Olympics 2024 record be broken in 100m sprint?"
    ],
    Politics: [
      "Will the current US administration pass the new tax bill?",
      "Will the UK re-join the Single Market by 2030?",
      "Will a third-party candidate win a major state election?",
      "Will the EU expand to include a new member state this year?",
      "Will the next G7 summit produce a major climate accord?"
    ],
    Tech: [
      "Will the next SpaceX Starship launch reach orbit?",
      "Will Apple release a foldable iPhone by 2025?",
      "Will AI search use exceed traditional search by 2027?",
      "Will a humanoid robot be commercially available for homes by 2028?",
      "Will the first commercial nuclear fusion plant start construction?"
    ]
  };

  const setQuickTime = (minutes: number) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + minutes);
    const localISO = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEndTime(localISO);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    setCreating(true);
    setError("");

    try {
      const endTimestamp = Math.floor(new Date(endTime).getTime() / 1000);
      
      const txXdr = await buildContractTx(publicKey, "create_market", [
        addressToScVal(publicKey),
        stringToScVal(question),
        u64ToScVal(endTimestamp),
      ]);

      const hash = await signAndSubmit(txXdr);
      console.log("Market created:", hash);
      router.push("/markets?created=true");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create market");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <Navbar />
      <main className="max-w-2xl mx-auto px-8 py-20">
        <header className="mb-16 space-y-4">
          <h1 className="text-5xl font-serif font-bold text-brand-fg">Create a Forecast</h1>
          <p className="text-brand-fg/40 font-medium">Define the future. Stake your reputation on the outcome.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Question */}
          <div className="space-y-6">
            <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-widest text-brand-fg/30 ml-2">Forecast Question</label>
                <textarea 
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Exposing a truth about the future..."
                className="w-full bg-brand-muted border border-brand-fg/5 rounded-3xl p-8 text-2xl font-bold text-brand-fg placeholder:text-brand-fg/10 focus:outline-none focus:border-brand-accent transition-all h-40 resize-none"
                required
                />
            </div>
            
            <div className="space-y-6">
                <div className="flex gap-4 border-b border-brand-fg/5 pb-2 overflow-x-auto pb-4 scrollbar-hide">
                    {Object.keys(categorizedSuggestions).map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveCategory(cat)}
                            className={`whitespace-nowrap pb-2 text-xs font-bold uppercase tracking-widest transition-all ${activeCategory === cat ? 'text-brand-accent border-b-2 border-brand-accent' : 'text-brand-fg/30 hover:text-brand-fg'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3">
                    {activeCategory && categorizedSuggestions[activeCategory].map((q) => (
                        <button 
                            key={q} 
                            type="button" 
                            onClick={() => setQuestion(q)}
                            className="px-4 py-2 rounded-full bg-brand-fg/5 text-brand-fg/50 text-xs font-bold hover:bg-brand-accent hover:text-white transition-all border border-brand-fg/5 text-left"
                        >
                            {q}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          {/* Time */}
          <div className="space-y-4">
            <label className="text-xs font-bold uppercase tracking-widest text-brand-fg/30 ml-2">Market Resolution Time</label>
            <div className="space-y-4">
                <input 
                  type="datetime-local" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-brand-muted border border-brand-fg/5 rounded-2xl p-6 text-2xl font-bold text-brand-fg focus:outline-none focus:border-brand-accent transition-all"
                  required
                />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setQuickTime(5)} className="flex-1 py-3 px-4 rounded-xl bg-brand-fg/5 text-brand-fg/60 text-xs font-bold uppercase transition-all hover:bg-brand-accent hover:text-white">5 Mins (Test)</button>
                  <button type="button" onClick={() => setQuickTime(60)} className="flex-1 py-3 px-4 rounded-xl bg-brand-fg/5 text-brand-fg/60 text-xs font-bold uppercase transition-all hover:bg-brand-accent hover:text-white">1 Hour</button>
                  <button type="button" onClick={() => setQuickTime(1440)} className="flex-1 py-3 px-4 rounded-xl bg-brand-fg/5 text-brand-fg/60 text-xs font-bold uppercase transition-all hover:bg-brand-accent hover:text-white">1 Day</button>
                </div>
            </div>
          </div>

          {error && (
            <div className="p-6 rounded-2xl bg-brand-red/5 border border-brand-red/10 text-brand-red text-center font-bold">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={creating || !publicKey}
            className="w-full btn-primary py-8 text-xl"
          >
            {creating ? "Broadcasting to Stellar..." : "Launch Forecast"}
          </button>
        </form>
      </main>
    </div>
  );
}
