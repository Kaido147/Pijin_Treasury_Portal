import { NextResponse, NextRequest } from 'next/server';
import {
    Address,
    TransactionBuilder,
    Contract,
    humanizeEvents,
    rpc,
} from '@stellar/stellar-sdk';
import { createServiceClient, createClient } from '@/infrastructure/supabase/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { inspect } from 'node:util';
import type { GatewayNode, NodeStatus } from '@/core/types';
import {
    syncNodeBalances,
    triggerImmediateBalanceSync,
    isBalanceStale,
} from '@/infrastructure/stellar/balance-sync';

type RegisterGatewayRequest = {
    name?: string;
    address?: string;
    region?: string;
    walletPublicKey?: string;
};

function requireEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is not defined`);
    }

    return value;
}

type StoredGatewayNode = {
    id: string;
    name: string;
    stellar_address: string;
    /** FK to regions.id — replaces the old denormalized region slug text */
    region_id: string;
    /**
     * Joined from regions table via region_id FK.
     * Supabase PostgREST returns FK joins as arrays even for many-to-one
     * relations — we take the first element.
     */
    regions: Array<{ id: string; slug: string; name: string }> | null;
    status: NodeStatus | null;
    /** Cached XLM balance from the background sync worker. Null if never synced. */
    balance: number | null;
    /** ISO timestamp of the last successful Horizon sync. */
    last_synced_at: string | null;
};

/**
 * Maps a DB node row (with joined region) to the GatewayNode domain type.
 * region     = human-readable name (e.g. "South East Asia 01").
 * regionSlug = DB slug key (e.g. "SEA-01") — used for filtering/re-selection.
 * Balance is read from the cached DB column — never fetched live here.
 * Use the balance-sync service to keep this column fresh.
 */
function mapStoredNode(node: StoredGatewayNode): GatewayNode {
    // Format the numeric DB balance to a locale string with 2 decimal places.
    // Falls back to '0.00' if the column is null (never synced yet).
    const formattedBalance = node.balance != null
        ? node.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '0.00';

    // Supabase returns joined rows as an array — take the first element.
    const regionRow = Array.isArray(node.regions) ? node.regions[0] : node.regions;

    return {
        id: node.id,
        name: node.name,
        address: node.stellar_address,
        region: regionRow?.name ?? regionRow?.slug ?? 'Unknown',
        regionSlug: regionRow?.slug ?? node.region_id,
        status: node.status ?? 'syncing',
        uptime: '—',
        balance: formattedBalance,
    };
}

function toJsonSafe(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(toJsonSafe);
    if (value && typeof value === 'object') {
        if (value instanceof Address) return value.toString();

        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)])
        );
    }

    return value;
}

function formatSimulationEvents(events: rpc.Api.SimulateTransactionErrorResponse['events']) {
    if (!events?.length) return [];

    try {
        return toJsonSafe(humanizeEvents(events));
    } catch {
        return events.map((event) => ({
            inSuccessfulContractCall: event.inSuccessfulContractCall(),
            eventXdr: event.event().toXDR('base64'),
        }));
    }
}

// ═══════════════════════════════════════════════════════════
// Dual-Gate Authentication Helper
// ═══════════════════════════════════════════════════════════

/**
 * Verifies BOTH security gates for mutating API operations.
 *
 * Gate 1: Supabase Auth session (sb-access-token cookie)
 * Gate 2: Stellar wallet JWT (admin_session cookie)
 *
 * Returns adminAddress on success, or NextResponse error on failure.
 */
async function verifyDualGates() {
    // ── GATE 1: Supabase Identity Check ──
    const userClient = await createClient();
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
        return {
            error: NextResponse.json(
                { error: 'Supabase session invalid or expired. Please log in again.' },
                { status: 401 }
            )
        };
    }

    // ── GATE 2: Stellar Wallet JWT Check ──
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (!token) {
        return {
            error: NextResponse.json(
                { error: 'Wallet session missing. Please connect wallet and sign challenge.' },
                { status: 401 }
            )
        };
    }

    const secret = new TextEncoder().encode(requireEnv('JWT_SECRET_KEY'));
    const { payload } = await jwtVerify(token, secret);
    const adminAddress = payload.adminAddress as string;

    if (!adminAddress) {
        return {
            error: NextResponse.json({ error: 'Invalid wallet session token' }, { status: 401 })
        };
    }

    return { adminAddress };
}

// ═══════════════════════════════════════════════════════════
// POST — Build unsigned register_gateway XDR for client signing
// ═══════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        const supabase = await createServiceClient();

        // Dual-gate auth
        const auth = await verifyDualGates();
        if ('error' in auth) return auth.error;
        const { adminAddress } = auth;

        const data = await request.json() as RegisterGatewayRequest;

        if (!data.name || !data.address || !data.region || !data.walletPublicKey) {
            return NextResponse.json(
                { error: 'name, address, region, and walletPublicKey are required' },
                { status: 400 }
            );
        }

        // Verify admin exists in DB
        const { data: admin, error: adminError } = await supabase
            .from('admin')
            .select('id')
            .eq('stellar_address', adminAddress)
            .single();

        if (adminError || !admin) {
            return NextResponse.json({ error: 'admin profile not found' }, { status: 404 });
        }

        const serverUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? requireEnv('NEXT_PUBLIC_SOROBAN_RPC_URL');
        const contractId = requireEnv('CONTRACT_ID');
        const networkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? requireEnv('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');
        const server = new rpc.Server(serverUrl);

        // adminAddress from JWT — used as the contract admin arg (not the fee payer)
        // walletPublicKey — the connected wallet that pays gas and signs
        let adminKeyPair: Address;
        let gatewayAddress: Address;
        try {
            adminKeyPair = new Address(adminAddress);
            gatewayAddress = new Address(data.address);
        } catch {
            return NextResponse.json({ error: 'Invalid Stellar Public Key format.' }, { status: 400 });
        }

        // Source account = wallet that pays gas (sequence increments on wallet, not server key)
        const sourceAccount = await server.getAccount(data.walletPublicKey);

        let tx = new TransactionBuilder(sourceAccount, {
            fee: '100',
            networkPassphrase,
        })
            .addOperation(
                new Contract(contractId).call('register_gateway',
                    adminKeyPair.toScVal(),
                    gatewayAddress.toScVal(),
                )
            )
            .setTimeout(180)
            .build();

        // Simulate to calculate exact Soroban fees + footprint
        const simulation = await server.simulateTransaction(tx);

        if (rpc.Api.isSimulationError(simulation)) {
            const events = formatSimulationEvents(simulation.events);
            console.error('Simulation Error:', simulation.error);
            console.error('Simulation Events:', inspect(events, { depth: null, colors: false }));

            // Determine error type based on the simulation error message
            let errorType = 'simulation_failed';
            const errorMessage = simulation.error?.toLowerCase() || '';

            if (errorMessage.includes('gas') || errorMessage.includes('limit') || errorMessage.includes('budget') || errorMessage.includes('resource')) {
                errorType = 'out_of_gas';
            }

            return NextResponse.json({
                type: errorType,
                error: 'Contract simulation failed',
                details: simulation.error || 'Unknown simulation error',
                events
            }, { status: 422 });
        }

        // Assemble with real fees — do NOT sign server-side
        const assembled = rpc.assembleTransaction(tx, simulation).build();

        return NextResponse.json({
            unsignedXdr: assembled.toEnvelope().toXDR('base64'),
        }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// GET — List all registered gateway nodes
//
// CQRS Read Path:
//   1. Read from DB instantly (includes cached balance)
//   2. Check if any nodes have stale balances (> 60s old)
//   3. If stale, trigger background SWR sync (fire-and-forget)
//      The current request still returns immediately with
//      the last-known balance from the DB cache.
// ═══════════════════════════════════════════════════════════

export async function GET() {
    try {
        const supabase = createServiceClient();

        // ── Query Read: JOIN regions for human-readable name ──
        const { data, error } = await supabase
            .from('nodes')
            .select('id, name, stellar_address, region_id, regions(id, slug, name), status, balance, last_synced_at')
            .order('name', { ascending: true });

        if (error) {
            console.error('[GatewayRegister] database error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rawNodes = (data ?? []) as unknown as StoredGatewayNode[];

        // ── SWR Stale Check: find nodes that need a balance refresh ──
        const staleNodes = rawNodes.filter((n) => isBalanceStale(n.last_synced_at));

        if (staleNodes.length > 0) {
            // Fire-and-forget: do NOT await — response must return immediately
            // The next poll (every 30s from useGatewayNodes) will see fresh data
            syncNodeBalances(
                staleNodes.map((n) => ({
                    id: n.id,
                    stellar_address: n.stellar_address,
                    last_synced_at: n.last_synced_at,
                }))
            ).catch((err) => {
                console.error('[GatewayRegister] Background sync failed:', err);
            });
        }

        // ── Respond instantly with DB-cached data ──
        const nodes: GatewayNode[] = rawNodes.map(mapStoredNode);

        return NextResponse.json(nodes);
    } catch (error) {
        console.error('[GatewayRegister] Internal error in GET:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// DELETE — Build unsigned remove_gateway XDR for client signing
// ═══════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
    try {
        // Dual-gate auth
        const auth = await verifyDualGates();
        if ('error' in auth) return auth.error;
        const { adminAddress } = auth;

        const { address, walletPublicKey } = await request.json() as {
            address?: string;
            walletPublicKey?: string;
        };

        if (!address || !walletPublicKey) {
            return NextResponse.json(
                { error: 'address and walletPublicKey are required' },
                { status: 400 }
            );
        }

        const serverUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? requireEnv('NEXT_PUBLIC_SOROBAN_RPC_URL');
        const contractId = requireEnv('CONTRACT_ID');
        const networkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? requireEnv('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');
        const server = new rpc.Server(serverUrl);

        let adminKeyPair: Address;
        let gatewayAddress: Address;
        try {
            adminKeyPair = new Address(adminAddress);
            gatewayAddress = new Address(address);
        } catch {
            return NextResponse.json({ error: 'Invalid Stellar Public Key format.' }, { status: 400 });
        }

        // Source account = wallet that pays gas
        const sourceAccount = await server.getAccount(walletPublicKey);

        let tx = new TransactionBuilder(sourceAccount, {
            fee: '100',
            networkPassphrase,
        })
            .addOperation(
                new Contract(contractId).call('remove_gateway',
                    adminKeyPair.toScVal(),
                    gatewayAddress.toScVal(),
                )
            )
            .setTimeout(180)
            .build();

        const simulation = await server.simulateTransaction(tx);

        if (rpc.Api.isSimulationError(simulation)) {
            const events = formatSimulationEvents(simulation.events);
            console.error('Simulation Error:', simulation.error);
            return NextResponse.json({
                error: 'Contract simulation failed',
                details: simulation.error || 'Unknown simulation error',
                events
            }, { status: 400 });
        }

        // Assemble — return unsigned envelope XDR
        const assembled = rpc.assembleTransaction(tx, simulation).build();

        return NextResponse.json({
            unsignedXdr: assembled.toEnvelope().toXDR('base64'),
        }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// PATCH — Verification Oracle: on-chain confirm → then DB sync
// ═══════════════════════════════════════════════════════════

/**
 * Security-critical verification oracle.
 *
 * Fetches the transaction from the Soroban ledger and verifies:
 *   Gate A — TX status is SUCCESS on-chain
 *   Gate B — Operation is invokeHostFunction (invokeContract variant)
 *   Gate C — Contract address matches our deployed CONTRACT_ID
 *   Gate D — Function name matches the requested action
 *   Gate E — Gateway address extracted from on-chain TX args
 *
 * The stellar_address used for DB writes is sourced from the
 * on-chain TX envelope ONLY — never trusted from the client body.
 */
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createServiceClient();

        // Dual-gate auth
        const auth = await verifyDualGates();
        if ('error' in auth) return auth.error;
        const { adminAddress } = auth;

        const body = await request.json() as {
            txHash?: string;
            action?: 'register' | 'remove';
            name?: string;
            region?: string;
        };

        if (!body.txHash || !body.action) {
            return NextResponse.json({ error: 'txHash and action are required' }, { status: 400 });
        }

        const serverUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? requireEnv('NEXT_PUBLIC_SOROBAN_RPC_URL');
        const expectedContractId = requireEnv('CONTRACT_ID');
        const server = new rpc.Server(serverUrl);

        // ── Gate A: Fetch TX from Soroban ledger ──
        const txResult = await server.getTransaction(body.txHash);

        if (txResult.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
            return NextResponse.json(
                { error: `Transaction is not confirmed on-chain. Status: ${txResult.status}` },
                { status: 400 }
            );
        }

        const successTx = txResult as rpc.Api.GetSuccessfulTransactionResponse;

        // ── Gate B: Inspect envelope structure ──
        let onChainContractId: string;
        let onChainFnName: string;
        let onChainGatewayAddress: string;

        try {
            const envelope = successTx.envelopeXdr;
            const txBody = envelope.v1().tx();
            const ops = txBody.operations();

            if (ops.length !== 1) {
                throw new Error('Expected exactly one operation');
            }

            // Throws if not invokeHostFunction → guards Gate B automatically
            const invocation = ops[0].body().invokeHostFunctionOp().hostFunction().invokeContract();

            // ── Gate C: Contract address (invokeArgs[0] in flat layout) ──
            // User-confirmed extraction: Address.fromScVal(invokeArgs[0]).toString()
            onChainContractId = Address.fromScAddress(invocation.contractAddress()).toString();

            // ── Gate D: Function name (invokeArgs[1] in flat layout) ──
            onChainFnName = invocation.functionName().toString();

            // ── Gate E: Gateway address (invokeArgs[3] in flat layout = fnArgs[1]) ──
            // Contract signature: register_gateway(admin: Address, gateway: Address)
            //   fnArgs[0] = admin scval  → invokeArgs[2] in flat layout
            //   fnArgs[1] = gateway scval → invokeArgs[3] in flat layout (user-confirmed)
            const fnArgs = invocation.args();
            if (fnArgs.length < 2) {
                throw new Error('Unexpected number of contract function arguments');
            }
            // User-confirmed: Address.fromScVal(invokeArgs[3]).toString()
            onChainGatewayAddress = Address.fromScVal(fnArgs[1]).toString();

        } catch (parseError) {
            console.error('XDR parse error:', parseError);
            return NextResponse.json(
                { error: 'Failed to parse transaction envelope structure' },
                { status: 400 }
            );
        }

        // ── Enforce Gate C ──
        if (onChainContractId !== expectedContractId) {
            return NextResponse.json(
                { error: 'Contract address mismatch — transaction targets unexpected contract' },
                { status: 403 }
            );
        }

        // ── Enforce Gate D ──
        const expectedFn = body.action === 'register' ? 'register_gateway' : 'remove_gateway';
        if (onChainFnName !== expectedFn) {
            return NextResponse.json(
                { error: `Function name mismatch — expected ${expectedFn}, got ${onChainFnName}` },
                { status: 403 }
            );
        }

        // ── All gates passed — write to Supabase ──
        if (body.action === 'register') {
            const { data: adminRecord, error: adminError } = await supabase
                .from('admin')
                .select('id')
                .eq('stellar_address', adminAddress)
                .single();

            if (adminError || !adminRecord) {
                return NextResponse.json({ error: 'admin profile not found' }, { status: 404 });
            }

            // Read-Then-Write: avoids 42P10 missing unique constraint on upsert
            const { data: existingNode } = await supabase
                .from('nodes')
                .select('id')
                .eq('stellar_address', onChainGatewayAddress)
                .maybeSingle();

            // Resolve region_id from slug (body.region carries the slug value)
            const regionSlug = body.region || 'UNKNOWN';
            const { data: regionRow, error: regionErr } = await supabase
                .from('regions')
                .select('id')
                .eq('slug', regionSlug)
                .maybeSingle();

            if (regionErr || !regionRow) {
                return NextResponse.json(
                    { error: `Region slug "${regionSlug}" not found in regions table.` },
                    { status: 400 },
                );
            }

            const resolvedRegionId = regionRow.id;

            let nodeError;
            if (existingNode) {
                // Reactivation path
                ({ error: nodeError } = await supabase
                    .from('nodes')
                    .update({ status: 'active', name: body.name || 'Unknown', region_id: resolvedRegionId })
                    .eq('stellar_address', onChainGatewayAddress));
            } else {
                // New registration path
                ({ error: nodeError } = await supabase
                    .from('nodes')
                    .insert({ stellar_address: onChainGatewayAddress, name: body.name || 'Unknown', region_id: resolvedRegionId, status: 'active', registered_by: adminRecord.id }));
            }

            if (nodeError) {
                console.error('database error:', nodeError);
                return NextResponse.json({ error: nodeError.message }, { status: 500 });
            }

            // ── Event-Driven Cache Invalidation ──
            // Immediately queue a Horizon balance fetch for this node so it
            // shows a real balance on the next dashboard poll (not '0.00').
            // We need the node's DB id — fetch the freshly inserted/updated row.
            const { data: syncedNode } = await supabase
                .from('nodes')
                .select('id')
                .eq('stellar_address', onChainGatewayAddress)
                .maybeSingle();

            if (syncedNode?.id) {
                // Fire-and-forget — do NOT await
                triggerImmediateBalanceSync(syncedNode.id, onChainGatewayAddress);
            }
        } else {
            // Soft-delete — mark node inactive, preserve the record
            const { error: updateError } = await supabase
                .from('nodes')
                .update({ status: 'inactive' })
                .eq('stellar_address', onChainGatewayAddress);

            if (updateError) {
                console.error('database error:', updateError);
                return NextResponse.json({ error: updateError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
