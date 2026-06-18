import type { AudioStreams } from './audioCaptureAdapter'
import type { MutableRefObject } from 'react'

/**
 * Produce a mixed MediaStream for recording that contains:
 *   • Mic audio (full quality)
 *   • Tab audio (if present)
 *   • Video tracks from the display stream (if present)
 * The function also stores the created AudioContext in `ctxRef` so callers can close it during cleanup.
 */
export function createFullQualityMix(
  streams: AudioStreams,
  ctxRef: MutableRefObject<AudioContext | null>,
): MediaStream {
  const { mic, display } = streams

  // Native‑rate AudioContext for high‑quality mixing
  const ctx = new AudioContext()
  ctxRef.current = ctx

  const dest = ctx.createMediaStreamDestination()

  // Mix mic audio
  const micSource = ctx.createMediaStreamSource(mic)
  micSource.connect(dest)

  // Mix display (tab) audio if present
  if (display && display.getAudioTracks().length > 0) {
    const displaySource = ctx.createMediaStreamSource(display)
    displaySource.connect(dest)
  }

  // Assemble tracks: mixed audio + video (if any)
  const tracks: MediaStreamTrack[] = []
  dest.stream.getAudioTracks().forEach((t) => tracks.push(t))
  if (display) {
    display.getVideoTracks().forEach((t) => tracks.push(t))
  }

  return new MediaStream(tracks)
}
