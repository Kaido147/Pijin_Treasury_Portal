// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Contract Event XDR Decoder
//
// SERVER-ONLY module — never import this from client code.
//
// Decodes raw Stellar RPC EventResponse objects (returned by
// rpc.Server.getEvents) into our typed NetworkActivity domain
// model. Mirrors the 5 event structs defined in contracts/src/lib.rs.
//
// scValToNative() return types:
//   Address   → Address object  (.toString() → G.../C... strkey)
//   i128      → BigInt          (.toString() → decimal string)
//   Symbol    → string
//   BytesN<N> → Buffer | Uint8Array (runtime-dependent)
//
// All field accesses use safe helpers that handle null/undefined
// and both Buffer and Uint8Array variants gracefully.
// ═══════════════════════════════════════════════════════════

import { scValToNative } from '@stellar/stellar-sdk';
import type { rpc as RpcNS } from '@stellar/stellar-sdk';
import type {
  NetworkActivity,
  SpendActivity,
  DepositActivity,
  WithdrawActivity,
  RecipientActivity,
} from '@/core/types';

// ─── Topic symbol constants ──────────────────────────────
// These must exactly match the symbol_short!() values in lib.rs

const TOPIC_DEPOSIT   = 'deposit';
const TOPIC_SPEND     = 'spend';
const TOPIC_WITHDRAW  = 'withdraw';
const TOPIC_RECIPIENT = 'recipient';
const TOPIC_RECIPUPD  = 'recipupd';

// ─── Safe value helpers ──────────────────────────────────
// These make decoding robust against undefined fields and
// different Buffer/Uint8Array representations.

/**
 * Safely converts an Address or any object with .toString() to a string.
 * Returns 'Unknown' if null/undefined.
 */
function safeAddress(val: unknown): string {
  if (val == null) return 'Unknown';
  if (typeof (val as { toString?: () => string }).toString === 'function') {
    return (val as { toString(): string }).toString();
  }
  return String(val);
}

/**
 * Safely converts a BigInt to its decimal string representation.
 * Returns '0' if null/undefined.
 */
function safeBigInt(val: unknown): string {
  if (val == null) return '0';
  return String(val);
}

/**
 * Safely converts a Buffer or Uint8Array to a hex string.
 * Returns '' if null/undefined.
 */
function safeHex(val: unknown): string {
  if (val == null) return '';
  if (Buffer.isBuffer(val)) return val.toString('hex');
  if (val instanceof Uint8Array) return Buffer.from(val).toString('hex');
  return String(val);
}

/**
 * Converts a 6-byte BytesN<6> (Buffer or Uint8Array) to its ASCII string.
 *
 * The contract stores short IDs as raw ASCII bytes via validate_short_id(),
 * so each byte is a valid ASCII alphanumeric character (Base62).
 * Returns '??????' if the value is null/undefined or not byte-like.
 */
function decodeShortId(val: unknown): string {
  if (val == null) return '??????';
  if (Buffer.isBuffer(val)) return val.toString('ascii');
  if (val instanceof Uint8Array) return Buffer.from(val).toString('ascii');
  // Some SDK versions may return a plain number array
  if (Array.isArray(val)) {
    return Buffer.from(val as number[]).toString('ascii');
  }
  return String(val);
}

// ─── Public API ──────────────────────────────────────────

/**
 * Decodes a raw Stellar RPC EventResponse into a typed NetworkActivity.
 *
 * Returns null if:
 *  - The event has no topics
 *  - The topic[0] symbol is not one of the 5 known contract symbols
 *  - Any decoding error occurs (logged; event is skipped gracefully)
 */
