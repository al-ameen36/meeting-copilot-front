import { useRef, useState, useCallback } from 'react'
import { useAuth } from '#/features/auth/AuthContext'
import { createMeeting, addSegment } from '#/lib/localdb/transcriptStore'

type AudioSource = 'mic' | 'tab'

type TranscriptSegment = {
  start: number
  end: number
  text: string
  speaker?: string
}

type SpeechmaticsAlternative = {
  content?: string
  speaker?: string
}

type SpeechmaticsResult = {
  type?: string
  attaches_to?: string
  alternatives?: SpeechmaticsAlternative[]
}

const normalizeToken = (word: string) =>
  word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

const wordsOf = (text: string) => text.trim().split(/\s+/).filter(Boolean)

const cleanSpacedText = (text: string) =>
  text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

const collapseAdjacentDuplicates = (text: string) => {
  const words = wordsOf(text)
  const out: string[] = []

  for (const word of words) {
    const prev = out[out.length - 1]
    if (!prev || normalizeToken(prev) !== normalizeToken(word)) {
      out.push(word)
    }
  }

  return out.join(' ')
}

const mergeChunk = (existing: string, incoming: string) => {
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

    if (matched) {
      return [...left, ...right.slice(overlap)].join(' ')
    }
  }

  return [...left, ...right].join(' ')
}

const removeOverlap = (existing: string, incoming: string) => {
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

    if (matched) {
      return right.slice(overlap).join(' ')
    }
  }

  return right.join(' ')
}

const buildTranscriptFromResults = (results: SpeechmaticsResult[] = []) => {
  let text = ''

  for (const result of results) {
    const alt = result.alternatives?.[0]
    const content = alt?.content?.trim()
    if (!content) continue

    if (result.type === 'punctuation') {
      text += content
      continue
    }

    if (text && !text.endsWith(' ')) {
      text += ' '
    }

    text += content
  }

  return cleanSpacedText(text)
}

