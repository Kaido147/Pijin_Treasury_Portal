// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Stellar Wallet Adapter
//
// This module provides the abstract interface for connecting
// to Stellar wallets. Currently returns mock state for
// development on testnet.
//
// Production Integration Roadmap:
// ──────────────────────────────
// 1. Install:  npm install @stellar/stellar-sdk @stellar/freighter-api
// 2. Replace mockWalletAdapter with freighterAdapter (scaffolded below)
// 3. Add Soroban RPC client for smart contract interactions
// 4. Wire up real balance polling via Horizon server
// ═══════════════════════════════════════════════════════════

import { ADMIN_ADDRESS } from '@/core/constants';

// ─── Adapter Interface ──────────────────────────────────

export interface WalletAdapter {
  /** Connect to the wallet and return the public key + native XLM balance */
  connect: () => Promise<{ publicKey: string; balance: number }>;

  /** Disconnect from the wallet */
  disconnect: () => Promise<void>;

  /** Fetch the current XLM balance for a given public key */
  getBalance: (publicKey: string) => Promise<number>;
}

// ─── Mock Adapter (Development) ─────────────────────────

const MOCK_BALANCE = 24891.45;

/**
 * Mock wallet adapter for local development.
 * Simulates connection delays and returns static testnet data.
 */
export const mockWalletAdapter: WalletAdapter = {
  connect: async () => {
    // Simulate Freighter popup + network handshake
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      publicKey: ADMIN_ADDRESS,
      balance: MOCK_BALANCE,
    };
  },

  disconnect: async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  },

  getBalance: async (_publicKey: string) => {
    return MOCK_BALANCE;
  },
};

// ─── Freighter Adapter (Production — Scaffolded) ────────
//
// Uncomment and configure when ready for real wallet integration.
//
// import freighter from '@stellar/freighter-api';
// import { Horizon } from '@stellar/stellar-sdk';
//
// const HORIZON_URL = 'https://horizon-testnet.stellar.org';
//
// export const freighterAdapter: WalletAdapter = {
//   connect: async () => {
//     const publicKey = await freighter.getPublicKey();
//     const server = new Horizon.Server(HORIZON_URL);
//     const account = await server.loadAccount(publicKey);
//     const xlmBalance = account.balances.find(
//       (b) => b.asset_type === 'native',
//     );
//     return {
//       publicKey,
//       balance: parseFloat(xlmBalance?.balance ?? '0'),
//     };
//   },
//
//   disconnect: async () => {
//     // Freighter doesn't expose a disconnect API.
//     // Clear local app state only.
//   },
//
//   getBalance: async (publicKey) => {
//     const server = new Horizon.Server(HORIZON_URL);
//     const account = await server.loadAccount(publicKey);
//     const xlmBalance = account.balances.find(
//       (b) => b.asset_type === 'native',
//     );
//     return parseFloat(xlmBalance?.balance ?? '0');
//   },
// };
//
// ─── Soroban RPC (Future — Smart Contracts) ─────────────
//
// import { SorobanRpc } from '@stellar/stellar-sdk';
//
// const sorobanServer = new SorobanRpc.Server(
//   'https://soroban-testnet.stellar.org',
// );
//
// export async function invokeContract(
//   contractId: string,
//   method: string,
//   args: unknown[],
// ) {
//   // Build, simulate, sign with Freighter, and submit transaction
//   // See: https://soroban.stellar.org/docs/getting-started
// }
