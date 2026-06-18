import { createWhisperSocket } from '../socketHandler'

/**
 * Adapter that encapsulates the Whisper WebSocket lifecycle.
 * It forwards the low‑level socket to the caller via the provided handlers.
 */
// Message shape received from Whisper backend.
interface FullMessage {
  message: string
  meeting_id?: string | number
  meetingId?: string | number
  results?: any
  metadata?: {
    transcript?: string
    start_time?: number
    end_time?: number
  }
}

export type WhisperHandlers = {
  onPartial: (incomingText: string, speaker: string | null) => void
  onFull: (msg: FullMessage) => Promise<void>
  onError: () => void
  onClose: () => void
}

export class WhisperSocketAdapter {
  private socket: WebSocket | null = null

  constructor(token: string, handlers: WhisperHandlers) {
    this.socket = createWhisperSocket(token, handlers)
  }

  /** Send raw audio chunk (ArrayBuffer) to the Whisper backend */
  sendChunk(data: ArrayBuffer) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data)
    }
  }

  close() {
    this.socket?.close()
    this.socket = null
  }
}
