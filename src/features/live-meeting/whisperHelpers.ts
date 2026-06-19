// Helper utilities for Whisper streaming logic

export const normalizeToken = (word: string) =>
  word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

export const wordsOf = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean)

export const cleanText = (text: string) =>
  text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

export const collapseAdjacentDuplicates = (text: string) => {
  const words = wordsOf(text)
  const out: string[] = []

  for (const word of words) {
    const prev = out[out.length - 1]
    if (!prev || normalizeToken(prev) !== normalizeToken(word)) out.push(word)
  }

  return out.join(' ')
}

export const mergeChunk = (existing: string, incoming: string) => {
  const left = wordsOf(existing)
  const right = wordsOf(collapseAdjacentDuplicates(incoming))

  if (!left.length) return right.join(' ')
  if (!right.length) return existing.trim()

  const maxOverlap = Math.min(12, left.length, right.length)

  for (let overlap = maxOverlap; overlap >= 1; overlap--) {
    let matched = true

    for (let i = 0; i < overlap; i++) {
      if (
        normalizeToken(left[left.length - overlap + i]) !==
        normalizeToken(right[i])
      ) {
        matched = false
        break
      }
    }

    if (matched) return [...left, ...right.slice(overlap)].join(' ')
  }

  return [...left, ...right].join(' ')
}

export const removeOverlap = (existing: string, incoming: string) => {
  const left = wordsOf(existing)
  const right = wordsOf(incoming)

  if (!left.length) return right.join(' ')
  if (!right.length) return ''

  const maxOverlap = Math.min(12, left.length, right.length)

  for (let overlap = maxOverlap; overlap >= 1; overlap--) {
    let matched = true

    for (let i = 0; i < overlap; i++) {
      if (
        normalizeToken(left[left.length - overlap + i]) !==
        normalizeToken(right[i])
      ) {
        matched = false
        break
      }
    }

    if (matched) return right.slice(overlap).join(' ')
  }

  return right.join(' ')
}

export const buildTranscriptFromResults = (
  results: { type?: string; alternatives?: { content?: string }[] }[] = [],
) => {
  let text = ''

  for (const result of results) {
    const alt = result.alternatives?.[0]
    const content = alt?.content?.trim()
    if (!content) continue

    if (result.type === 'punctuation') {
      text += content
      continue
    }

    if (text && !text.endsWith(' ')) text += ' '
    text += content
  }

  return cleanText(text)
}

export const dominantSpeaker = (
  results: { type?: string; alternatives?: { speaker?: string }[] }[],
): string | null => {
  const counts: Record<string, number> = {}

  for (const result of results) {
    if (result.type === 'punctuation') continue
    const speaker = result.alternatives?.[0]?.speaker
    if (speaker) counts[speaker] = (counts[speaker] ?? 0) + 1
  }

  let best: string | null = null
  let bestCount = 0

  for (const [speaker, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = speaker
      bestCount = count
    }
  }

  return best
}
