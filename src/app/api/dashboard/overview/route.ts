import { NextResponse } from 'next/server';
import { rpc } from '@stellar/stellar-sdk';
import { createServiceClient } from '@/infrastructure/supabase/server';
import type {
  DashboardOverview,
  NetworkService,
  RelayerReadiness,
} from '@/core/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HORIZON_URL = (
  process.env.STELLAR_HORIZON_URL ??
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  'https://horizon-testnet.stellar.org'
).replace(/\/$/, '');
const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  'https://soroban-testnet.stellar.org';
const PHPC_CODE = process.env.NEXT_PUBLIC_PHPC_ASSET_CODE ?? 'PHPC';
const PHPC_ISSUER = process.env.NEXT_PUBLIC_PHPC_ISSUER_ADDRESS;
const RELAYER_BUFFER_XLM = Number(process.env.RELAYER_MIN_AVAILABLE_XLM ?? '1');
const REQUEST_TIMEOUT_MS = 7_500;
const PAGE_SIZE = 200;
const MAX_PAYMENT_PAGES = 100;

type HorizonBalance = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  selling_liabilities?: string;
};

type HorizonAccount = {
  balances: HorizonBalance[];
  subentry_count?: number;
  num_sponsoring?: number;
  num_sponsored?: number;
};

type HorizonPayment = {
  type: string;
  from?: string;
  to?: string;
  account?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
  starting_balance?: string;
  created_at?: string;
  transaction_successful?: boolean;
};

