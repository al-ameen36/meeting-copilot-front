import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(seconds: number | null | undefined) {
  if (!seconds) return

  seconds = Math.floor(seconds)

  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0')
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  return `${hrs}:${mins}:${secs}`
}

/** Format a Date or ISO string to a short locale date (e.g. `Jan 1, 2023`) */
export function formatDate(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Format a Date or ISO string to a locale time string (e.g. `02:34 PM`) */
export function formatDateTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Return short month abbreviation (e.g. `Jan`) */
export function formatMonthAbbr(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString(undefined, { month: 'short' })
}
