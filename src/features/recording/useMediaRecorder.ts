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
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)

  const start = useCallback((stream: MediaStream) => {
    const options = { mimeType: 'video/webm; codecs=vp9,opus' }
    const recorder = new MediaRecorder(stream, options)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: options.mimeType })
      setRecordedBlob(blob)
      setPlaybackUrl(URL.createObjectURL(blob))
    }
    recorder.start()
  }, [])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
  }, [])

  const reset = useCallback(() => {
    if (playbackUrl) URL.revokeObjectURL(playbackUrl)
    setPlaybackUrl(null)
    setRecordedBlob(null)
    chunksRef.current = []
  }, [playbackUrl])

  return { start, stop, playbackUrl, recordedBlob, reset }
}
