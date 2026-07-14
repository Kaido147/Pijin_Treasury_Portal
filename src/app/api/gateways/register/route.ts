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
import { getSorobanConfig } from '@/infrastructure/config/server';
import { requireEnv } from '@/infrastructure/helpers/requireEnv';

type RegisterGatewayRequest = {
    name?: string;
    address?: string;
    region_id?: string;
    walletPublicKey?: string;
};

type StoredGatewayNode = {
    id: string;
    name: string;
    stellar_address: string;
    region_id: string;
    status: NodeStatus | null;
};

function mapStoredNode(node: StoredGatewayNode): GatewayNode {
    return {
        id: node.id,
        name: node.name,
        address: node.stellar_address,
        regionSlug: node.region_id,
        status: node.status ?? 'syncing',
        uptime: '—',
        balance: '0.00',
    };
}

// Safe JSON Responses
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

// Formatting Simulation Events
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

// Verify Dual Gates
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

    // Stellar Wallet JWT Check
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

// POST Request
export async function POST(request: Request) {
    try {
        const supabase = await createServiceClient();

        // Dual-gate auth
        const auth = await verifyDualGates();
        if ('error' in auth) return auth.error;
        const { adminAddress } = auth;

        const data = await request.json() as RegisterGatewayRequest;

        if (!data.name || !data.address || !data.region_id || !data.walletPublicKey) {
            return NextResponse.json(
                { error: 'name, address, region_id, and walletPublicKey are required' },
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

        // Use the helper function from SorobanConfig
        const { server, contractId, networkPassphrase } = getSorobanConfig();

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
            .setTimeout(30)
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

// GET Request
export async function GET() {
    try {
        const supabase = await createServiceClient();

        const { data, error } = await supabase
            .from('nodes')
            .select('id, name, stellar_address, region_id, status')
            .order('name', { ascending: true });

        if (error) {
            console.error('database error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const nodes: GatewayNode[] = ((data ?? []) as StoredGatewayNode[]).map(mapStoredNode);

        return NextResponse.json(nodes);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE Request
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

        // Use the SorobanConfig helper
        const { server, contractId, networkPassphrase } = getSorobanConfig();

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
            .setTimeout(30)
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

// PATCH Request
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

        // Use SorobanConfig Helper Function
        const { server, contractId, } = getSorobanConfig();

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
        if (onChainContractId !== contractId) {
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

            let nodeError;
            if (existingNode) {
                // Reactivation path
                ({ error: nodeError } = await supabase
                    .from('nodes')
                    .update({ status: 'active', name: body.name || 'Unknown', region: body.region || 'UNKNOWN' })
                    .eq('stellar_address', onChainGatewayAddress));
            } else {
                // New registration path
                ({ error: nodeError } = await supabase
                    .from('nodes')
                    .insert({ stellar_address: onChainGatewayAddress, name: body.name || 'Unknown', region: body.region || 'UNKNOWN', status: 'active', registered_by: adminRecord.id }));
            }

            if (nodeError) {
                console.error('database error:', nodeError);
                return NextResponse.json({ error: nodeError.message }, { status: 500 });
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
