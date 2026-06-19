// TranscriptProcessor adapter – pure helpers for Whisper transcript handling.
// These functions are stateless and can be imported where needed.

export {
  normalizeToken,
  wordsOf,
  cleanText,
  collapseAdjacentDuplicates,
  mergeChunk,
  removeOverlap,
  buildTranscriptFromResults,
  dominantSpeaker,
} from '../whisperHelpers'
