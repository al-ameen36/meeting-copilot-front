import { useRef, useState, useCallback } from 'react'
import { useAuth } from '#/features/auth/AuthContext'
import { createMeeting, addSegment } from '#/lib/localdb/transcriptStore'

type AudioSource = 'mic' | 'tab'

type TranscriptSegment = {
  start: number
  end: number
  text: string
}

const normalizeToken = (word: string) =>
  word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')

const wordsOf = (text: string) => text.trim().split(/\s+/).filter(Boolean)

// Removes immediate duplicate words inside a single chunk.
// Example: "I I think think so" -> "I think so"
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

// Merges a new STT chunk into the existing buffer by removing overlap.
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

// Remove overlapping prefix of `incoming` that duplicates a suffix of `existing`.
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

export function useWhisperStream() {
  const { session } = useAuth()

  const [active, setActive] = useState(false)
  const [source, setSource] = useState<AudioSource>('mic')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [liveText, setLiveText] = useState('')
  const [meetingId, setMeetingId] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)

  const transcriptLinesRef = useRef<TranscriptSegment[]>([])
  const sentenceBufferRef = useRef('')
  const sentenceStartRef = useRef<number | null>(null)
  const cleanedUpRef = useRef(false)
  const isActiveRef = useRef(false)
  const meetingIdRef = useRef<string | null>(null)

  const getAudioStream = (selectedSource: AudioSource) => {
    if (selectedSource === 'mic') {
      return navigator.mediaDevices.getUserMedia({ audio: true })
    }
    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  }

  const flushSentence = useCallback((endTime: number) => {
    let text = sentenceBufferRef.current.trim()
    if (!text) return

    // Trim overlap against the last committed segment to avoid merged repeats
    const lastText = transcriptLinesRef.current.at(-1)?.text ?? ''
    text = removeOverlap(lastText, text)
    if (!text) {
      // nothing new after trimming
      sentenceBufferRef.current = ''
      sentenceStartRef.current = null
      setLiveText('')
      return
    }

    const startTime = sentenceStartRef.current ?? endTime

    // Normalize / collapse adjacent duplicates before storing/display
    const finalText = collapseAdjacentDuplicates(text)

    const segment: TranscriptSegment = {
      start: startTime,
      end: endTime,
      text: finalText,
    }

    transcriptLinesRef.current.push(segment)
    setSegments([...transcriptLinesRef.current])
    setLiveText('')

    if (meetingIdRef.current) {
      void addSegment({
        id: crypto.randomUUID(),
        meetingId: meetingIdRef.current,
        start: startTime,
        end: endTime,
        text: finalText,
      })
    }

    sentenceBufferRef.current = ''
    sentenceStartRef.current = null
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

    socketRef.current = null
    audioCtxRef.current = null
    streamRef.current = null
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

      setSegments([])
      setLiveText('')
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
        let stream: MediaStream
        try {
          stream = await getAudioStream(selectedSource)
        } catch (err) {
          console.warn('Audio permission/device error:', err)
          stop()
          return
        }

        if (!isActiveRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream

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

        const blob = new Blob([workletCode], {
          type: 'application/javascript',
        })
        const url = URL.createObjectURL(blob)
        await audioCtx.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)

        const sourceNode = audioCtx.createMediaStreamSource(stream)
        const workletNode = new AudioWorkletNode(audioCtx, 'vow-processor')

        sourceNodeRef.current = sourceNode
        workletNodeRef.current = workletNode

        workletNode.port.onmessage = (event) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(event.data)
          }
        }

        sourceNode.connect(workletNode)

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

          const text = data?.metadata?.transcript?.trim()
          if (!text) return

          if (data.message === 'AddPartialTranscript') {
            const preview = mergeChunk(sentenceBufferRef.current, text)
            setLiveText(preview)
            return
          }

          if (data.message === 'AddTranscript') {
            const startTime = data?.metadata?.start_time ?? 0
            const endTime = data?.metadata?.end_time ?? startTime

            if (sentenceStartRef.current === null) {
              sentenceStartRef.current = startTime
            }

            sentenceBufferRef.current = mergeChunk(
              sentenceBufferRef.current,
              text,
            )
            setLiveText(sentenceBufferRef.current.trim())

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
    start,
    stop,
    source,
    meetingId,
  }
}
