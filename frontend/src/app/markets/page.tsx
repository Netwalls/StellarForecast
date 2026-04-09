"use client";

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, TrendingUp, Clock, CheckCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import MarketCard from "@/components/MarketCard";
import { Market } from "@/lib/types";
import { useSearchParams } from "next/navigation";

export default function MarketsPage() {
  return (
    <Suspense>
      <MarketsExplorer />
    </Suspense>
  );
}

function MarketsExplorer() {
  const searchParams = useSearchParams();
  const created = searchParams.get("created") === "true";
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [showToast, setShowToast] = useState(created);

  useEffect(() => {
    if (showToast) {
        const timer = setTimeout(() => setShowToast(false), 5000);
        return () => clearTimeout(timer);
    }
  }, [showToast]);

  useEffect(() => {
    fetch("/api/markets")
      .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || d.message || "Failed to fetch");
          return d;
      })
      .then((d) => setMarkets(d.markets || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const open = markets.filter((m) => m.state === "open");
  const resolving = markets.filter((m) => m.state === "closed");
  const resolved = markets.filter((m) => m.state === "resolved");
  
  const filteredMarkets = markets.filter((m) => {
    if (filter === "All") return true;
    if (filter === "Open") return m.state === "open";
    if (filter === "Resolving") return m.state === "closed" || m.state === "resolving";
    if (filter === "Resolved") return m.state === "resolved";
    return true;
  });

  return (
    <div className="min-h-screen pb-24">
      <Navbar />

      <main className="max-w-7xl mx-auto px-8 pt-16">
        <header className="mb-16 space-y-4">
          <h1 className="text-6xl font-bold font-serif text-brand-fg tracking-tight">Market Explorer</h1>
          <p className="text-xl text-brand-fg/50 font-medium">Browse the world's collective intelligence across all signals.</p>
        </header>

        {error && (
            <div className="mb-12 p-8 rounded-[2rem] bg-brand-red/5 border border-brand-red/10 text-brand-red text-center font-bold text-lg">
                Connection to Stellar network failed: {error}
            </div>
        )}

        <AnimatePresence>
          {showToast && (
            <motion.div 
               initial={{ opacity: 0, y: -20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="mb-12 p-8 rounded-[2rem] bg-brand-green/10 border border-brand-green/20 flex items-center justify-between shadow-2xl shadow-brand-green/5"
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-green flex items-center justify-center text-white shadow-lg shadow-brand-green/20">
                    <CheckCircle size={24} />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold text-brand-fg">Market Propagated Successfully</p>
                  <p className="text-brand-fg/40 font-medium font-sans">The conversation has been recorded on the Stellar ledger and is now active.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowToast(false)}
                className="text-brand-fg/20 hover:text-brand-fg transition-colors"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters and Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 border-b border-brand-fg/5 pb-8">
          <div className="flex items-center gap-2 bg-brand-muted/50 p-1.5 rounded-2xl border border-brand-fg/5">
            {["All", "Open", "Resolving", "Resolved"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === f 
                    ? "bg-brand-fg text-brand-bg shadow-lg shadow-brand-fg/10 border-transparent" 
                    : "text-brand-fg/40 hover:text-brand-fg hover:bg-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          
          <div className="relative group w-full md:w-80">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-brand-fg/20 group-hover:text-brand-fg transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Search markets..." 
              className="bg-brand-muted/30 border border-brand-fg/5 rounded-2xl pl-16 pr-6 py-4 w-full outline-none focus:ring-2 focus:ring-brand-accent/20 text-brand-fg transition-all placeholder:text-brand-fg/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-8">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-2xl font-bold text-brand-fg">Querying Blockchain...</p>
              <p className="text-brand-fg/40 font-medium italic">Our Oracle is retrieving market signals from the Stellar network</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div 
               layout
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
            >
              {filteredMarkets.length > 0 ? (
                filteredMarkets.map((m) => (
                  <motion.div 
                    layout
                    key={m.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MarketCard market={m} />
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-40 rounded-[3rem] bg-brand-muted/20 border-2 border-dashed border-brand-fg/5 flex flex-col items-center gap-6">
                  <div className="w-16 h-16 rounded-full bg-brand-muted flex items-center justify-center text-brand-fg/20">
                     <TrendingUp size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-brand-fg">No signals found</p>
                    <p className="text-brand-fg/40 font-medium">Try adjusting your filters or create a new market.</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
