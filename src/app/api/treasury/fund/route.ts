import { NextResponse } from 'next/server';
import {
    Keypair,
    TransactionBuilder,
    Networks,
    Operation,
    Asset,
    rpc,
} from '@stellar/stellar-sdk';
import { createServiceClient, createClient } from '@/infrastructure/supabase/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// ═══════════════════════════════════════════════════════════
// POST /api/treasury/fund
//
// Web2.5 hybrid: Admin enters PIN in UI → payload + PIN sent
// here → PIN verified server-side → treasury hot wallet signs
// and broadcasts the Stellar payment. No Freighter required.
//
// Design principles applied:
//   • Resource-oriented: noun-based route (/treasury/fund)
//   • Single responsibility: one route, one operation (fund)
//   • Stateless per-request PIN auth (no long-lived session)
//   • Server-side signing — secret never touches client
//   • Consistent error shape: { error: string, code?: string }
//
// Request body: {
//   destination: string;   // Stellar public key to fund
//   amount:      string;   // XLM amount as string ("50.00")
//   memo?:       string;   // optional text memo ≤ 28 bytes
//   pin:         string;   // 4–8 digit numeric PIN
// }
// ═══════════════════════════════════════════════════════════

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not defined`);
    return v;
}

/** PBKDF2-verify a PIN against stored hash+salt. Uses Web Crypto — no extra deps. */
async function verifyPin(pin: string, storedHash: string, saltHex: string): Promise<boolean> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const salt = Buffer.from(saltHex, 'hex');
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 },
        keyMaterial,
        256,
    );
    const derived = Buffer.from(bits).toString('hex');
    // Constant-time comparison via crypto.timingSafeEqual
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.subtle
        .digest('SHA-256', a) // dummy — we use timingSafeEqual trick below
        .then(() => {
            let diff = 0;
            for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
            return diff === 0;
        });
}

export async function POST(request: Request) {
    try {
        // ── Gate 1: Supabase session ──
        const userClient = await createClient();
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return NextResponse.json(
                { error: 'Supabase session invalid or expired.' },
                { status: 401 },
            );
        }

        // ── Gate 2: Stellar wallet JWT ──
        const cookieStore = await cookies();
        const token = cookieStore.get('admin_session')?.value;
        if (!token) {
            return NextResponse.json(
                { error: 'Wallet session missing.' },
                { status: 401 },
            );
        }
        const jwtSecret = new TextEncoder().encode(requireEnv('JWT_SECRET_KEY'));
        const { payload } = await jwtVerify(token, jwtSecret);
        const adminAddress = payload.adminAddress as string;
        if (!adminAddress) {
            return NextResponse.json({ error: 'Invalid wallet session token.' }, { status: 401 });
        }

        // ── Parse & validate body ──
        const body = await request.json() as {
            destination?: string;
            amount?: string;
            memo?: string;
            pin?: string;
        };

        const { destination, amount, memo, pin } = body;

        if (!destination || !amount || !pin) {
            return NextResponse.json(
                { error: 'destination, amount, and pin are required.' },
                { status: 400 },
            );
        }
        if (!/^\d{4,8}$/.test(pin)) {
            return NextResponse.json(
                { error: 'Invalid PIN format.' },
                { status: 400 },
            );
        }

        // Basic Stellar address format check (56-char, starts with G)
        if (!/^G[A-Z2-7]{55}$/.test(destination)) {
            return NextResponse.json(
                { error: 'Invalid destination Stellar address.' },
                { status: 400 },
            );
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return NextResponse.json(
                { error: 'amount must be a positive number.' },
                { status: 400 },
            );
        }
        if (memo && new TextEncoder().encode(memo).length > 28) {
            return NextResponse.json(
                { error: 'memo must be ≤ 28 bytes.' },
                { status: 400 },
            );
        }

        // ── Gate 3: PIN verification ──
        const supabase = createServiceClient();
        const { data: adminRecord, error: adminError } = await supabase
            .from('admin')
            .select('id, pin_hash, pin_salt')
            .eq('stellar_address', adminAddress)
            .single();

        if (adminError || !adminRecord) {
            return NextResponse.json(
                { error: 'Admin profile not found.' },
                { status: 404 },
            );
        }

        if (!adminRecord.pin_hash || !adminRecord.pin_salt) {
            return NextResponse.json(
                { error: 'Treasury PIN not set. Please configure your PIN first.', code: 'PIN_NOT_SET' },
                { status: 403 },
            );
        }

        const pinValid = await verifyPin(pin, adminRecord.pin_hash, adminRecord.pin_salt);
        if (!pinValid) {
            return NextResponse.json(
                { error: 'Incorrect PIN.', code: 'INVALID_PIN' },
                { status: 403 },
            );
        }

        // ── Load treasury hot wallet ──
        const treasurySecret = requireEnv('TREASURY_SECRET_KEY');
        let treasuryKeypair: Keypair;
        try {
            treasuryKeypair = Keypair.fromSecret(treasurySecret);
        } catch {
            console.error('TREASURY_SECRET_KEY is not a valid Stellar secret key.');
            return NextResponse.json(
                { error: 'Treasury wallet misconfigured. Contact system administrator.' },
                { status: 500 },
            );
        }

        // ── Build & sign transaction on server ──
        const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? requireEnv('NEXT_PUBLIC_SOROBAN_RPC_URL');
        const networkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? requireEnv('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');
        const server = new rpc.Server(rpcUrl);

        const sourceAccount = await server.getAccount(treasuryKeypair.publicKey());

        const txBuilder = new TransactionBuilder(sourceAccount, {
            fee: '100',
            networkPassphrase,
        }).addOperation(
            Operation.payment({
                destination,
                asset: Asset.native(),
                amount: amountNum.toFixed(7),
            }),
        ).setTimeout(30);

        if (memo) {
            txBuilder.addMemo({ type: 'text', value: memo } as any);
        }

        const tx = txBuilder.build();
        tx.sign(treasuryKeypair);

        // ── Broadcast ──
        const submitResult = await server.sendTransaction(tx);

        if (submitResult.status === 'ERROR') {
            console.error('Treasury broadcast error:', submitResult);
            return NextResponse.json(
                { error: 'Transaction rejected by Soroban network.', code: 'BROADCAST_FAILED' },
                { status: 502 },
            );
        }

        // Best-effort telemetry. The transaction has already been accepted by
        // Stellar, so a dashboard tracking failure must never fail the payment.
        const { error: trackingError } = await supabase
            .from('treasury_transfers')
            .upsert({
                tx_hash: submitResult.hash,
                destination,
                asset_code: 'XLM',
                amount: amountNum.toFixed(7),
                status: 'pending',
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'tx_hash' });

        if (trackingError) {
            console.error('Treasury transfer telemetry insert failed:', trackingError.message);
        }

        return NextResponse.json(
            {
                success: true,
                txHash: submitResult.hash,
                status: submitResult.status,
            },
            { status: 200 },
        );

    } catch (error) {
        console.error('treasury/fund error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
