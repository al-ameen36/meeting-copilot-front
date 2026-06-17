// Types used by the Whisper streaming hook and related utilities

export type AudioSource = 'mic' | 'tab'

export interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker?: string
}

export interface SpeechmaticsAlternative {
  content?: string
  speaker?: string
}

export interface SpeechmaticsResult {
  type?: string
  alternatives?: SpeechmaticsAlternative[]
}
