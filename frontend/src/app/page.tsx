"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Clock, CheckCircle, Plus } from "lucide-react";
import WalletConnect from "@/components/WalletConnect";
import MarketCard from "@/components/MarketCard";
import Navbar from "@/components/Navbar";
import { Market } from "@/lib/types";

export default function Home() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => setMarkets(d.markets || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const open = markets.filter((m) => m.state === "open");
  const resolving = markets.filter((m) => m.state === "closed");
  const resolved = markets.filter((m) => m.state === "resolved");

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-8 py-24 max-w-6xl mx-auto text-center"
      >
        <div className="max-w-4xl mx-auto mb-20">
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-block px-4 py-1.5 rounded-full bg-brand-accent/5 text-brand-accent text-xs font-bold tracking-widest uppercase mb-8 border border-brand-accent/10"
          >
            Insights into the Unknown
          </motion.span>
          <h1 className="text-7xl md:text-8xl font-bold mb-8 leading-[1.05] text-brand-fg tracking-tight">
            Share your voice on <br />
            <span className="italic font-serif text-brand-accent">the future.</span>
          </h1>
          <p className="text-xl md:text-2xl text-brand-fg/50 font-medium leading-[1.6] max-w-2xl mx-auto">
            A trusted marketplace for collective intelligence. Join the conversation 
            on tomorrow, today.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6">
            <Link href="/create" className="btn-primary">
              Start a Conversation
            </Link>
            <Link href="/markets" className="px-10 py-5 rounded-[1.5rem] bg-brand-fg/5 text-brand-fg hover:bg-brand-fg/10 transition-all font-bold text-lg border border-brand-fg/5">
              Explore Markets
            </Link>
          </div>
        </div>

        {/* Categories / Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {[
            { label: "Active Conversations", value: open.length, icon: TrendingUp, color: "text-brand-green" },
            { label: "In Deliberation", value: resolving.length, icon: Clock, color: "text-brand-yellow" },
            { label: "Resolved Truths", value: resolved.length, icon: CheckCircle, color: "text-brand-accent" },
          ].map((s, idx) => (
            <motion.div 
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex flex-col items-center gap-4 p-8 rounded-[2.5rem] bg-brand-muted/50 border border-brand-fg/5"
            >
              <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm ${s.color}`}>
                <s.icon size={24} />
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-brand-fg">{s.value}</p>
                <p className="text-sm font-semibold text-brand-fg/40 uppercase tracking-widest mt-2">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mb-16 opacity-30 text-xs font-bold uppercase tracking-widest">
          {markets.length} total signals identified
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="w-10 h-10 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-brand-fg/40 font-medium tracking-tight">Connecting to the world...</p>
          </div>
        ) : (
          <div className="space-y-32 text-left">
            {/* Market Sections */}
            <AnimatePresence mode="popLayout">
              {open.length > 0 && (
                <motion.section layout className="space-y-10">
                  <div className="flex items-end justify-between border-b border-brand-fg/5 pb-6">
                    <h2 className="text-4xl font-bold text-brand-fg">Open for Participation</h2>
                    <p className="text-brand-fg/40 text-sm font-medium">Join {open.length} active predictions</p>
                  </div>
                  <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
                    {open.map((m) => (
                      <motion.div key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <MarketCard market={m} />
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Other sections follow same pattern with improved spacing and typography */}
              {resolving.length > 0 && (
                <motion.section layout className="space-y-10">
                  <div className="flex items-end justify-between border-b border-brand-fg/5 pb-6">
                    <h2 className="text-4xl font-bold text-brand-fg">Verifying Reality</h2>
                    <p className="text-brand-fg/40 text-sm font-medium">Results pending consensus</p>
                  </div>
                  <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 opacity-60 grayscale-[0.5]">
                    {resolving.map((m) => (
                      <motion.div key={m.id} layout>
                        <MarketCard market={m} />
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}

              {resolved.length > 0 && (
                <motion.section layout className="space-y-10">
                  <div className="flex items-end justify-between border-b border-brand-fg/5 pb-6">
                    <h2 className="text-4xl font-bold text-brand-fg">The Archives</h2>
                    <p className="text-brand-fg/40 text-sm font-medium">Historical outcomes</p>
                  </div>
                  <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 opacity-80">
                    {resolved.map((m) => (
                      <motion.div key={m.id} layout>
                        <MarketCard market={m} />
                        </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {markets.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-40 rounded-[3rem] bg-brand-muted/30 border-2 border-dashed border-brand-fg/5"
              >
                <div className="max-w-md mx-auto">
                  <p className="text-brand-fg/30 text-xl mb-10 font-medium">The world is currently quiet. Why not start a conversation?</p>
                  <Link href="/create" className="btn-primary">
                    Create the First Market
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>

      {/* Footer */}
      <footer className="mt-40 border-t border-brand-fg/5 py-20 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-fg rounded-lg flex items-center justify-center">
              <TrendingUp size={16} className="text-brand-bg" />
            </div>
            <span className="font-bold tracking-tight font-serif text-brand-fg">StellarForecast</span>
          </div>
          <div className="flex gap-10 text-sm font-semibold text-brand-fg/40">
            <a href="#" className="hover:text-brand-fg transition-colors">Testnet Network</a>
            <a href="#" className="hover:text-brand-fg transition-colors">Documentation</a>
            <a href="#" className="hover:text-brand-fg transition-colors">Community</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
