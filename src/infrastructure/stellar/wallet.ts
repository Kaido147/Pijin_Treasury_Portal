// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Stellar Wallet Adapter
//
// Provides the abstract WalletAdapter interface and two
// concrete implementations:
//   • mockWalletAdapter  — static dev data, no extension needed
//   • freighterAdapter   — live Freighter browser extension + Horizon
// ═══════════════════════════════════════════════════════════

import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit/sdk";
import { SwkAppLightTheme } from "@creit-tech/stellar-wallets-kit/types";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";

import { Horizon, Networks } from '@stellar/stellar-sdk';
import { ADMIN_ADDRESS } from '@/core/constants';


// ─── Constants ──────────────────────────────────────────

const HORIZON_URL = process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;

if (typeof window !== 'undefined') {
  StellarWalletsKit.init({
    theme: SwkAppLightTheme,
    modules: defaultModules(),
  });
}

// ─── Adapter Interface ──────────────────────────────────

export interface WalletAdapter {
  /** Connect to the wallet and return the public key + native XLM balance */
  connect: () => Promise<{ publicKey: string; balance: number }>;

  /** Disconnect from the wallet */
  disconnect: () => Promise<void>;

  /** Fetch the current XLM balance for a given public key */
  getBalance: (publicKey: string) => Promise<number>;

  /** Sign a raw message/nonce for authentication */
  signMessage: (message: string) => Promise<string>;

  /** Sign a Soroban transaction XDR; returns signed base64 XDR string */
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string }
  ) => Promise<string>;
}

// ─── Horizon Helper ─────────────────────────────────────

async function fetchXlmBalance(publicKey: string): Promise<number> {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(publicKey);
  const native = account.balances.find((b) => b.asset_type === 'native');
  return parseFloat(native?.balance ?? '0');
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

  signMessage: async (message: string) => {
    return "mock-signature";
  },

  signTransaction: async (xdr: string) => {
    // Dev mock: return the unsigned XDR unchanged (no real signing needed)
    return xdr;
  },
};

// ─── Freighter Adapter (Production) ─────────────────────

/**
 * Live Freighter wallet adapter.
 *
 * Network validation (testnet gate) is enforced by the
 * useStellarWallet hook before connect() is called.
 * This adapter stays network-agnostic and testable in isolation.
 */
export const stellarKitAdapter: WalletAdapter = {
  connect: async () => {

    const { address } = await StellarWalletsKit.authModal();

    const balance = await fetchXlmBalance(address)

    return { publicKey: address, balance };
  },

  disconnect: async () => {
    // Freighter exposes no disconnect API.
    // Hook clears local state; nothing to do here.
  },

  getBalance: async (publicKey: string) => {
    return fetchXlmBalance(publicKey);
  },

  signMessage: async (message: string) => {
    try {
      const { signedMessage } = await StellarWalletsKit.signMessage(message, {
        networkPassphrase: NETWORK_PASSPHRASE
      });
      return signedMessage;
    } catch (e) {
      console.warn("signMessage not supported or failed, using dummy signature");
      return "dummy-signature";
    }
  },

  signTransaction: async (
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string }
  ) => {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase ?? NETWORK_PASSPHRASE,
      address: opts?.address,
    });
    return signedTxXdr;
  },
};

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
