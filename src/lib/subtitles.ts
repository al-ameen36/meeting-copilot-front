/**
 * Generate WebVTT subtitle data from transcript segments.
 * Each segment must contain `start` and `end` in seconds and `text`.
 */
export function generateVtt(segments: { start: number; end: number; text: string }[]): string {
  const formatTime = (seconds: number) => {
    const s = Math.floor(seconds)
    const ms = Math.floor((seconds - s) * 1000)
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    const pad = (n: number, len = 2) => String(n).padStart(len, '0')
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`
  }

  let vtt = 'WEBVTT\n\n'
  segments.forEach((seg, i) => {
    vtt += `${i + 1}\n`
    vtt += `${formatTime(seg.start)} --> ${formatTime(seg.end)}\n`
    vtt += `${seg.text}\n\n`
  })
  return vtt
}
