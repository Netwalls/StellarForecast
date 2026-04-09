"use client";

import { useState, useCallback, useEffect } from "react";
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";

let kit: StellarWalletsKit | null = null;

function getKit() {
  if (typeof window === "undefined") return null;
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

export function useWallet() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("wallet_pubkey");
    if (stored) setPublicKey(stored);
  }, []);

  const connect = useCallback(async () => {
    const k = getKit();
    if (!k) return;
    setConnecting(true);
    try {
      await k.openModal({
        onWalletSelected: async (option) => {
          k.setWallet(option.id);
          const { address } = await k.getAddress();
          setPublicKey(address);
          sessionStorage.setItem("wallet_pubkey", address);
        },
      });
    } catch (e) {
      console.error("Wallet connect error", e);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    sessionStorage.removeItem("wallet_pubkey");
    kit = null;
  }, []);

  const signAndSubmit = useCallback(
    async (xdr: string): Promise<string> => {
      const k = getKit();
      if (!k || !publicKey) throw new Error("Wallet not connected");

      const { signedTxXdr } = await k.signTransaction(xdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
        address: publicKey,
      });

      const res = await fetch("/api/submit-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xdr: signedTxXdr }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transaction failed");
      return data.hash;
    },
    [publicKey]
  );

  return { publicKey, connecting, connect, disconnect, signAndSubmit };
}
