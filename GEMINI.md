# Pijin Treasury Portal - AI Assistant Guide (GEMINI.md)

Welcome, Gemini. This document provides core context, architectural guidelines, and rules for assisting with the **Pijin Treasury Portal** codebase. Always reference this guide when writing code, debugging, or planning features for this project.

## 1. Project Overview
**Pijin** is a zero-data cellular transport layer for decentralized finance (DeFi), enabling users to send P2P payments via SMS. 
The **Treasury Portal** is the back-office command center for network administrators. It does not communicate directly with the offline mobile app, but instead monitors the Stellar blockchain (via RPC/Horizon) and queries telemetry from the Vercel Relayer API backend.

**Core Objectives:**
- Liquidity Compliance & Monitoring (PHPC stablecoin)
- Treasury Balancing (monitoring `ADMIN_ADDRESS` and XLM gas pools)
- Gateway Oversight (Android Textbee devices routing SMS payloads to blockchain)

## 2. Tech Stack
- **Framework:** Next.js (App Router) with React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS (v4), `class-variance-authority`, `clsx`, `tailwind-merge`
- **UI Components:** Radix UI primitives, `lucide-react` for icons, `recharts` for charts, `framer-motion` for animations
- **Blockchain/Crypto:** `@stellar/stellar-sdk`, `@creit-tech/stellar-wallets-kit`, Freighter Wallet API
- **Backend/Database:** Supabase (`@supabase/supabase-js`, `@supabase/ssr`)

## 3. Architecture & Directory Structure
The project enforces separation of concerns to ensure UI components remain decoupled from live RPC data:
- `src/app/`: Next.js App Router pages (e.g., `/(dashboard)/command-center`, `/fund-node`, `/gateway-ops`, `/ledger`).
- `src/components/`: Reusable React components (likely using a UI library like shadcn/ui based on the dependencies).
- `src/hooks/`: Custom React hooks for data fetching, blockchain interactions, and state management.
- `src/infrastructure/`: API clients, blockchain RPC connections, and external service adapters.
- `src/core/`: Application constants (e.g., `XLM_TO_PHP_RATE`, `LEDGER_POLL_INTERVAL_MS`), types, and global configurations.
- `src/lib/`: Utility functions (e.g., Supabase client initialization).

## 4. Coding Guidelines & AI Instructions

### 4.1. UI & Styling
- **Use Tailwind:** Strictly use Tailwind CSS for styling. Do not write custom CSS unless absolutely necessary (e.g., complex animations not supported by Tailwind).
- **Component Primitives:** Leverage Radix UI components for accessible, unstyled primitives. Use `class-variance-authority` (cva) for building variant-driven UI components.
- **Visuals:** Maintain a "premium" dashboard aesthetic. Avoid generic styling; utilize the configured Tailwind design system.

### 4.2. Data & State Management
- **Abstractions:** UI components should NOT directly call Stellar SDK or standard `fetch` APIs. They must use custom hooks from `src/hooks/` which internally call `src/infrastructure/` services.
- **Mocking:** When implementing new UI features, it should be easy to swap live RPC endpoints with mock data generators within the hooks/infrastructure layer without touching the React components.

### 4.3. Blockchain Interactions (Stellar/Soroban)
- **Environment:** Default to **Stellar Testnet** for all development and testing to prevent accidental mainnet transactions. Ensure `freighterAdapter` or WalletKit checks for the correct network.
- **Transaction Lifecycle (Soroban):** Implement the multi-phase client-side lifecycle for smart contract interactions: (1) fetch unsigned XDR from the API, (2) sign via Freighter, (3) broadcast directly to Soroban RPC from the client, (4) poll for on-chain confirmation, and (5) patch the backend to sync the oracle DB.
- **Error Handling:** Blockchain transactions (e.g., funding an agent node) can fail due to network congestion, resource exhaustion, or state collisions. Always implement robust error handling (classifying RPC errors vs contract errors) and display clear feedback to the user via toast notifications (`sonner`).
- **Data Polling/Streaming:** For real-time features like the ledger or gateway health, use appropriate polling intervals defined in constants or Server-Sent Events (SSE) via Horizon streams.

### 4.4. Security & Authentication
- **Two-Gate Authentication System:** Authentication enforces a dual-gate approach:
  - **Gate 1 (Identity):** Supabase session verification using `@supabase/ssr`.
  - **Gate 2 (Cryptographic Authority):** Freighter Wallet signature challenge (signing a DB-generated nonce) that issues a secure HTTP-only JWT using `jose`.
- **API Keys:** Never hardcode sensitive keys or wallet seeds. Use environment variables (`.env`).
- **Supabase:** When interacting with Supabase, ensure RLS (Row Level Security) policies and SSR authentication patterns are respected using `@supabase/ssr`. Use `createServiceClient()` for admin/bypass-RLS operations where appropriate on the server.

---
*Note: Before making significant architectural changes, always read the `ARCHITECTURE.md` file in the project root for deeper systemic context.*
