// Audio‑related utilities for the Whisper streaming hook

import type { AudioSource } from './types'

/**
 * Acquire microphone (and optionally display) audio streams.
 * Returns an object with `micStream` and, when `selectedSource` is "tab",
 * a `displayStream` that contains the shared system audio.
 */
export const getAudioStreams = async (selectedSource: AudioSource) => {
  const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

  if (selectedSource === 'mic') {
    return { displayStream: null as MediaStream | null, micStream }
  }

  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })
    return { displayStream, micStream }
  } catch (err) {
    console.warn('Display audio unavailable, using mic only:', err)
    return { displayStream: null as MediaStream | null, micStream }
  }
}

/**
 * The worklet processor code that converts incoming audio buffers into
 * transferable ArrayBuffer chunks. Exported as a string so the hook can
 * create a Blob URL on the fly.
 */
export const VOW_PROCESSOR_CODE = `
  class VowProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0]
      if (input && input[0] && input[0].length) {
        this.port.postMessage(input[0].slice(0).buffer)
      }
      return true
    }
  }
  registerProcessor('vow-processor', VowProcessor)
`
