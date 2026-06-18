import { useRef, useState, useCallback } from 'react'
import { useMediaRecorder } from '#/features/recording/useMediaRecorder'
import { saveMeetingPackage, saveRecordingToDisk } from '#/lib/recordingSaver'

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
import { createWhisperSocket } from './socketHandler'

import type {
  AudioSource,
  TranscriptSegment,
  SpeechmaticsResult,
} from './types'
import { generateSrt } from '#/lib/subtitles'

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
  // Combined stream for local recording (audio + optional video)
  const recordingStreamRef = useRef<MediaStream | null>(null)

  // MediaRecorder hook – receives the combined stream (may be null initially)
  const {
    start: startRecording,
    stop: stopRecording,
    reset: resetRecording,
  } = useMediaRecorder()
  const gainNodeRef = useRef<GainNode | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const inputNodesRef = useRef<AudioNode[]>([])
  const recordingCtxRef = useRef<AudioContext | null>(null)

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
    try {
      await recordingCtxRef.current?.close()
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

  const stop = useCallback(async () => {
    const fallbackEnd =
      sentenceStartRef.current ?? transcriptLinesRef.current.at(-1)?.end ?? 0

    if (sentenceBufferRef.current.trim()) {
      flushSentence(fallbackEnd)
    }

    // Capture meeting ID before cleanup clears it
    const currentMeetingId = meetingIdRef.current

    // Stop the MediaRecorder (if it was started) and await the blob
    const blob = await stopRecording()

    socketRef.current?.close()
    await cleanup()

    // Persist the recorded blob to disk (if any)
    if (blob && currentMeetingId) {
      // Generate SRT subtitles from transcript segments
      let subtitleBlob: Blob | null = null
      try {
        const srtContent = generateSrt(transcriptLinesRef.current)
        subtitleBlob = new Blob([srtContent], { type: 'application/x-subrip' })
      } catch (e) {
        console.warn('Failed to generate subtitles', e)
      }
      if (subtitleBlob) {
        await saveMeetingPackage(blob, subtitleBlob, currentMeetingId)
      } else {
        // Fallback: just save video if subtitle generation failed
        await saveRecordingToDisk(blob, currentMeetingId)
      }
      // Reset the recorder for the next meeting
      resetRecording()
    }
  }, [cleanup, flushSentence, stopRecording, resetRecording])

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

      // Create and configure the Whisper WebSocket via the socket handler
      const socket = createWhisperSocket(session.access_token, {
        onPartial: (incomingText, speaker) => {
          // Build a preview by merging the current buffer with the incoming partial text
          const preview = mergeChunk(sentenceBufferRef.current, incomingText)
          if (speaker) sentenceSpeakerRef.current = speaker
          setLiveText(preview)
          setLiveSpeaker(speaker ?? sentenceSpeakerRef.current)
        },
        onFull: async (msg) => {
          // Handles both auth_ok and AddTranscript messages
          if (msg.message === 'auth_ok') {
            // Prefer the meeting ID supplied by the backend (racy‑free).
            // The server may include it as `meeting_id` or `meetingId`.
            const serverId =
              (msg as any).meeting_id ?? (msg as any).meetingId ?? null
            if (serverId) {
              meetingIdRef.current = serverId
              setMeetingId(serverId)
            }
            await beginAudio()
            return
          }

          // Full transcript handling (AddTranscript)
          const results: SpeechmaticsResult[] = Array.isArray(msg.results)
            ? msg.results
            : []
          const fallbackText = msg.metadata?.transcript?.trim() || ''
          const text = buildTranscriptFromResults(results) || fallbackText
          if (!text) return

          const speaker = dominantSpeaker(results)
          const startTime = msg.metadata?.start_time ?? 0
          const endTime = msg.metadata?.end_time ?? startTime

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
        },
        onError: () => {
          void cleanup()
        },
        onClose: () => {
          void cleanup()
        },
      })
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

        // Build a single MediaStream for recording (audio + video tracks if present)
        // Create AudioContext first
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioCtxRef.current = audioCtx

        const blob = new Blob([VOW_PROCESSOR_CODE], {
          type: 'application/javascript',
        })
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

        // Connect gain node to the worklet for transcription processing only
        gainNode.connect(workletNode)

        // --- Mix mic and tab audio at full quality for recording ---
        // Create a separate AudioContext for recording (native sample rate)
        const recordingCtx = new AudioContext()
        recordingCtxRef.current = recordingCtx
        const recordingDest = recordingCtx.createMediaStreamDestination()

        // Mix mic audio
        const recMicSource = recordingCtx.createMediaStreamSource(micStream)
        recMicSource.connect(recordingDest)

        // Mix tab audio if available
        if (displayStream && displayStream.getAudioTracks().length > 0) {
          const recDisplaySource =
            recordingCtx.createMediaStreamSource(displayStream)
          recDisplaySource.connect(recordingDest)
        }

        // Build final recording MediaStream: mixed audio + video tracks from displayStream
        const finalTracks: MediaStreamTrack[] = []
        recordingDest.stream
          .getAudioTracks()
          .forEach((t) => finalTracks.push(t))
        if (displayStream) {
          displayStream.getVideoTracks().forEach((t) => finalTracks.push(t))
        }
        recordingStreamRef.current = new MediaStream(finalTracks)

        workletNode.port.onmessage = (event) => {
          if (socket.readyState === WebSocket.OPEN && event.data?.byteLength) {
            socket.send(event.data)
          }
        }

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        setActive(true)
        // Start recording now that we have the combined MediaStream
        startRecording(recordingStreamRef.current)
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
