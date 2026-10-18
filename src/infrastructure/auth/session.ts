import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** HttpOnly cookie that replaces the old Supabase Auth session. */
export const PORTAL_SESSION_COOKIE = 'portal_session';

export type PortalUser = {
  id: string;
  email: string;
};

const SESSION_HOURS = 12;
const REMEMBER_DAYS = 30;

export function sessionMaxAgeSeconds(keepSignedIn: boolean): number {
  return keepSignedIn ? REMEMBER_DAYS * 24 * 60 * 60 : SESSION_HOURS * 60 * 60;
}

function sessionSecret() {
  const value = process.env.JWT_SECRET_KEY;
  if (!value) throw new Error('JWT_SECRET_KEY is not defined');
  return new TextEncoder().encode(value);
}

export async function signPortalSession(user: PortalUser, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(sessionSecret());
}

export async function readPortalUserFromToken(token: string | undefined): Promise<PortalUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** Reads the sign-in cookie in a Route Handler or Server Component. */
export async function getPortalUser(): Promise<PortalUser | null> {
  const cookieStore = await cookies();
  return readPortalUserFromToken(cookieStore.get(PORTAL_SESSION_COOKIE)?.value);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export function applyPortalSessionCookie(response: NextResponse, token: string, maxAgeSeconds: number) {
  response.cookies.set(PORTAL_SESSION_COOKIE, token, cookieOptions(maxAgeSeconds));
}

export function clearPortalSessionCookie(response: NextResponse) {
  response.cookies.set(PORTAL_SESSION_COOKIE, '', cookieOptions(0));
}
