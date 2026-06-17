import { redirect } from '@tanstack/react-router'
import { supabase } from '#/lib/supabase'

/**
 * Ensure the user is authenticated for SSR loaders.
 * Returns the session object if present, otherwise throws a redirect to `/login`.
 * This centralises auth‑guard logic so it can be reused across all route loaders.
 */
export async function requireAuth() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    // TanStack Router's `redirect` works both on the server and client.
    throw redirect({ to: '/login' })
  }

  return session
}
