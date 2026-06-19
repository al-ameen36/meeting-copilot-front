import { supabase } from '#/lib/supabase'
import type { Session } from '@supabase/supabase-js'

/**
 * Extract Supabase session from the incoming SSR request.
 * This adapter isolates the SSR cookie parsing logic behind a clear seam.
 * It reads the `sb-access-token` cookie (the default name used by Supabase JS),
 * injects it into the client via `supabase.auth.setAuth`, then returns the session.
 *
 * In environments where the cookie name differs or additional tokens are needed,
 * adjust the parsing logic accordingly.
 */
export async function getSessionFromRequest(
  request: Request,
): Promise<Session | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((part) => {
        const [key, ...rest] = part.trim().split('=')
        return [key, rest.join('=')]
      }),
    )
    const accessToken =
      cookies['sb-access-token'] || cookies['supabase-auth-token']
    if (accessToken) {
      // Set token for this client instance
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
      })
    }
    const { data } = await supabase.auth.getSession()
    return data.session ?? null
  } catch (err) {
    console.error('Failed to get session from request', err)
    return null
  }
}
