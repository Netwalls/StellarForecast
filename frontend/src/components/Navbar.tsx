"use client";

import Link from "next/link";
import { TrendingUp, Plus, LayoutGrid } from "lucide-react";
import WalletConnect from "./WalletConnect";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-brand-bg/80 backdrop-blur-md border-b border-brand-fg/5 px-8 py-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-4 group">
          <div className="w-10 h-10 bg-brand-fg rounded-xl flex items-center justify-center shadow-xl shadow-brand-fg/10 group-hover:bg-brand-accent transition-all duration-300">
            <TrendingUp size={20} className="text-brand-bg" />
          </div>
          <span className="text-xl font-bold tracking-tight font-serif text-brand-fg">
            Stellar<span className="text-brand-accent">Forecast</span>
          </span>
        </Link>
      </div>
      
      <div className="flex items-center gap-8">
        <Link 
          href="/markets" 
          className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
            pathname === "/markets" ? "text-brand-accent" : "text-brand-fg/60 hover:text-brand-fg"
          }`}
        >
          <LayoutGrid size={16} />
          Explore Markets
        </Link>
        <Link 
          href="/create" 
          className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
            pathname === "/create" ? "text-brand-accent" : "text-brand-fg/60 hover:text-brand-fg"
          }`}
        >
          <Plus size={16} />
          Create
        </Link>
        <div className="h-4 w-[1px] bg-brand-fg/10" />
        <WalletConnect />
      </div>
    </nav>
  );
}
