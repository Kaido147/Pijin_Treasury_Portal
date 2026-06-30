import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in browser-side Client Components.
 *
 * Uses ONLY public env vars (NEXT_PUBLIC_*) which are safe to inline
 * into the client JS bundle. Session tokens are read/written via
 * document.cookie automatically by @supabase/ssr.
 *
 * Usage: call createClient() inside Client Components or custom hooks.
 * Do NOT call this in server components or API routes.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
