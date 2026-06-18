import type { AudioSource } from '../types'
import { getAudioStreams } from '../audioSetup'

/**
 * Capture raw mic and optional display (tab) streams.
 * Returns a consistent shape for downstream adapters.
 */
export type AudioStreams = {
  mic: MediaStream
  display?: MediaStream
}

export async function captureAudio(source: AudioSource): Promise<AudioStreams> {
  const { displayStream, micStream } = await getAudioStreams(source)
  return { mic: micStream, display: displayStream ?? undefined }
}
