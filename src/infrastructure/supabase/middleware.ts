import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Updates the Supabase session by refreshing expired auth tokens
 * and synchronizing cookie state between the request and response.
 *
 * This is the CRITICAL session synchronization point. Here's why:
 *
 * 1. User's browser sends request with auth cookies
 * 2. Supabase checks if the access token is expired
 * 3. If expired, Supabase uses the refresh token to get new tokens
 * 4. New tokens must be written to BOTH:
 *    a) The response (so the browser stores the updated cookies)
 *    b) The request headers (so downstream server components
 *       read the FRESH tokens, not the stale ones)
 *
 * Without step 4b, server components would read the old expired
 * token from the original request, fail auth checks, and think
 * the user is logged out — even though the middleware just
 * refreshed the session successfully.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Step 1: Write updated cookies into the request headers
          // so downstream server components see fresh tokens
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          // Step 2: Create a new response that carries the modified
          // request (with updated cookie headers) forward
          supabaseResponse = NextResponse.next({
            request,
          })

          // Step 3: Write updated cookies into the response headers
          // so the browser stores the refreshed tokens
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // IMPORTANT: Do NOT call supabase.auth.signOut() or
  // supabase.auth.updateUser() here. Only getUser() is safe
  // in middleware context. getUser() triggers the token refresh
  // cycle which fires the setAll callback above if tokens changed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { user, supabaseResponse }
}
