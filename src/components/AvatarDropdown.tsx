import { useState, useRef, useEffect } from 'react'
import { cn } from '#/lib/utils'
import type { User } from '@supabase/supabase-js'

interface AvatarDropdownProps {
  user: User | null
  onLogout: () => Promise<void> | void
}

export default function AvatarDropdown({
  user,
  onLogout,
}: AvatarDropdownProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)

  // close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = user?.email?.[0].toUpperCase() ?? '?' // fallback

  return (
    <div className="relative" ref={btnRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full bg-cyan-600 text-white',
          'hover:bg-cyan-500 focus:outline-none',
        )}
        title="Account"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-md bg-zinc-900 border border-zinc-800 shadow-lg z-10">
          <div className="p-3">
            <div className="text-sm text-zinc-400 mb-2">{user?.email}</div>
            <button
              onClick={() => {
                setOpen(false)
                onLogout()
              }}
              className={cn(
                'w-full text-left px-2 py-1 text-sm text-zinc-200 hover:bg-zinc-800 rounded',
              )}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
