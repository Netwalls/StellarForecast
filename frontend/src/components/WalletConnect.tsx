"use client";

import { useWallet } from "@/hooks/useWallet";

export default function WalletConnect() {
  const { publicKey, connecting, connect, disconnect } = useWallet();

  const short = (addr: string) =>
    `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  if (publicKey) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-brand-muted px-4 py-2 rounded-xl border border-brand-fg/5">
          <div className="w-1.5 h-1.5 bg-brand-green rounded-full shadow-sm" />
          <span className="text-xs font-bold tracking-widest text-brand-fg/60 uppercase">{short(publicKey)}</span>
        </div>
        <button onClick={disconnect} className="text-[10px] uppercase font-bold text-brand-red/60 hover:text-brand-red transition-all tracking-widest">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={connect} 
      disabled={connecting} 
      className="btn-primary"
    >
      <span className="relative z-10">{connecting ? "Connecting..." : "Connect Wallet"}</span>
    </button>
  );
}
