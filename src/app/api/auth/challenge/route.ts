import { Keypair } from '@stellar/stellar-sdk';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { adminAddress, signature, nonce } = await request.json();

        if (!adminAddress) {
            return NextResponse.json({ error: 'adminAddress is required' }, { status: 400 });
        }

        // 1. Generate Nonce Flow (when no signature is provided)
        if (!signature) {
            // Check the admin table first
            const { data: adminData, error: adminError } = await supabase
                .from('admin')
                .select('*')
                .eq('stellar_address', adminAddress)
                .maybeSingle();

            if (adminError || !adminData) {
                return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
            }

            // Generate a new nonce
            const newNonce = crypto.randomUUID();

            // Save the new nonce to the admin table
            const { error: updateError } = await supabase
                .from('admin')
                .update({ current_nonce: newNonce })
                .eq('stellar_address', adminAddress);

            if (updateError) {
                return NextResponse.json({ error: 'Failed to save nonce' }, { status: 500 });
            }

            return NextResponse.json({ nonce: newNonce });
        }

        // 2. Verification Flow (when signature is provided)

        // Fetch the actual nonce from Supabase to ensure it matches what was sent
        const { data: verifyData, error: verifyError } = await supabase
            .from('admin')
            .select('current_nonce')
            .eq('stellar_address', adminAddress)
            .maybeSingle();

        if (verifyError || !verifyData) {
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        if (verifyData.current_nonce !== nonce) {
            return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
        }

        // Verify the signature
        const keypair = Keypair.fromPublicKey(adminAddress);
        const dataBuffer = Buffer.from(nonce, 'utf-8');
        const signatureBuffer = Buffer.from(signature, 'base64');

        const isValid = keypair.verify(dataBuffer, signatureBuffer);

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Clear nonce in DB to prevent replay attacks
        await supabase
            .from('admin')
            .update({ current_nonce: null })
            .eq('stellar_address', adminAddress);

        // Set up your HTTP-only session cookie here (TODO)

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json({ error: 'Request failed' }, { status: 500 });
    }
}