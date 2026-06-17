import { useRef, useState, useCallback } from 'react'
import { useAuth } from '#/features/auth/AuthContext'
import { createMeeting, addSegment } from '#/lib/localdb/transcriptStore'

import {
  collapseAdjacentDuplicates,
  mergeChunk,
  removeOverlap,
  buildTranscriptFromResults,
  dominantSpeaker,
} from './whisperHelpers'
import { getAudioStreams, VOW_PROCESSOR_CODE } from './audioSetup'

import type {
  AudioSource,
  TranscriptSegment,
  SpeechmaticsAlternative,
  SpeechmaticsResult,
} from './types'

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
  const displayStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const inputNodesRef = useRef<AudioNode[]>([])

  const transcriptLinesRef = useRef<TranscriptSegment[]>([])
  const sentenceBufferRef = useRef('')
  const sentenceStartRef = useRef<number | null>(null)
  const sentenceSpeakerRef = useRef<string | null>(null)
  const cleanedUpRef = useRef(false)
  const isActiveRef = useRef(false)
  const meetingIdRef = useRef<string | null>(null)


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

    for (const node of inputNodesRef.current) {
      try {
        node.disconnect()
      } catch {}
    }

    try {
      gainNodeRef.current?.disconnect()
    } catch {}

    try {
      workletNodeRef.current?.disconnect()
    } catch {}

    try {
      await audioCtxRef.current?.close()
    } catch {}

    displayStreamRef.current?.getTracks().forEach((t) => t.stop())
    micStreamRef.current?.getTracks().forEach((t) => t.stop())

    socketRef.current = null
    audioCtxRef.current = null
    displayStreamRef.current = null
    micStreamRef.current = null
    gainNodeRef.current = null
    workletNodeRef.current = null
    inputNodesRef.current = []
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
        let displayStream: MediaStream | null = null
        let micStream: MediaStream

        try {
          ;({ displayStream, micStream } =
            await getAudioStreams(selectedSource))
        } catch (err) {
          console.warn('Audio permission/device error:', err)
          stop()
          return
        }

        if (!isActiveRef.current) {
          displayStream?.getTracks().forEach((t) => t.stop())
          micStream.getTracks().forEach((t) => t.stop())
          return
        }

        displayStreamRef.current = displayStream
        micStreamRef.current = micStream

        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioCtxRef.current = audioCtx

        const blob = new Blob([VOW_PROCESSOR_CODE], { type: 'application/javascript' })
        const url = URL.createObjectURL(blob)
        await audioCtx.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)

        const workletNode = new AudioWorkletNode(audioCtx, 'vow-processor')
        const gainNode = audioCtx.createGain()

        workletNodeRef.current = workletNode
        gainNodeRef.current = gainNode

        const micSource = audioCtx.createMediaStreamSource(micStream)
        inputNodesRef.current.push(micSource)
        micSource.connect(gainNode)

        if (displayStream && displayStream.getAudioTracks().length > 0) {
          const displaySource = audioCtx.createMediaStreamSource(displayStream)
          inputNodesRef.current.push(displaySource)
          displaySource.connect(gainNode)
        }

        gainNode.connect(workletNode)
        workletNode.port.onmessage = (event) => {
          if (socket.readyState === WebSocket.OPEN && event.data?.byteLength) {
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

      socket.onerror = () => {
        void cleanup()
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
