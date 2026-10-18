import { NextResponse } from 'next/server';
import { getSql, postgresErrorCode } from '@/infrastructure/db/sql';
import { getPortalUser } from '@/infrastructure/auth/session';
import type { Region } from '@/core/types';

// ═══════════════════════════════════════════════════════════
// GET — List all regions
// ═══════════════════════════════════════════════════════════

export async function GET() {
    try {
        const sql = getSql();
        const data = await sql`
            SELECT id, slug, name
            FROM public.regions
            ORDER BY slug ASC
        `;

        return NextResponse.json(data as Region[]);
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// POST — Insert a new region (sign-in session required)
// ═══════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        const user = await getPortalUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Unauthorized. Please log in.' },
                { status: 401 },
            );
        }

        const body = await request.json() as { slug?: string; name?: string };

        if (!body.slug || !body.name) {
            return NextResponse.json(
                { error: 'slug and name are required' },
                { status: 400 },
            );
        }

        const sql = getSql();

        try {
            const rows = await sql`
                INSERT INTO public.regions (slug, name)
                VALUES (${body.slug.trim()}, ${body.name.trim()})
                RETURNING id, slug, name
            `;
            return NextResponse.json(rows[0] as Region, { status: 201 });
        } catch (error) {
            if (postgresErrorCode(error) === '23505') {
                return NextResponse.json(
                    { error: `Region slug "${body.slug}" already exists.` },
                    { status: 409 },
                );
            }
            throw error;
        }
    } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
