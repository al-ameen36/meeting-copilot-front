import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client with session persistence.
 *
 * - `persistSession: true` ensures the auth session is stored in the browser's
 *   storage (localStorage) and automatically restored on page reloads.
 * - `autoRefreshToken: true` refreshes the JWT when needed.
 * - `storage` is only defined in the browser environment; on the server (SSR)
 *   we leave it undefined because the client cannot access `localStorage`.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window !== 'undefined' ? localStorage : undefined,
    },
  },
)
