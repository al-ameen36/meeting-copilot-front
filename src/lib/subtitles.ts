/**
 * Generate SRT subtitle data from transcript segments.
 * Each segment must contain `start` and `end` in seconds and `text`.
 */
export function generateSrt(segments: { start: number; end: number; text: string }[]): string {
  const formatTime = (seconds: number) => {
    const totalMs = Math.floor(seconds * 1000)
    const hrs = Math.floor(totalMs / 3600000)
    const mins = Math.floor((totalMs % 3600000) / 60000)
    const secs = Math.floor((totalMs % 60000) / 1000)
    const ms = totalMs % 1000
    const pad = (n: number, len = 2) => String(n).padStart(len, '0')
    const padMs = (n: number) => String(n).padStart(3, '0')
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${padMs(ms)}`
  }

  return segments
    .map((seg, i) => {
      return `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}`
    })
    .join('\n\n') + '\n'
}