type StoredNode = {
  id: string;
  name: string;
  stellar_address: string;
  status: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function classifyLatency(latencyMs: number): NetworkService['status'] {
  if (latencyMs < 750) return 'operational';
  return 'degraded';
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ data: T; latencyMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return { data: await response.json() as T, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeHorizon(): Promise<{
  service: NetworkService;
  baseReserveXlm: number;
}> {
  try {
    const { data, latencyMs } = await fetchJson<{ base_reserve_in_stroops?: number }>(HORIZON_URL);
    return {
      service: {
        name: 'Stellar Horizon',
        status: classifyLatency(latencyMs),
        latencyMs,
        detail: 'Account and payment history API',
      },
      baseReserveXlm: Number(data.base_reserve_in_stroops ?? 5_000_000) / 10_000_000,
    };
  } catch (error) {
    return {
      service: {
        name: 'Stellar Horizon',
        status: 'down',
        latencyMs: null,
        detail: error instanceof Error ? error.message : 'Health check failed',
      },
      baseReserveXlm: 0.5,
    };
  }
}

async function probeRpc(): Promise<NetworkService> {
  try {
    const { data, latencyMs } = await fetchJson<{
      result?: { status?: string };
      error?: { message?: string };
    }>(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    });

    if (data.error || data.result?.status !== 'healthy') {
      throw new Error(data.error?.message ?? 'RPC did not report healthy status');
    }

    return {
      name: 'Soroban RPC',
      status: classifyLatency(latencyMs),
      latencyMs,
      detail: 'Transaction submission and confirmation API',
    };
  } catch (error) {
    return {
      name: 'Soroban RPC',
      status: 'down',
      latencyMs: null,
      detail: error instanceof Error ? error.message : 'Health check failed',
    };
  }
}

async function fetchAccount(address: string): Promise<HorizonAccount | null> {
  try {
    const { data } = await fetchJson<HorizonAccount>(
      `${HORIZON_URL}/accounts/${encodeURIComponent(address)}`,
    );
    return data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('404 ')) return null;
    throw error;
  }
}

function getNativeBalance(account: HorizonAccount): HorizonBalance | undefined {
  return account.balances.find((balance) => balance.asset_type === 'native');
}

function getPhpcBalance(account: HorizonAccount): HorizonBalance | undefined {
  const matches = account.balances.filter(
    (balance) =>
      balance.asset_type !== 'native' &&
      balance.asset_code === PHPC_CODE &&
      (!PHPC_ISSUER || balance.asset_issuer === PHPC_ISSUER),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function formatAmount(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

async function readPaymentHistory(
  treasuryAddress: string,
  trustedAddresses: Set<string>,
): Promise<{
  distributedXlm: number;
  current24hXlm: number;
  previous24hXlm: number;
  phpcNet24h: number;
  truncated: boolean;
}> {
  let url = `${HORIZON_URL}/accounts/${encodeURIComponent(treasuryAddress)}/payments?order=desc&limit=${PAGE_SIZE}`;
  let distributedXlm = 0;
  let current24hXlm = 0;
  let previous24hXlm = 0;
  let phpcNet24h = 0;
  let page = 0;
  let truncated = false;
  const now = Date.now();
  const oneDayAgo = now - 86_400_000;
  const twoDaysAgo = now - 172_800_000;

  while (url && page < MAX_PAYMENT_PAGES) {
    const { data } = await fetchJson<{
      _embedded?: { records?: HorizonPayment[] };
      _links?: { next?: { href?: string } };
    }>(url);
    const records = data._embedded?.records ?? [];

    for (const payment of records) {
      if (payment.transaction_successful === false) continue;
      const timestamp = payment.created_at ? new Date(payment.created_at).getTime() : 0;
      const isNativePayment = payment.type === 'payment' && payment.asset_type === 'native';
      const isCreateAccount = payment.type === 'create_account';
      const recipient = isCreateAccount ? payment.account : payment.to;
      const amount = Number(isCreateAccount ? payment.starting_balance : payment.amount);

      if (
        payment.from === treasuryAddress &&
        recipient &&
        trustedAddresses.has(recipient) &&
        (isNativePayment || isCreateAccount) &&
        Number.isFinite(amount)
      ) {
        distributedXlm += amount;
        if (timestamp >= oneDayAgo) current24hXlm += amount;
        else if (timestamp >= twoDaysAgo) previous24hXlm += amount;
      }

      const isPhpc =
        payment.type === 'payment' &&
        payment.asset_code === PHPC_CODE &&
        (!PHPC_ISSUER || payment.asset_issuer === PHPC_ISSUER);
      if (isPhpc && timestamp >= oneDayAgo && Number.isFinite(amount)) {
        if (payment.to === treasuryAddress) phpcNet24h += amount;
        if (payment.from === treasuryAddress) phpcNet24h -= amount;
      }
    }

    page += 1;
    if (records.length < PAGE_SIZE) break;
    const nextUrl = data._links?.next?.href ?? '';
    if (!nextUrl || nextUrl === url) break;
    url = nextUrl;
  }

  if (page >= MAX_PAYMENT_PAGES) truncated = true;
  return { distributedXlm, current24hXlm, previous24hXlm, phpcNet24h, truncated };
}

async function reconcilePendingTransfers(): Promise<{
  pending: number | null;
  warning?: string;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('treasury_transfers')
    .select('tx_hash, submitted_at')
    .eq('status', 'pending');

  if (error) {
    return { pending: null, warning: `Transaction telemetry unavailable: ${error.message}` };
  }

  const server = new rpc.Server(RPC_URL);
  let pending = 0;

  await Promise.all((data ?? []).map(async (row) => {
    try {
      const result = await server.getTransaction(row.tx_hash);
      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        await supabase
          .from('treasury_transfers')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('tx_hash', row.tx_hash);
      } else if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
        await supabase
          .from('treasury_transfers')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('tx_hash', row.tx_hash);
      } else {
        pending += 1;
      }
    } catch {
      pending += 1;
    }
  }));

  return { pending };
}

function buildRelayerReadiness(
  node: StoredNode,
  account: HorizonAccount | null,
  baseReserveXlm: number,
): RelayerReadiness {
  const minimumRequiredXlm = Math.max(0, RELAYER_BUFFER_XLM);

  if (node.status !== 'active') {
    return {
      id: node.id,
      name: node.name,
      address: node.stellar_address,
      status: 'unauthorized',
      balanceXlm: '0.00',
      availableXlm: '0.00',
      minimumRequiredXlm: formatAmount(minimumRequiredXlm),
      detail: 'Not currently authorized in the gateway registry',
    };
  }

  if (!account) {
    return {
      id: node.id,
      name: node.name,
      address: node.stellar_address,
      status: 'unfunded',
      balanceXlm: '0.00',
      availableXlm: '0.00',
      minimumRequiredXlm: formatAmount(minimumRequiredXlm),
      detail: 'Stellar account is not funded',
    };
  }

  const native = getNativeBalance(account);
  const balance = Number(native?.balance ?? 0);
  const sellingLiabilities = Number(native?.selling_liabilities ?? 0);
  const reserveUnits = Math.max(
    2,
    2 +
      Number(account.subentry_count ?? 0) +
      Number(account.num_sponsoring ?? 0) -
      Number(account.num_sponsored ?? 0),
  );
  const minimumReserve = reserveUnits * baseReserveXlm;
  const available = Math.max(0, balance - sellingLiabilities - minimumReserve);
  const ready = available >= minimumRequiredXlm;

  return {
    id: node.id,
    name: node.name,
    address: node.stellar_address,
    status: ready ? 'ready' : 'low_balance',
    balanceXlm: formatAmount(balance),
    availableXlm: formatAmount(available),
    minimumRequiredXlm: formatAmount(minimumRequiredXlm),
    detail: ready
      ? 'Authorized, funded, and ready to pay transaction fees'
      : `Spendable XLM is below the ${formatAmount(minimumRequiredXlm)} XLM safety buffer`,
  };
}

export async function GET() {
  try {
    const treasuryAddress = requireEnv('NEXT_PUBLIC_TREASURY_ADDRESS');
    const supabase = createServiceClient();
    const warnings: string[] = [];

    const [nodeResult, horizonProbe, rpcService, pendingResult] = await Promise.all([
      supabase.from('nodes').select('id, name, stellar_address, status').order('name'),
      probeHorizon(),
      probeRpc(),
      reconcilePendingTransfers(),
    ]);

    if (nodeResult.error) throw new Error(nodeResult.error.message);
    const nodes = (nodeResult.data ?? []) as StoredNode[];
    const activeNodeRecords = nodes.filter((node) => node.status === 'active');
    if (pendingResult.warning) warnings.push(pendingResult.warning);

    let treasuryAccount: HorizonAccount | null = null;
    try {
      treasuryAccount = await fetchAccount(treasuryAddress);
    } catch (error) {
      warnings.push(`Treasury balance unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    const relayers = await Promise.all(activeNodeRecords.map(async (node): Promise<RelayerReadiness> => {
      try {
        const account = await fetchAccount(node.stellar_address);
        return buildRelayerReadiness(node, account, horizonProbe.baseReserveXlm);
      } catch (error) {
        return {
          id: node.id,
          name: node.name,
          address: node.stellar_address,
          status: 'unavailable',
          balanceXlm: '—',
          availableXlm: '—',
          minimumRequiredXlm: formatAmount(RELAYER_BUFFER_XLM),
          detail: error instanceof Error ? error.message : 'Horizon lookup failed',
        };
      }
    }));

    let history: Awaited<ReturnType<typeof readPaymentHistory>> | null = null;
    try {
      history = await readPaymentHistory(
        treasuryAddress,
        // Preserve cumulative distribution history when a previously trusted
        // relayer is later revoked.
        new Set(nodes.map((node) => node.stellar_address)),
      );
      if (history.truncated) {
        warnings.push(`Distributed XLM history exceeded ${MAX_PAYMENT_PAGES * PAGE_SIZE} payments.`);
      }
    } catch (error) {
      warnings.push(`Treasury payment history unavailable: ${error instanceof Error ? error.message : String(error)}`);
    }

    const nativeBalance = treasuryAccount ? Number(getNativeBalance(treasuryAccount)?.balance ?? 0) : null;
    const phpcBalance = treasuryAccount ? getPhpcBalance(treasuryAccount) : undefined;
    if (treasuryAccount && !phpcBalance) {
      warnings.push(
        PHPC_ISSUER
          ? `No ${PHPC_CODE} trustline was found for the configured issuer.`
          : `A unique ${PHPC_CODE} trustline could not be identified. Configure NEXT_PUBLIC_PHPC_ISSUER_ADDRESS.`,
      );
    }

    const respondingLatencies = [horizonProbe.service, rpcService]
      .map((service) => service.latencyMs)
      .filter((latency): latency is number => latency !== null);
    const avgLatencyMs = respondingLatencies.length
      ? Math.round(respondingLatencies.reduce((sum, value) => sum + value, 0) / respondingLatencies.length)
      : null;
    const distributedChangePct = history && history.previous24hXlm > 0
      ? ((history.current24hXlm - history.previous24hXlm) / history.previous24hXlm) * 100
      : null;
    const phpcNet24h = history?.phpcNet24h ?? null;
    const distributedXlm = history?.distributedXlm ?? null;
    const readyNodeCount = relayers.filter((relayer) => relayer.status === 'ready').length;

    const body: DashboardOverview = {
      walletInfo: {
        address: treasuryAddress,
        balancePhpc: phpcBalance ? formatAmount(Number(phpcBalance.balance)) : '—',
        balanceXlm: nativeBalance === null ? '—' : formatAmount(nativeBalance),
        change24h: phpcNet24h === null
          ? '—'
          : `${phpcNet24h >= 0 ? '+' : ''}${formatAmount(phpcNet24h)} PHPC`,
        fundedNodes: `${readyNodeCount} ready`,
        totalDistributed: distributedXlm === null
          ? '—'
          : `${formatAmount(distributedXlm)} XLM`,
      },
      metrics: {
        activeNodes: readyNodeCount,
        distributedXlm,
        distributedChangePct,
        pendingTransactions: pendingResult.pending,
        avgLatencyMs,
      },
      services: [horizonProbe.service, rpcService],
      relayers,
      lastUpdated: new Date().toISOString(),
      warnings,
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('[api/dashboard/overview]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dashboard overview.' },
      { status: 500 },
    );
  }
}
