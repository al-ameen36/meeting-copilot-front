// Socket handling utilities for Whisper streaming

import type {
  SpeechmaticsResult,
} from './types'
import {
  buildTranscriptFromResults,
  dominantSpeaker,
} from './whisperHelpers'

// ---------- Callback signatures ----------
export type OnPartial = (preview: string, speaker: string | null) => void
export type OnFull = (msg: {
  message: string
  results?: SpeechmaticsResult[]
  metadata?: { transcript?: string; start_time?: number; end_time?: number }
}) => void
export type OnError = () => void
export type OnClose = () => void

/**
 * Create a WebSocket connection to the Whisper server and wire up message handling.
 * The caller provides callbacks for the partial transcript preview, full transcript
 * handling, error, and close events.
 */
export const createWhisperSocket = (
  token: string,
  callbacks: {
    onPartial: OnPartial
    onFull: OnFull
    onError: OnError
    onClose: OnClose
  },
) => {
  const socket = new WebSocket(import.meta.env.VITE_WHISPER_SERVER_URL)

  socket.onopen = () => {
    socket.send(JSON.stringify({ token }))
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string)

      // Auth OK – just forward to onFull; the hook will decide what to do.
      if (data.message === 'auth_ok') {
        callbacks.onFull(data)
        return
      }

      // Partial transcript – we build a preview and invoke the partial callback.
      if (data.message === 'AddPartialTranscript') {
        const results: SpeechmaticsResult[] = Array.isArray(data.results)
          ? data.results
          : []
        const text = buildTranscriptFromResults(results) || data?.metadata?.transcript?.trim() || ''
        const speaker = dominantSpeaker(results)
        callbacks.onPartial(text, speaker)
        return
      }

      // Full transcript – forward the whole message to onFull for the hook to merge.
      if (data.message === 'AddTranscript') {
        callbacks.onFull(data)
        return
      }
    } catch {
      // Silently ignore malformed packets – cleanup will handle any broader errors.
    }
  }

  socket.onerror = callbacks.onError
  socket.onclose = callbacks.onClose

  return socket
}
