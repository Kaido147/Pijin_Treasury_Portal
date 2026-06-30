import { NextResponse } from 'next/server';
import {
    Address,
    Keypair,
    TransactionBuilder,
    Contract,
    humanizeEvents,
    rpc
} from '@stellar/stellar-sdk';
import { supabase } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { inspect } from 'node:util';
import type { GatewayNode, NodeStatus } from '@/core/types';

type RegisterGatewayRequest = {
    name?: string;
    address?: string;
    region?: string;
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
    region: string;
    status: NodeStatus | null;
};

function mapStoredNode(node: StoredGatewayNode): GatewayNode {
    return {
        id: node.id,
        name: node.name,
        address: node.stellar_address,
        region: node.region,
        status: node.status ?? 'syncing',
        uptime: '—',
        balance: '0.00',
    };
}

async function getAdminAddressFromSession(): Promise<string | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    if (!token) return null;

    const secret = new TextEncoder().encode(requireEnv('JWT_SECRET_KEY'));
    const { payload } = await jwtVerify(token, secret);

    return typeof payload.adminAddress === 'string' ? payload.adminAddress : null;
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

export async function POST(request: Request) {
    // Store the cookie session
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;

    // Check if there is a token
    if (!token) {
        return NextResponse.json({ error: 'Token missing from cookies' }, { status: 401 });
    }

    try {
        // Encode the JWT secret key
        const secret = new TextEncoder().encode(requireEnv('JWT_SECRET_KEY'));
        // Verify the token
        const { payload } = await jwtVerify(token, secret);
        const adminAddress = payload.adminAddress as string;

        // Guard clause to check the payload if it's valid admin address
        if (!adminAddress) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Proceed to requesting JSON data from the frontend
        const data = await request.json() as RegisterGatewayRequest;

        if (!data.name || !data.address || !data.region) {
            return NextResponse.json({ error: 'name, address, and region are required' }, { status: 400 });
        }

        // Query the admin id first
        const { data: admin, error: adminError } = await supabase
            .from('admin')
            .select('id')
            .eq('stellar_address', adminAddress)
            .single();

        if (adminError || !admin) {
            return NextResponse.json({ error: 'admin profile not found' }, { status: 404 });
        }

        // Initialize the RPC connection and load your server's secret key
        const serverUrl = requireEnv('SOROBAN_RPC_URL');
        const adminSecretKey = requireEnv('ADMIN_SECRET_KEY');
        const contractId = requireEnv('CONTRACT_ID');
        const networkPassphrase = requireEnv('STELLAR_NETWORK_PASSPHRASE');
        const server = new rpc.Server(serverUrl);

        // The server's wallet that pays the gas fee
        const adminKeypair = Keypair.fromSecret(adminSecretKey);
        const contract = new Contract(contractId);
        const adminKeyPair = new Address(adminKeypair.publicKey());
        const gatewayAddress = new Address(data.address);

        // Fetch the treasury account details to get the current sequence number
        const sourceAccount = await server.getAccount(adminKeypair.publicKey());

        // Build the initial transaction
        // This assumes your smart contract has a function named 'register_gateway'
        let tx = new TransactionBuilder(sourceAccount, {
            fee: '100', // This is just a base fee, Soroban will calculate the real fee next
            networkPassphrase,
        })
            .addOperation(
                contract.call('register_gateway',
                    adminKeyPair.toScVal(),
                    gatewayAddress.toScVal(),
                )
            )
            .setTimeout(30)
            .build();

        // Simulate the transaction
        // Soroban requires simulation to calculate exact gas fees and storage footprints
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

        // Assemble the final transaction with the simulated data and sign it
        tx = rpc.assembleTransaction(tx, simulation).build();
        tx.sign(adminKeypair);

        // Submit to the Stellar network
        const txResponse = await server.sendTransaction(tx);

        if (txResponse.status === 'ERROR') {
            return NextResponse.json({ error: 'Transaction rejected by network' }, { status: 500 });
        }

        // Only runs if the blockchain transaction was successfully sent
        const { data: newNode, error: nodeError } = await supabase
            .from('nodes')
            .insert({
                name: data.name,
                stellar_address: data.address, // the gateway stellar address
                region: data.region,
                registered_by: admin.id, // uses the verified UUID from step 2
                status: 'active'
            })
            .select()
            .single();

        // Handle duplicate entries (nodes)
        if (nodeError?.code === '23505') {
            return NextResponse.json({ error: 'Gateway already registered.' }, { status: 409 });
        }

        if (nodeError) {
            console.error('database error:', nodeError);
            return NextResponse.json({ error: nodeError.message }, { status: 500 });
        }

        // Return success to the frontend
        return NextResponse.json({
            success: true,
            txHash: txResponse.hash
        }, { status: 200 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const adminAddress = await getAdminAddressFromSession();

        if (!adminAddress) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await supabase
            .from('nodes')
            .select('id, name, stellar_address, region, status')
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
