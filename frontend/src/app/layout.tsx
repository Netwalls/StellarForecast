import type { Metadata } from "next";
import { Outfit, EB_Garamond } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-outfit" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "StellarForecast — Forecasts for Humans",
  description: "A decentralized marketplace to share forecasts on the future, powered by Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${ebGaramond.variable}`}>
      <body className="bg-brand-bg text-brand-fg min-h-screen antialiased selection:bg-brand-accent/20">
        {children}
      </body>
    </html>
  );
}
