import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and API Route Handlers.
 *
 * Reads session cookies from the Next.js request context via the
 * dynamic cookies() function. Must be called per-request (never cached
 * at module scope) because each request has its own cookie jar.
 *
 * This uses the ANON key — Row Level Security policies apply.
 * For admin/service operations that bypass RLS, use createServiceClient().
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component context where
            // cookies cannot be modified. This is expected — the
            // middleware handles cookie refresh before we get here.
            // The try/catch prevents the error from bubbling up.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client with the SERVICE ROLE key.
 * Bypasses ALL Row Level Security. Use ONLY in trusted server contexts
 * (API routes, server actions) where you need admin-level DB access.
 *
 * NEVER import this in client components or expose its key.
 */
export async function createServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Safe to ignore in read-only server component context
          }
        },
      },
    }
  )
}
