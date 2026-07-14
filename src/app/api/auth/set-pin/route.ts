import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/infrastructure/supabase/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// ═══════════════════════════════════════════════════════════
// POST /api/auth/set-pin
//
// Allows an authenticated admin to set or update their treasury
// action PIN. Uses Web Crypto PBKDF2 — no extra dependencies.
//
// Request body: { pin: string }   (4-8 digit numeric PIN)
// Response:     { success: true } | { error: string }
// ═══════════════════════════════════════════════════════════

function requireEnv(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not defined`);
    return v;
}

/** Derive a PBKDF2 hash from a PIN using Web Crypto. Returns hex string. */
async function hashPin(pin: string, saltHex: string): Promise<string> {
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
    return Buffer.from(bits).toString('hex');
}

/** Generate a cryptographically random 32-byte hex salt. */
function generateSalt(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('hex');
}

export async function POST(request: Request) {
    try {
        // ── Gate 1: Supabase session ──
        const userClient = await createClient();
        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return NextResponse.json(
                { error: 'Supabase session invalid or expired. Please log in again.' },
                { status: 401 },
            );
        }

        // ── Gate 2: Stellar wallet JWT ──
        const cookieStore = await cookies();
        const token = cookieStore.get('admin_session')?.value;
        if (!token) {
            return NextResponse.json(
                { error: 'Wallet session missing. Please connect wallet and sign challenge.' },
                { status: 401 },
            );
        }
        const secret = new TextEncoder().encode(requireEnv('JWT_SECRET_KEY'));
        const { payload } = await jwtVerify(token, secret);
        const adminAddress = payload.adminAddress as string;
        if (!adminAddress) {
            return NextResponse.json({ error: 'Invalid wallet session token' }, { status: 401 });
        }

        // ── Validate PIN ──
        const body = await request.json() as { pin?: string };
        const pin = body.pin?.trim() ?? '';
        if (!/^\d{4,8}$/.test(pin)) {
            return NextResponse.json(
                { error: 'PIN must be 4–8 digits.' },
                { status: 400 },
            );
        }

        // ── Hash PIN ──
        const salt = generateSalt();
        const hash = await hashPin(pin, salt);

        // ── Persist to admin table ──
        const supabase = createServiceClient();
        const { error: updateError } = await supabase
            .from('admin')
            .update({ pin_hash: hash, pin_salt: salt })
            .eq('stellar_address', adminAddress);

        if (updateError) {
            console.error('set-pin DB error:', updateError);
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('set-pin error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
