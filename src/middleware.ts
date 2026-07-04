import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/infrastructure/supabase/middleware'

// ═══════════════════════════════════════════════════════════
// Route Definitions
// ═══════════════════════════════════════════════════════════

/**
 * Routes accessible WITHOUT authentication.
 * Users hitting these paths will NOT be redirected to login.
 */
const PUBLIC_ROUTES = [
  '/login',
  '/auth/callback',
]

/**
 * Routes that require authentication.
 * Unauthenticated users will be redirected to /login.
 * Uses startsWith matching so /command-center/settings also matches.
 */
const PROTECTED_ROUTE_PREFIXES = [
  '/command-center',
  '/gateway-ops',
  '/ledger',
  '/fund-node',
]

/**
 * Paths that middleware should completely ignore.
 * Static assets, API routes (they handle their own auth via JWT),
 * and Next.js internals.
 */
const IGNORED_PREFIXES = [
  '/api/',
  '/_next/',
  '/favicon.ico',
]

// ═══════════════════════════════════════════════════════════
// Middleware Handler
// ═══════════════════════════════════════════════════════════

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes, static files, and Next.js internals
  if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  // Refresh Supabase session and sync cookies
  const { user, supabaseResponse } = await updateSession(request)

  // Check if current path is public
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname === route)

  // Check if current path is protected
  const isProtectedRoute = PROTECTED_ROUTE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login page
  if (user && isPublicRoute && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/command-center'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: Always return supabaseResponse, not NextResponse.next().
  // supabaseResponse carries the refreshed cookie headers.
  // Returning a plain NextResponse.next() would discard them.
  return supabaseResponse
}

// ═══════════════════════════════════════════════════════════
// Middleware Matcher Config
// ═══════════════════════════════════════════════════════════

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets (images, SVGs, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
