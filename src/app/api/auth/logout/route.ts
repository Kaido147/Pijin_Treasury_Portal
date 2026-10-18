import { NextResponse } from 'next/server';
import { clearPortalSessionCookie } from '@/infrastructure/auth/session';

export async function POST() {
    const response = NextResponse.json({ success: true });
    clearPortalSessionCookie(response);
    response.headers.append(
        'Set-Cookie',
        `admin_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    );
    return response;
}
