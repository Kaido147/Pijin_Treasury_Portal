import { NextResponse } from 'next/server';

export async function POST() {
    // Clear Gate 2 wallet JWT cookie only
    const response = NextResponse.json({ success: true });
    response.headers.append(
        'Set-Cookie',
        `admin_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
    return response;
}
