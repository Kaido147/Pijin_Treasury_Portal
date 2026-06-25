// ═══════════════════════════════════════════════════════════
// Pijin Treasury — Stellar Horizon API
//
// Utility functions for interacting with the Stellar Horizon
// network directly via REST API.
// ═══════════════════════════════════════════════════════════

const HORIZON_URL = process.env.STELLAR_HORIZON_TESTNET_URL;

/**
 * Fetches the live XLM balance for a given Stellar public key.
 * 
 * @param publicKey The Stellar public key to check.
 * @returns The XLM balance as a string, or '0.00' if it cannot be retrieved.
 */
export async function fetchStellarBalance(publicKey: string): Promise<string> {
  if (!publicKey) return '0.00';

  try {
    const response = await fetch(`${HORIZON_URL}/accounts/${publicKey}`, {
      // Ensure we don't cache this heavily on the server if we want live data
      next: { revalidate: 30 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch balance for ${publicKey}: ${response.statusText}`);
      return '0.00'; // Return '0.00' for unfunded or invalid accounts
    }

    const data = await response.json();

    // Find the native XLM balance
    const nativeBalance = data.balances?.find(
      (b: any) => b.asset_type === 'native'
    );

    if (nativeBalance && nativeBalance.balance) {
      // Format to 2 decimal places if needed, but Stellar returns a string like "123.4567890"
      const balanceNum = parseFloat(nativeBalance.balance);
      return balanceNum.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    return '0.00';
  } catch (error) {
    console.error(`Error fetching balance for ${publicKey}:`, error);
    return '0.00';
  }
}
