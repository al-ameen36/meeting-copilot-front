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

  // Helper to pick a supported mime type that includes both video and audio.
  const getSupportedMime = (stream: MediaStream) => {
    const hasVideo = stream.getVideoTracks().length > 0
    const hasAudio = stream.getAudioTracks().length > 0

    const videoCandidates = [
      'video/webm; codecs=vp9,opus',
      'video/webm; codecs=vp8,opus',
      'video/webm',
    ]
    const audioCandidates = ['audio/webm; codecs=opus', 'audio/webm']

    if (hasVideo) {
      for (const mime of videoCandidates) {
        if (MediaRecorder.isTypeSupported(mime)) return { mime }
      }
    }

    if (hasAudio) {
      for (const mime of audioCandidates) {
        if (MediaRecorder.isTypeSupported(mime)) return { mime }
      }
    }

    // Let the browser decide if none matched
    return { mime: '' }
  }

  const start = useCallback((stream: MediaStream) => {
    const { mime } = getSupportedMime(stream)
    const options = { mimeType: mime }
    const recorder = new MediaRecorder(stream, options)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: options.mimeType })
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

  const stop = useCallback((): Promise<Blob | null> => {
    if (!recorderRef.current) {
      return Promise.resolve(null)
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
