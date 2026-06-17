"use client";

import { useRouter } from "next/navigation";
import { Wallet, Shield, Zap, Globe } from "lucide-react";
import { useStellarWallet } from "@/hooks/useStellarWallet";

const FEATURES = [
  { icon: Shield, label: "Secure" },
  { icon: Zap, label: "Real-time" },
  { icon: Globe, label: "Testnet" },
] as const;

export default function AuthLandingPage() {
  const router = useRouter();
  const { connect, isConnecting } = useStellarWallet();

  const handleConnect = () => {
    connect();
    setTimeout(() => router.push("/command-center"), 1400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-raised to-[#dbeafe] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-navy-900">
            <span className="text-white font-extrabold text-base">P</span>
          </div>
          <span className="text-navy-900 font-bold text-base">Pijin Network</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-border-default shadow-sm">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-slate-500 text-xs font-semibold">Stellar Testnet</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-3xl overflow-hidden shadow-landing">
            {/* Navy banner */}
            <div className="px-10 pt-10 pb-8 relative overflow-hidden bg-gradient-to-br from-navy-900 to-navy-700">
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-[radial-gradient(circle,#93c5fd,transparent)]" />
              <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-10 bg-[radial-gradient(circle,#60a5fa,transparent)]" />

              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-white/[0.12] backdrop-blur-sm">
                  <span className="text-white font-extrabold text-[1.75rem]">P</span>
                </div>
                <h1 className="text-white font-extrabold text-[1.875rem] leading-tight mb-2">
                  Pijin Treasury Portal
                </h1>
                <p className="text-white/60 text-[0.9rem]">
                  Universal Web3 Liquidity · Admin Interface
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="px-10 py-8 space-y-6">
              <p className="text-slate-500 text-[0.95rem] leading-relaxed">
                Connect your Freighter wallet to access the network administration
                console and manage agent node funding operations.
              </p>

              {/* Features row */}
              <div className="grid grid-cols-3 gap-3">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-surface"
                  >
                    <Icon className="w-4 h-4 text-navy-700" />
                    <span className="text-slate-500 text-xs font-semibold">{label}</span>
                  </div>
                ))}
              </div>

              {/* Connect button */}
              <button
                id="connect-wallet-btn"
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-navy-900 text-white font-bold text-base shadow-btn-lg transition-colors duration-200 hover:bg-navy-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Connecting to Freighter…
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    Connect Admin Wallet
                  </>
                )}
              </button>

              {/* Status row */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-400 text-xs">Network Online</span>
                </div>
                <div className="w-px h-3 bg-border-default" />
                <span className="text-slate-400 text-xs">Freighter v2.4.1</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-5 text-center text-slate-400 text-xs">
        Secured by Stellar blockchain · Pijin Network © 2026
      </footer>
    </div>
  );
}
