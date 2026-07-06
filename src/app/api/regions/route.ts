import { NextResponse } from 'next/server';
import { createServiceClient, createClient } from '@/infrastructure/supabase/server';
import type { Region } from '@/core/types';

// ═══════════════════════════════════════════════════════════
// GET — List all regions
// ═══════════════════════════════════════════════════════════

export async function GET() {
    try {
        const supabase = await createServiceClient();

        const { data, error } = await supabase
            .from('regions')
            .select('id, slug, name')
            .order('slug', { ascending: true });

        if (error) {
            console.error('database error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json((data ?? []) as Region[]);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════════
// POST — Insert a new region (Supabase session auth only)
// ═══════════════════════════════════════════════════════════

export async function POST(request: Request) {
    try {
        // Gate: Supabase identity check
        const userClient = await createClient();
        const { data: { user }, error: userError } = await userClient.auth.getUser();

        if (userError || !user) {
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

        const supabase = await createServiceClient();

        const { data, error } = await supabase
            .from('regions')
            .insert({ slug: body.slug.trim(), name: body.name.trim() })
            .select('id, slug, name')
            .single();

        if (error) {
            // Unique constraint violation → duplicate slug
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: `Region slug "${body.slug}" already exists.` },
                    { status: 409 },
                );
            }
            console.error('database error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data as Region, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
