// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Utility Functions
// Pure functions used across all layers.
// ═══════════════════════════════════════════════════════════

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─── Class Name Merging ─────────────────────────────────

/** Merge Tailwind CSS classes with conflict resolution */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Address Formatting ─────────────────────────────────

/** Truncate a Stellar address or transaction hash for display */
export function truncateAddress(
  address: string,
  startChars = 8,
  endChars = 6,
): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}…${address.slice(-endChars)}`;
}

// ─── Date / Time Formatting ─────────────────────────────

/** Format a Date to "HH:MM:SS" */
export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Format a Date to "HH:MM" */
export function formatTimeShort(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a Date to "Mon DD" */
export function formatDate(d: Date): string {
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

// ─── Random Data Generation ─────────────────────────────

/** Generate a random 64-character hex hash */
export function generateHash(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
}

/** Generate a random XLM amount string between min and max */
export function generateAmount(min = 50, max = 4050): string {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// ─── Validation ─────────────────────────────────────────

/** Validate a Stellar public key format. Returns error message or empty string. */
export function validateStellarAddress(address: string): string {
  if (!address) return 'Destination address is required';
  if (address.length !== 56 || !address.startsWith('G'))
    return 'Must be a valid Stellar public key (56 chars, starts with G)';
  return '';
}
