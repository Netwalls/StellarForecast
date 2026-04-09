"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Market } from "@/lib/types";
import { formatUSDC } from "@/lib/stellar";

interface Props {
  market: Market;
}

export default function MarketCard({ market }: Props) {
  const total = BigInt(market.yes_pool) + BigInt(market.no_pool);
  const yesPercent = total > 0n
    ? Math.round(Number((BigInt(market.yes_pool) * 100n) / total))
    : 50;
  const noPercent = 100 - yesPercent;

  const getTimeRemaining = (endTime: number) => {
    const total = endTime * 1000 - Date.now();
    if (total <= 0) return "Resolving...";

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    if (minutes > 0) return `${minutes}m ${seconds}s remaining`;
    return `${seconds}s remaining`;
  };

  // Add a simple hook for live timer updates
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(market.end_time));

  useEffect(() => {
    const timer = setInterval(() => {
        setTimeLeft(getTimeRemaining(market.end_time));
    }, 1000);
    return () => clearInterval(timer);
  }, [market.end_time]);

  const stateBadge = () => {
    if (market.state === "resolved") return <span className="badge-resolved">Closed</span>;
    if (market.state === "closed" || market.state === "resolving") return <span className="badge-closed">Verifying</span>;
    return <span className="badge-open">Open</span>;
  };

  const outcomeLabel = () => {
    if (market.outcome === 1) return <span className="text-brand-green font-bold text-xs uppercase tracking-widest">Yes</span>;
    if (market.outcome === 2) return <span className="text-brand-red font-bold text-xs uppercase tracking-widest">No</span>;
    return null;
  };

  return (
    <Link href={`/market/${market.id}`}>
      <div className="card cursor-pointer group flex flex-col h-full">
        <div className="flex items-start justify-between gap-4 mb-6">
          <p className="font-semibold text-xl text-brand-fg group-hover:text-brand-accent transition-colors leading-[1.35] font-serif">
            {market.question}
          </p>
        </div>

        <div className="mt-auto">
          {/* YES/NO bar */}
          <div className="flex h-3 rounded-full overflow-hidden mb-4 bg-brand-muted">
            <div
              className="bg-brand-green transition-all"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="bg-brand-red transition-all"
              style={{ width: `${noPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-6">
            <span className="text-brand-green">{yesPercent}% Yes</span>
            <span className="text-brand-red">{noPercent}% No</span>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-brand-fg/5">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-brand-fg/20 uppercase tracking-widest">Global Pool</span>
              <span className="text-sm font-bold text-brand-fg/60">{formatUSDC(total.toString())} USDC</span>
            </div>
            <div className="text-right">
              {market.state?.toLowerCase() === "resolved" ? (
                <div className="flex flex-col items-end gap-1">
                   <span className="text-[10px] font-bold text-brand-fg/20 uppercase tracking-widest">Result</span>
                   {outcomeLabel()}
                </div>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-bold text-brand-fg/20 uppercase tracking-widest">Status</span>
                  <span className="text-brand-fg/40 font-bold text-[10px] uppercase tracking-widest">
                    {market.state?.toLowerCase() === "closed" ? "Verifying..." : timeLeft}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
