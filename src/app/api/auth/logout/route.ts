import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/supabase/server';

export async function POST() {
    // Sign out from Supabase Auth (clears Gate 1 sb-* cookies)
    const supabase = await createClient();
    await supabase.auth.signOut();

    // Clear Gate 2 wallet JWT cookie
    const response = NextResponse.json({ success: true });
    response.headers.append(
        'Set-Cookie',
        `admin_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
    return response;
}
