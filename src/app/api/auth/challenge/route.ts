import { Keypair, WebAuth } from '@stellar/stellar-sdk';
import { NextResponse } from 'next/server';
import { getSql } from '@/infrastructure/db/sql';
import { getPortalUser } from '@/infrastructure/auth/session';
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';
import crypto from 'crypto';

const secretJwtKey = process.env.JWT_SECRET_KEY || 'default_secret';
const seed = crypto.createHash('sha256').update(secretJwtKey).digest();
const serverKeypair = Keypair.fromRawEd25519Seed(seed);
const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

export async function POST(request: Request) {
    try {
        const user = await getPortalUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Sign-in session invalid or expired. Please log in again.' },
                { status: 401 }
            );
        }

        const sql = getSql();

        // ── Parse request body ──
        const { adminAddress, signedXdr } = await request.json();

        if (!adminAddress) {
            return NextResponse.json({ error: 'adminAddress is required' }, { status: 400 });
        }

        // ── Generate Challenge Flow ──
        if (!signedXdr) {
            // Check the admin table first to ensure the user is an admin
            const adminRows = await sql`
                SELECT id
                FROM public.admin
                WHERE stellar_address = ${adminAddress}
                LIMIT 1
            `;

            if (adminRows.length === 0) {
                return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
            }

            try {
                // Generate a SEP-10 challenge transaction valid for 5 minutes
                const challengeXdr = WebAuth.buildChallengeTx(
                    serverKeypair,
                    adminAddress,
                    'pijin.network',
                    300,
                    NETWORK_PASSPHRASE,
                    'pijin.network'
                );

                return NextResponse.json({ transactionXdr: challengeXdr });
            } catch (e: any) {
                console.error('Failed to build SEP-10 challenge:', e);
                return NextResponse.json({ error: 'Failed to build challenge' }, { status: 500 });
            }
        }

        // ── Verify Challenge Flow ──
        try {
            const signers = WebAuth.verifyChallengeTxSigners(
                signedXdr,
                serverKeypair.publicKey(),
                NETWORK_PASSPHRASE,
                [adminAddress],
                'pijin.network',
                'pijin.network'
            );

            if (!signers.includes(adminAddress)) {
                return NextResponse.json({ error: 'Admin did not sign the challenge' }, { status: 401 });
            }
        } catch (e: any) {
            console.error('SEP-10 verification error:', e);
            return NextResponse.json({ error: 'Invalid SEP-010 signature' }, { status: 401 });
        }

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