import type { TranscriptSegment } from '../types'
import { removeOverlap, collapseAdjacentDuplicates } from '../whisperHelpers'

/**
 * Flushes the current sentence buffer into a transcript segment.
 */
export function flushSentence(
  sentenceBufferRef: React.MutableRefObject<string>,
  sentenceStartRef: React.MutableRefObject<number | null>,
  sentenceSpeakerRef: React.MutableRefObject<string | null>,
  transcriptLinesRef: React.MutableRefObject<TranscriptSegment[]>,
  setSegments: (v: TranscriptSegment[]) => void,
  setLiveText: (v: string) => void,
  setLiveSpeaker: (v: string | null) => void,
) {
  let text = sentenceBufferRef.current.trim()
  if (!text) return
  const lastText = transcriptLinesRef.current.at(-1)?.text ?? ''
  text = removeOverlap(lastText, text)
  text = collapseAdjacentDuplicates(text)
  if (!text) {
    sentenceBufferRef.current = ''
    sentenceStartRef.current = null
    sentenceSpeakerRef.current = null
    setLiveText('')
    setLiveSpeaker(null)
    return
  }
  const start = sentenceStartRef.current ?? 0
  const speaker = sentenceSpeakerRef.current || undefined
  const segment: TranscriptSegment = { start, end: start, text, speaker }
  transcriptLinesRef.current.push(segment)
  setSegments([...transcriptLinesRef.current])
  setLiveText('')
  setLiveSpeaker(null)
  sentenceBufferRef.current = ''
  sentenceStartRef.current = null
  sentenceSpeakerRef.current = null
}
