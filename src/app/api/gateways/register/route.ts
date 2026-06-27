import { NextResponse } from 'next/server';
import {
    Keypair,
    Networks,
    TransactionBuilder,
    Contract,
    nativeToScVal,
    rpc
} from '@stellar/stellar-sdk';
import { supabase } from '@lib/supabase';

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // Initialize the RPC connection and load your server's secret key
        const serverUrl = process.env.SOROBAN_RPC_URL;

        if (!serverUrl) {
            throw new Error('SOROBAN_RPC_URL is not defined');
        }

        const server = new rpc.Server(serverUrl);

        // The server's wallet that pays the gas fee
        const treasuryKeypair = Keypair.fromSecret(process.env.TREASURY_SECRET_KEY!);
        const contract = new Contract(process.env.CONTRACT_ID!);

        // Fetch the treasury account details to get the current sequence number
        const sourceAccount = await server.getAccount(treasuryKeypair.publicKey());

        // Build the initial transaction
        // This assumes your smart contract has a function named 'register_node'
        let tx = new TransactionBuilder(sourceAccount, {
            fee: '100', // This is just a base fee, Soroban will calculate the real fee next
            networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE,
        })
            .addOperation(
                contract.call('register_node',
                    nativeToScVal(data.address, { type: 'address' }),
                    nativeToScVal(data.name, { type: 'string' }),
                    nativeToScVal(data.region, { type: 'string' })
                )
            )
            .setTimeout(30)
            .build();

        // Simulate the transaction
        // Soroban requires simulation to calculate exact gas fees and storage footprints
        const simulation = await server.simulateTransaction(tx);

        if (rpc.Api.isSimulationError(simulation)) {
            console.error(simulation.error);
            return NextResponse.json({ error: 'Contract simulation failed' }, { status: 400 });
        }

        // Assemble the final transaction with the simulated data and sign it
        tx = rpc.assembleTransaction(tx, simulation).build();
        tx.sign(treasuryKeypair);

        // Submit to the Stellar network
        const txResponse = await server.sendTransaction(tx);

        if (txResponse.status === 'ERROR') {
            return NextResponse.json({ error: 'Transaction rejected by network' }, { status: 500 });
        }

        // Only runs if the blockchain transaction was successfully sent
        const { error: dbError } = await supabase
            .from('nodes')
            .insert([
                {
                    name: data.name,
                    address: data.address,
                    region: data.region,
                    status: 'syncing'
                }
            ]);

        if (dbError) {
            console.error('Database error:', dbError);
            // The blockchain tx succeeded, but DB failed. 
            // You might want to handle this edge case later.
            return NextResponse.json({ error: 'Failed to save to database' }, { status: 500 });
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