import { Keypair } from '@stellar/stellar-sdk';
import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/infrastructure/supabase/server';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';

const secretJwtKey = process.env.JWT_SECRET_KEY;

export async function POST(request: Request) {
    try {
        // ── GATE 1: Verify Supabase Identity Session (Using the Bouncer) ──
        const userClient = await createClient();
        const { data: { user }, error: userError } = await userClient.auth.getUser();

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Supabase session invalid or expired. Please log in again.' },
                { status: 401 }
            );
        }

        // ── Create the Admin Database Client for wallet operations ──
        const supabase = createServiceClient();

        // ── Parse request body ──
        const { adminAddress, signature, nonce } = await request.json();

        if (!adminAddress) {
            return NextResponse.json({ error: 'adminAddress is required' }, { status: 400 });
        }

        // ── Generate Nonce Flow (when no signature is provided) ──
        if (!signature) {
            // Check the admin table first
            const { data: adminData, error: adminError } = await supabase
                .from('admin')
                .select('*')
                .eq('stellar_address', adminAddress)
                .maybeSingle();

            if (adminError) {
                console.error("❌ CRITICAL SUPABASE SERVER ERROR (Flow A):", adminError.message, adminError.details);
                return NextResponse.json({ error: adminError.message }, { status: 500 });
            }
            if (!adminData) {
                console.error("⚠️ Flow A Defect: Admin row missing for address:", adminAddress);
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


        // Fetch the actual nonce from Supabase to ensure it matches what was sent
        const { data: verifyData, error: verifyError } = await supabase
            .from('admin')
            .select('current_nonce')
            .eq('stellar_address', adminAddress)
            .maybeSingle();

        if (verifyError) {
            console.error("❌ CRITICAL SUPABASE SERVER ERROR (Flow B):", verifyError.message, verifyError.details);
            return NextResponse.json({ error: verifyError.message }, { status: 500 });
        }
        if (!verifyData) {
            console.error("⚠️ Flow B Defect: Admin row missing for address:", adminAddress);
            return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
        }

        if (verifyData.current_nonce !== nonce) {
            console.warn(`❌ Nonce Desync! DB has: [${verifyData.current_nonce}], UI sent: [${nonce}]`);
            return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
        }

        // Verify the signature
        const keypair = Keypair.fromPublicKey(adminAddress);
        const dataBuffer = Buffer.from(nonce, 'utf-8');
        const signatureBuffer = Buffer.from(signature, 'base64');

        let isValid = false;
        try {
            isValid = keypair.verify(dataBuffer, signatureBuffer);
        } catch (e) {
            console.error('Signature verification threw an error:', e);
        }

        // Freighter does not sign raw bytes (it uses a specific payload format to prevent signing blind transactions).
        // A proper implementation requires SEP-0010 (Challenge Transactions).
        // For development purposes, we will bypass this check if we are not in production.
        if (!isValid) {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Bypassing signature verification for local development. Please implement SEP-0010 for production.');
                isValid = true;
            } else {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        // Clear nonce in DB to prevent replay attacks
        await supabase
            .from('admin')
            .update({ current_nonce: null })
            .eq('stellar_address', adminAddress);

        // ── Issue Gate 2 JWT (Cryptographic Authority Token) ──
        const secret = new TextEncoder().encode(secretJwtKey);
        const alg = 'HS256';

        const token = await new SignJWT({
            adminAddress: adminAddress,
            role: 'admin'
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('1h') // session expires in 1 hour
            .sign(secret);

        // Create the success response
        const response = NextResponse.json({ success: true }, { status: 200 });

        // Set the http-only cookie explicitly using headers to ensure it is always attached
        response.headers.append(
            'Set-Cookie',
            `admin_session=${token}; Path=/; HttpOnly; Max-Age=3600; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
        );

        return response;
    } catch (error) {
        console.error('Auth error:', error);
        return NextResponse.json({ error: 'Request failed' }, { status: 500 });
    }
}