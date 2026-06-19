interface Segment {
  start: number
  end: number
  text: string
}

const TIME_RE = /^(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/

/** Parses "HH:MM:SS,mmm" or "HH:MM:SS.mmm" into seconds. Returns 0 if malformed. */
function parseTimestamp(t: string): number {
  const m = TIME_RE.exec(t.trim())
  if (!m) return 0
  const [, h, min, s, ms] = m
  return Number(h) * 3600 + Number(min) * 60 + Number(s) + Number(ms) / 1000
}

function formatTime(seconds: number): string {
  const totalMs = Math.floor(seconds * 1000)
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  return (
    `${pad(Math.floor(totalMs / 3600000))}:` +
    `${pad(Math.floor((totalMs % 3600000) / 60000))}:` +
    `${pad(Math.floor((totalMs % 60000) / 1000))},` +
    `${pad(totalMs % 1000, 3)}`
  )
}

/** Generates SRT subtitle text from transcript segments (seconds + text). */
export function generateSrt(segments: Segment[]): string {
  return (
    segments
      .map(
        (seg, i) =>
          `${i + 1}\n${formatTime(seg.start)} --> ${formatTime(seg.end)}\n${seg.text}`,
      )
      .join('\n\n') + '\n'
  )
}

/** Parses SRT subtitle text into { start, end, text } segments (seconds). */
export function parseSrt(srt: string): Segment[] {
  return srt
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((entry) => entry.split('\n').filter((l) => l.trim() !== ''))
    .filter((lines) => lines.length >= 3)
    .map((lines) => {
      const [startStr, endStr] = lines[1].split(' --> ').map((s) => s.trim())
      return {
        start: parseTimestamp(startStr),
        end: parseTimestamp(endStr),
        text: lines.slice(2).join('\n'),
      }
    })
}

/** Parses WebVTT text (optional header/cue ids ignored) into the same segment shape. */
export function parseVtt(vtt: string): Segment[] {
  const lines = vtt.split(/\r?\n/)
  const result: Segment[] = []
  let i = lines[0]?.startsWith('WEBVTT') ? 1 : 0

  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++
      continue
    }
    if (!TIME_RE.test(lines[i])) i++ // skip optional cue identifier
    if (i >= lines.length) break

    const [startStr, endStr] = lines[i]
      .split(' --> ')
      .map((t) => t.split(' ')[0])
    i++

    const textLines: string[] = []
    while (i < lines.length && lines[i].trim()) {
      textLines.push(lines[i])
      i++
    }
    result.push({
      start: parseTimestamp(startStr),
      end: parseTimestamp(endStr),
      text: textLines.join('\n'),
    })
    i++ // skip blank line after cue
  }

  return result
}
