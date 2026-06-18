import { Link, useNavigate } from '@tanstack/react-router'
import { History } from 'lucide-react'
import AvatarDropdown from '#/components/AvatarDropdown'
import { useAuth } from '#/features/auth/AuthContext'
import { supabase } from '#/lib/supabase'

interface HeaderProps {
  /** Show LIVE/IDLE indicator when true/false; omit when undefined */
  active?: boolean
  /** Optional extra elements (e.g., chat button) placed next to the indicator */
  children?: React.ReactNode
}

export default function Header({ active, children }: HeaderProps) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="fixed bg-zinc-900/60 backdrop-blur-sm z-1 top-0 left-0 right-0 px-6 pt-6 pb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {typeof active === 'boolean' && (
          <>
            <div className="relative">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  active ? 'bg-green-400' : 'bg-zinc-600'
                }`}
              />
              {active && (
                <div className="absolute inset-0 rounded-full bg-green-400 animate-ping" />
              )}
            </div>
            <span className="text-sm text-zinc-400 uppercase tracking-wider font-semibold">
              {active ? 'LIVE' : 'IDLE'}
            </span>
          </>
        )}
        {children}
      </div>
      <div className="flex items-center gap-2">
        <Link
          to="/meetings"
          className="p-2 text-zinc-500 hover:text-white bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-md transition-all duration-200"
          title="Past Meetings"
        >
          <History className="w-6 h-6" />
        </Link>
        {user && <AvatarDropdown user={user} onLogout={handleLogout} />}
      </div>
    </div>
  )
}