export function decodeContractEvent(
  event: RpcNS.Api.EventResponse,
): NetworkActivity | null {
  try {
    if (!event.topic || event.topic.length === 0) return null;

    // topic[0] is a Symbol ScVal — scValToNative converts it to a string
    const symbol = scValToNative(event.topic[0]) as string;

    switch (symbol) {
      case TOPIC_DEPOSIT:
        return decodeDepositEvent(event);
      case TOPIC_SPEND:
        return decodeSpendEvent(event);
      case TOPIC_WITHDRAW:
        return decodeWithdrawEvent(event);
      case TOPIC_RECIPIENT:
        return decodeRecipientEvent(event, false);
      case TOPIC_RECIPUPD:
        return decodeRecipientEvent(event, true);
      default:
        return null;
    }
  } catch (err) {
    console.error('[event-decoder] Failed to decode event:', event.id, err);
    return null;
  }
}

// ─── Private decoders ────────────────────────────────────

/**
 * Decodes a `deposit` event.
 * DepositEvent { sender, token, amount, balance }
 */
function decodeDepositEvent(event: RpcNS.Api.EventResponse): DepositActivity {
  const raw = scValToNative(event.value) as Record<string, unknown>;

  return {
    ...buildBase(event, 'deposit'),
    sender:  safeAddress(raw['sender']),
    token:   safeAddress(raw['token']),
    amount:  safeBigInt(raw['amount']),
    balance: safeBigInt(raw['balance']),
  };
}

/**
 * Decodes a `spend` event.
 * SpendEvent { sender, gateway, token, receiver, receiver_short_id,
 *              amount, protocol_toll, nonce, balance }
 */
function decodeSpendEvent(event: RpcNS.Api.EventResponse): SpendActivity {
  const raw = scValToNative(event.value) as Record<string, unknown>;

  if (process.env.NODE_ENV === 'development') {
    // Log actual keys on first decode to verify field name casing from SDK
    console.debug('[event-decoder] spend keys:', Object.keys(raw));
  }

  return {
    ...buildBase(event, 'spend'),
    sender:          safeAddress(raw['sender']),
    gateway:         safeAddress(raw['gateway']),
    token:           safeAddress(raw['token']),
    receiver:        safeAddress(raw['receiver']),
    receiverShortId: decodeShortId(raw['receiver_short_id']),
    amount:          safeBigInt(raw['amount']),
    protocolToll:    safeBigInt(raw['protocol_toll']),
    nonce:           safeHex(raw['nonce']),
    balance:         safeBigInt(raw['balance']),
  };
}

/**
 * Decodes a `withdraw` event.
 * WithdrawEvent { sender, token, amount }
 */
function decodeWithdrawEvent(event: RpcNS.Api.EventResponse): WithdrawActivity {
  const raw = scValToNative(event.value) as Record<string, unknown>;

  return {
    ...buildBase(event, 'withdraw'),
    sender: safeAddress(raw['sender']),
    token:  safeAddress(raw['token']),
    amount: safeBigInt(raw['amount']),
  };
}

/**
 * Decodes `recipient` (register) and `recipupd` (update) events.
 * RecipientEvent { short_id, receiver }
 */
function decodeRecipientEvent(
  event: RpcNS.Api.EventResponse,
  isUpdate: boolean,
): RecipientActivity {
  const raw = scValToNative(event.value) as Record<string, unknown>;

  return {
    ...buildBase(event, isUpdate ? 'update_recipient' : 'register_recipient'),
    shortId:  decodeShortId(raw['short_id']),
    receiver: safeAddress(raw['receiver']),
  };
}

// ─── buildBase ───────────────────────────────────────────

/**
 * Builds the BaseActivity fields common to all event types.
 * The generic T constrains `type` to the specific literal so TypeScript
 * can correctly narrow the discriminated union in callers.
 */
function buildBase<T extends NetworkActivity['type']>(
  event: RpcNS.Api.EventResponse,
  type: T,
): { id: string; txHash: string; ledger: number; type: T; timestamp: string } {
  return {
    id:        event.id,
    txHash:    event.txHash,
    ledger:    event.ledger,
    type,
    timestamp: event.ledgerClosedAt,
  };
}