// Returns the speaker label that appears most frequently across word results.
// Punctuation tokens are skipped since they inherit speaker from adjacent words.
const dominantSpeaker = (results: SpeechmaticsResult[]): string | null => {
  const counts: Record<string, number> = {}

  for (const result of results) {
    if (result.type === 'punctuation') continue
    const speaker = result.alternatives?.[0]?.speaker
    if (typeof speaker === 'string' && speaker) {
      counts[speaker] = (counts[speaker] ?? 0) + 1
    }
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

export function useWhisperStream() {
  const { session } = useAuth()

  const [active, setActive] = useState(false)
  const [source, setSource] = useState<AudioSource>('mic')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [liveText, setLiveText] = useState('')
  const [liveSpeaker, setLiveSpeaker] = useState<string | null>(null)
  const [meetingId, setMeetingId] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  const transcriptLinesRef = useRef<TranscriptSegment[]>([])
  const sentenceBufferRef = useRef('')
  const sentenceStartRef = useRef<number | null>(null)
  const sentenceSpeakerRef = useRef<string | null>(null)
  const cleanedUpRef = useRef(false)
  const isActiveRef = useRef(false)
  const meetingIdRef = useRef<string | null>(null)

  const getAudioStream = async (selectedSource: AudioSource) => {
    if (selectedSource === 'mic') {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      return { tabStream: stream, micStream: null }
    }

    // For tab capture: get the tab audio + a separate mic stream and mix them.
    // getDisplayMedia must be called first (requires a direct user gesture).
    const tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })

    let micStream: MediaStream | null = null
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      // Mic permission denied or unavailable — proceed with tab audio only.
      console.warn(
        'Mic unavailable for tab capture, using tab audio only:',
        err,
      )
    }

    return { tabStream, micStream }
  }

  const flushSentence = useCallback((endTime: number) => {
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

    const startTime = sentenceStartRef.current ?? endTime
    const speaker = sentenceSpeakerRef.current || undefined

    const segment: TranscriptSegment = {
      start: startTime,
      end: endTime,
      text,
      speaker,
    }

    transcriptLinesRef.current.push(segment)
    setSegments([...transcriptLinesRef.current])
    setLiveText('')
    setLiveSpeaker(null)

    if (meetingIdRef.current) {
      void addSegment({
        id: crypto.randomUUID(),
        meetingId: meetingIdRef.current,
        start: startTime,
        end: endTime,
        text,
        speaker,
      })
    }

    sentenceBufferRef.current = ''
    sentenceStartRef.current = null
    sentenceSpeakerRef.current = null
  }, [])

  const cleanup = useCallback(async () => {
    if (cleanedUpRef.current) return
    cleanedUpRef.current = true
    isActiveRef.current = false

    try {
      sourceNodeRef.current?.disconnect()
    } catch {}
    try {
      workletNodeRef.current?.disconnect()
    } catch {}
    try {
      await audioCtxRef.current?.close()
    } catch {}

    streamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())

    socketRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
    micStreamRef.current = null
    sourceNodeRef.current = null
    workletNodeRef.current = null
    meetingIdRef.current = null

    setActive(false)
  }, [])

  const stop = useCallback(() => {
    const fallbackEnd =
      sentenceStartRef.current ?? transcriptLinesRef.current.at(-1)?.end ?? 0

    if (sentenceBufferRef.current.trim()) {
      flushSentence(fallbackEnd)
    }

    socketRef.current?.close()
    void cleanup()
  }, [cleanup, flushSentence])

  const start = useCallback(
    async (selectedSource: AudioSource = source) => {
      if (!session?.access_token) return

      cleanedUpRef.current = false
      isActiveRef.current = true

      transcriptLinesRef.current = []
      sentenceBufferRef.current = ''
      sentenceStartRef.current = null
      sentenceSpeakerRef.current = null

      setSegments([])
      setLiveText('')
      setLiveSpeaker(null)
      setMeetingId(null)
      setSource(selectedSource)

      const localMeetingId = crypto.randomUUID()
      meetingIdRef.current = localMeetingId
      setMeetingId(localMeetingId)

      void createMeeting({
        id: localMeetingId,
        title: 'Local meeting',
        createdAt: Date.now(),
      })

      const socket = new WebSocket(import.meta.env.VITE_WHISPER_SERVER_URL)
      socketRef.current = socket

      const beginAudio = async () => {
        let tabStream: MediaStream
        let micStream: MediaStream | null = null

        try {
          ;({ tabStream, micStream } = await getAudioStream(selectedSource))
        } catch (err) {
          console.warn('Audio permission/device error:', err)
          stop()
          return
        }

        if (!isActiveRef.current) {
          tabStream.getTracks().forEach((t) => t.stop())
          micStream?.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = tabStream
        micStreamRef.current = micStream

        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioCtxRef.current = audioCtx

        const workletCode = `
          class VowProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0]
              if (input && input[0]) {
                this.port.postMessage(input[0].buffer)
              }
              return true
            }
          }
          registerProcessor('vow-processor', VowProcessor)
        `

        const blob = new Blob([workletCode], { type: 'application/javascript' })
        const url = URL.createObjectURL(blob)
        await audioCtx.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)

        const workletNode = new AudioWorkletNode(audioCtx, 'vow-processor')
        workletNodeRef.current = workletNode

        const tabSource = audioCtx.createMediaStreamSource(tabStream)
        sourceNodeRef.current = tabSource

        if (micStream) {
          // Mix tab audio and mic into a single stream via a destination node,
          // then pipe the merged output into the worklet.
          const destination = audioCtx.createMediaStreamDestination()
          tabSource.connect(destination)

          const micSource = audioCtx.createMediaStreamSource(micStream)
          micSource.connect(destination)

          const mergedSource = audioCtx.createMediaStreamSource(
            destination.stream,
          )
          mergedSource.connect(workletNode)
        } else {
          // Mic unavailable — wire tab audio directly.
          tabSource.connect(workletNode)
        }

        workletNode.port.onmessage = (event) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(event.data)
          }
        }

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        setActive(true)
      }

      socket.onopen = () => {
        socket.send(JSON.stringify({ token: session.access_token }))
      }

      socket.onmessage = async (event) => {
        if (!isActiveRef.current) return

        try {
          const data = JSON.parse(event.data as string)

          if (data.message === 'auth_ok') {
            await beginAudio()
            return
          }

          const results: SpeechmaticsResult[] = Array.isArray(data?.results)
            ? data.results
            : []
          const fallbackText = data?.metadata?.transcript?.trim() || ''
          const text = buildTranscriptFromResults(results) || fallbackText
          if (!text) return

          const speaker = dominantSpeaker(results)

          if (data.message === 'AddPartialTranscript') {
            const preview = mergeChunk(sentenceBufferRef.current, text)
            if (speaker) sentenceSpeakerRef.current = speaker
            setLiveText(preview)
            setLiveSpeaker(speaker ?? sentenceSpeakerRef.current)
            return
          }

          if (data.message === 'AddTranscript') {
            const startTime = data?.metadata?.start_time ?? 0
            const endTime = data?.metadata?.end_time ?? startTime

            if (sentenceStartRef.current === null) {
              sentenceStartRef.current = startTime
            }

            if (speaker) sentenceSpeakerRef.current = speaker

            sentenceBufferRef.current = mergeChunk(
              sentenceBufferRef.current,
              text,
            )
            setLiveText(sentenceBufferRef.current.trim())
            setLiveSpeaker(sentenceSpeakerRef.current)

            if (/[.!?]\s*$/.test(sentenceBufferRef.current.trim())) {
              flushSentence(endTime)
            }
          }
        } catch {
          // ignore malformed packets
        }
      }

      socket.onerror = (err) => {
        console.error('[WS] socket error', err)
      }

      socket.onclose = () => {
        void cleanup()
      }
    },
    [cleanup, flushSentence, session?.access_token, source, stop],
  )

  return {
    active,
    segments,
    liveText,
    liveSpeaker,
    start,
    stop,
    source,
    meetingId,
  }
}
