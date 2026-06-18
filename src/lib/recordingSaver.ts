/**
 * Utility for saving meeting recordings.
 * Uses a simple download link for the video and optionally bundles video + subtitles into a zip.
 */
import JSZip from 'jszip'

/** Save a single video recording – fallback download */
export async function saveRecordingToDisk(blob: Blob, meetingId: string) {
  const fileName = `meeting-${meetingId}.webm`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Save both video and subtitle as a zip archive */
export async function saveMeetingPackage(
  videoBlob: Blob,
  subtitleBlob: Blob,
  meetingId: string,
) {
  const zip = new JSZip()
  zip.file(`meeting-${meetingId}.webm`, videoBlob)
  zip.file(`meeting-${meetingId}.vtt`, subtitleBlob)
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const zipName = `meeting-${meetingId}.zip`
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
