# 🇵🇭 Pijin Treasury Portal

> **Secure Back-Office Administrative Dashboard & Liquidity Management for the Pijin Zero-Data Payment Ecosystem.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2.9-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Horizon%20%26%20RPC-141414?style=for-the-badge&logo=stellar)](https://stellar.org/)
[![Soroban](https://img.shields.io/badge/Soroban-Smart%20Contracts-7B1FA2?style=for-the-badge)](https://soroban.stellar.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-38BDF8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20SSR-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

---

## 📌 Project Overview

**Pijin** is a zero-data cellular transport layer for decentralized finance (DeFi). It empowers unbanked and offline communities in infrastructure-limited regions (such as remote municipal islands in the Philippines) to send secure, peer-to-peer (P2P) payments over standard GSM cellular networks (SMS), bypassing expensive mobile data (4G/5G/WiFi).

The **Pijin Treasury Portal** serves as the central command center for network administrators. Built parallel to the offline mobile app and relay infrastructure, it provides real-time visibility, smart contract administration, gateway node orchestration, and liquidity management across the Stellar Network.

---

## ✨ Key Dashboard Features

| Route | Feature | Description |
| :--- | :--- | :--- |
| `/command-center` | **Command Center** | High-level operations hub. Integrates with **Freighter Wallet**, displays XLM & PHPC balances (converted to PHP rates), network throughput, and RPC response metrics. |
| `/gateway-ops` | **Gateway Operations** | Manage whitelisted Android SMS gateway nodes. Register new gateway public keys, monitor live telemetry (`active`, `syncing`, `offline`), and inspect device uptimes. |
| `/ledger` | **Transaction Ledger** | Live-streaming audit ledger of Soroban smart contract transactions. Filters by state (`Confirmed`, `Pending`, `Failed`) with memory cap management. |
| `/fund-node` | **Agent Liquidity** | Settle native XLM and stablecoin reserves to authorized local agent nodes using connected administrator wallets. |
| `/login` | **Authentication** | Secure administrator access gate backed by Supabase Auth and Next.js middleware session enforcement. |

---

## 🛠️ Tech Stack & Key Libraries

* **Framework:** [Next.js 16](https://nextjs.org/) (App Router), [React 18](https://react.dev/), [TypeScript 5.8](https://www.typescriptlang.org/)
* **Styling & UI:** [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI Primitives](https://www.radix-ui.com/), [Lucide Icons](https://lucide.dev/), [Motion](https://motion.dev/), [Sonner](https://sonner.emilkowal.ski/)
* **Blockchain Integrations:**
  * [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) (Horizon & Soroban RPC)
  * [`@creit-tech/stellar-wallets-kit`](https://github.com/Creit-Tech/stellar-wallets-kit)
  * Freighter Wallet Browser Extension Integration
* **Backend & Auth:** [Supabase](https://supabase.com/) (`@supabase/ssr`, `@supabase/supabase-js`), Next.js Edge Middleware
* **Smart Contracts:** Soroban Rust SDK (`soroban-sdk` 22.0.0) located in `./contracts`

---

## 📁 Repository Structure

```text
Pijin_treasury_portal/
├── contracts/                  # Soroban Rust Smart Contract (spend_offline)
│   ├── src/                    # Contract entry points & test suites
│   ├── Cargo.toml              # Rust crate dependencies (soroban-sdk v22.0.0)
│   └── Makefile                # Soroban build & deployment tasks
├── public/                     # Static assets & illustrations
├── src/
│   ├── app/                    # Next.js App Router routes & layouts
│   │   ├── (auth)/             # Authentication views (/login)
│   │   ├── (dashboard)/        # Administrative dashboard routes
│   │   │   ├── command-center/ # Operational dashboard & metrics
│   │   │   ├── gateway-ops/    # Gateway whitelisting & node monitoring
│   │   │   ├── ledger/         # Live transaction stream & audit logs
│   │   │   └── DashboardShell.tsx
│   │   ├── api/                # Internal API route handlers
│   │   ├── globals.css         # Tailwind v4 theme setup & design tokens
│   │   └── layout.tsx          # Root layout with font configurations
│   ├── components/
│   │   ├── domain/             # Feature-specific components (TransferForm, GatewayCard, etc.)
│   │   ├── layout/             # Navigation bars, sidebars, header shells
│   │   └── ui/                 # Reusable Radix-based UI primitives (button, dialog, etc.)
│   ├── core/                   # Shared types, constants, utilities, and validation schemas
│   ├── hooks/                  # Custom React hooks (useStellarWallet, useGatewayNodes, etc.)
│   ├── infrastructure/         # Low-level RPC clients, Stellar SDK helpers, & Supabase client
│   └── middleware.ts           # Next.js route protection middleware
├── ARCHITECTURE.md             # In-depth architectural breakdown & developer onboarding guide
├── next.config.ts              # Next.js configuration settings
├── package.json                # Project dependencies & npm scripts
├── tsconfig.json               # TypeScript configuration
└── README.md                   # Project documentation (this file)
```

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher
* **Freighter Wallet**: Install the [Freighter Browser Extension](https://www.freighter.app/) and set the network to **Stellar Testnet**.
* *(Optional)* **Rust & Soroban CLI**: Required only if compiling or testing smart contracts in `contracts/`.

---

### Environment Setup

Create a `.env.local` file in the root directory:

```env
# ─── Stellar & Soroban Network Config ───
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# ─── Soroban Smart Contract ───
NEXT_PUBLIC_SPEND_OFFLINE_CONTRACT_ID=CD...

# ─── Stablecoin Asset (PHPC) ───
NEXT_PUBLIC_PHPC_ASSET_CODE=PHPC
NEXT_PUBLIC_PHPC_ISSUER_ADDRESS=GA...

# ─── Treasury Admin Address ───
NEXT_PUBLIC_TREASURY_ADDRESS=GBRMB7MFPND5JLXDTUKJBWWKUVCLMKNM3MJ2QGJCYZLBM6OBG6HRWKN

# ─── Relayer Backend ───
NEXT_PUBLIC_VERCEL_RELAYER_URL=https://pijin-relayer.vercel.app
VERCEL_RELAYER_HMAC_SECRET=your_sha256_hmac_secret_key

# ─── Supabase Authentication ───
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

### Installation & Execution

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Local Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Production Build Verification:**
   ```bash
   npm run build
   ```

4. **Linting:**
   ```bash
   npm run lint
   ```

---

## 📜 Soroban Smart Contracts (`contracts/`)

The Soroban smart contract logic powering Pijin's offline payment settlement is located in `contracts/`.

### Key Contract Features
* **Ed25519 On-Chain Signature Verification:** Validates user transaction signatures directly inside Soroban.
* **Nonce Tracking:** Prevents replay attacks by checking timestamp sequence bounds.
* **Automatic Toll Split:** Splits the transaction into `Amount - Toll` to receiver, and routes flat `₱0.50` to `NEXT_PUBLIC_TREASURY_ADDRESS`.
* **Gateway Registry:** Maintains on-chain whitelist of authorized gateway public keys.

### Building & Testing Contracts
```bash
cd contracts

# Run unit & integration tests
cargo test

# Compile optimized WebAssembly binary
cargo build --target wasm32-unknown-unknown --release
```

---

## 🔒 Security & Best Practices

1. **Authentication:** All administrative dashboard routes (`/command-center`, `/gateway-ops`, `/ledger`, `/fund-node`) are guarded by `src/middleware.ts` using Supabase Auth sessions.



© 2026 Pijin Network. Built for decentralized, zero-data financial inclusion.
