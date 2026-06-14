import { useRef, useState, useCallback } from 'react'
import { useAuth } from '#/features/auth/AuthContext'
import { supabase } from '#/lib/supabase'

type AudioSource = 'mic' | 'tab'

type TranscriptSegment = {
  start: number
  end: number
  text: string
}

const removeOverlap = (base: string, partial: string) => {
  const cleanBase = base.trim()
  const cleanPartial = partial.trim()

  if (!cleanBase || !cleanPartial) return cleanPartial

  const baseWords = cleanBase.split(/\s+/)

  for (let i = baseWords.length; i > 0; i--) {
    const overlap = baseWords.slice(-i).join(' ')
    if (cleanPartial.startsWith(overlap)) {
      return cleanPartial.slice(overlap.length).trim()
    }
  }

  return cleanPartial
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
  const partialRef = useRef('')
  const cleanedUpRef = useRef(false)
  const isActiveRef = useRef(false)

  const getAudioStream = (selectedSource: AudioSource) => {
    if (selectedSource === 'mic') {
      return navigator.mediaDevices.getUserMedia({ audio: true })
    }

    return navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
  }

  const updateTranscript = useCallback(() => {
    const finalSegments = transcriptLinesRef.current

    setSegments([...finalSegments])

    const liveBase = sentenceBufferRef.current.trim()
    const livePartial = partialRef.current.trim()
    const cleanPartial = removeOverlap(liveBase, livePartial)
    const combinedLive = [liveBase, cleanPartial]
      .filter(Boolean)
      .join(' ')
      .trim()

    setLiveText(combinedLive)
  }, [])

  const flushSentence = useCallback(
    (endTime: number) => {
      const text = sentenceBufferRef.current.trim()
      if (!text) return

      transcriptLinesRef.current.push({
        start: sentenceStartRef.current ?? endTime,
        end: endTime,
        text,
      })

      sentenceBufferRef.current = ''
      sentenceStartRef.current = null
      updateTranscript()
    },
    [updateTranscript],
  )

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
      partialRef.current = ''

      setSegments([])
      setLiveText('')

      setMeetingId(null)
      setSource(selectedSource)

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

        const blob = new Blob([workletCode], { type: 'application/javascript' })
        const url = URL.createObjectURL(blob)

        await audioCtx.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)

        if (!isActiveRef.current) {
          await audioCtx.close().catch(() => {})
          return
        }

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

      socket.onopen = async () => {
        socket.send(JSON.stringify({ token: session.access_token }))
      }

      socket.onmessage = async (event) => {
        if (!isActiveRef.current) return

        try {
          const data = JSON.parse(event.data as string)
          if (data.message === 'auth_ok') {
            // The backend creates a new meeting row just before sending auth_ok.
            // Since we can't change the backend payload, we query the latest meeting.
            const { data: latestMeeting } = await supabase
              .from('meetings')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (latestMeeting) {
              setMeetingId(latestMeeting.id)
            }

            await beginAudio()
            return
          }

          // insights removed: we no longer handle Insight messages

          const text = data?.metadata?.transcript?.trim()
          if (!text) return

          if (data.message === 'AddPartialTranscript') {
            partialRef.current = text
            updateTranscript()
            return
          }

          if (data.message === 'AddTranscript') {
            const startTime = data?.metadata?.start_time ?? 0
            const endTime = data?.metadata?.end_time ?? startTime
            const payloadMeetingId = data?.metadata?.meeting_id

            setMeetingId((prev) => prev || payloadMeetingId || null)

            if (sentenceStartRef.current === null) {
              sentenceStartRef.current = startTime
            }

            sentenceBufferRef.current = sentenceBufferRef.current
              ? `${sentenceBufferRef.current} ${text}`
              : text

            const chunkLooksComplete =
              sentenceBufferRef.current.length >= 80 &&
              (/[.!?]\s*$/.test(sentenceBufferRef.current) || text.length < 3)

            if (chunkLooksComplete) {
              flushSentence(endTime)
            } else {
              updateTranscript()
            }

            partialRef.current = ''
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
    [
      cleanup,
      flushSentence,
      session?.access_token,
      source,
      stop,
      updateTranscript,
    ],
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
