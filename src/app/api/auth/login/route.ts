import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSql } from '@/infrastructure/db/sql';
import {
  applyPortalSessionCookie,
  sessionMaxAgeSeconds,
  signPortalSession,
} from '@/infrastructure/auth/session';

type LoginBody = {
  email?: string;
  password?: string;
  keepSignedIn?: boolean;
};

/**
 * Email and password live in public.portal_users.
 * Those rows were copied from the old Supabase Auth users.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase() ?? '';
    const password = body.password ?? '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const sql = getSql();
    const rows = await sql`
      SELECT id, email, password_hash
      FROM public.portal_users
      WHERE lower(email) = ${email}
      LIMIT 1
    `;

    const account = rows[0] as { id: string; email: string; password_hash: string } | undefined;
    const passwordMatches = account
      ? await bcrypt.compare(password, account.password_hash)
      : false;

    if (!account || !passwordMatches) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const maxAgeSeconds = sessionMaxAgeSeconds(body.keepSignedIn === true);
    const token = await signPortalSession(
      { id: account.id, email: account.email },
      maxAgeSeconds,
    );

    const response = NextResponse.json({ success: true });
    applyPortalSessionCookie(response, token, maxAgeSeconds);
    return response;
  } catch (error) {
    console.error('login error:', error);
    return NextResponse.json({ error: 'Sign in failed.' }, { status: 500 });
  }
}
