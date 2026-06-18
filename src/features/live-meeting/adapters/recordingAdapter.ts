/**
 * RecordingAdapter – thin wrapper around the native MediaRecorder.
 * Provides a simple lifecycle: start(stream), stop():Promise<Blob>, reset().
 * The implementation mirrors the previous useMediaRecorder hook but is a class
 * so it can be used outside of a React hook context (e.g., in this orchestrator).
 */
export class RecordingAdapter {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stopResolve?: (blob: Blob) => void

  /** Start recording the provided MediaStream */
  start(stream: MediaStream) {
    // Simple MIME selection – rely on the browser's default if none matches.
    const options: MediaRecorderOptions = {}
    const recorder = new MediaRecorder(stream, options)
    this.recorder = recorder
    this.chunks = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: recorder.mimeType || '' })
      if (this.stopResolve) {
        this.stopResolve(blob)
        this.stopResolve = undefined
      }
    }
    recorder.start()
  }

  /** Stop the recorder and return a promise that resolves with the Blob */
  stop(): Promise<Blob | null> {
    if (!this.recorder) return Promise.resolve(null)
    return new Promise<Blob>((resolve) => {
      this.stopResolve = resolve
      this.recorder?.stop()
      this.recorder = null
    })
  }

  /** Reset any internal state (currently just clears chunks) */
  reset() {
    this.chunks = []
  }
}
