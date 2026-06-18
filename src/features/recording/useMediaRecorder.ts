import { useRef, useState, useCallback } from 'react'

/**
 * Wrapper around the native MediaRecorder.
 * The stream is supplied when `start(stream)` is called – this lets the caller
 * create the combined audio/video MediaStream later (e.g., after permission is granted).
 */
export function useMediaRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  // No need to keep recordedBlob in state; we resolve it via stop promise


  const start = useCallback((stream: MediaStream) => {
    let options = { mimeType: 'video/webm; codecs=vp9,opus' }
    // Fallback to audio-only if the provided mime type is unsupported (e.g., audio‑only stream)
    try {
      // Attempt to create with video mime type – may throw InvalidStateError
      // eslint-disable-next-line no-new
      new MediaRecorder(stream, options)
    } catch (e) {
      console.warn('Video/webm mime type not supported, falling back to audio/webm', e)
      options = { mimeType: 'audio/webm; codecs=opus' }
    }
    const recorder = new MediaRecorder(stream, options)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: options.mimeType })
      // No state needed; blob is resolved via stop promise
      setPlaybackUrl(URL.createObjectURL(blob))
      // Resolve any awaiting stop promise
      if (stopResolveRef.current) {
        stopResolveRef.current(blob)
        stopResolveRef.current = null
      }
    }
    recorder.start()
  }, [])

  // Promise that resolves when the recorder finishes and the blob is ready
  const stopPromiseRef = useRef<Promise<Blob> | null>(null)
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null)

  const stop = useCallback(() => {
    if (!recorderRef.current) {
      return Promise.resolve(null as any)
    }
    // Create a promise that resolves on the "stop" event
    stopPromiseRef.current = new Promise<Blob>((resolve) => {
      stopResolveRef.current = resolve
    })
    recorderRef.current.stop()
    recorderRef.current = null
    return stopPromiseRef.current
  }, [])

  const reset = useCallback(() => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl)
    setPlaybackUrl(null)
    // No recordedBlob state to clear
    chunksRef.current = []
  }, [playbackUrl])

  return { start, stop, playbackUrl, reset }
}
