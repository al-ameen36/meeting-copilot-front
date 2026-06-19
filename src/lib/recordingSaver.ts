/**
 * Utility for saving meeting recordings.
 * Downloads the video alone, or bundles video + subtitles into a zip.
 */
import JSZip from 'jszip'

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Save a single video recording */
export function saveRecordingToDisk(blob: Blob, meetingId: string) {
  triggerDownload(blob, `meeting-${meetingId}.webm`)
}

/** Save video and subtitles bundled as a zip archive */
export async function saveMeetingPackage(
  videoBlob: Blob,
  subtitleBlob: Blob,
  meetingId: string,
) {
  const zip = new JSZip()
  zip.file(`meeting-${meetingId}.webm`, videoBlob)
  zip.file(`meeting-${meetingId}.srt`, subtitleBlob)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(zipBlob, `meeting-${meetingId}.zip`)
}
