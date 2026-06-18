/**
 * Save a recording Blob to the user's disk.
 * Uses the File System Access API when available (Chromium browsers);
 * otherwise falls back to creating a temporary download link.
 */
export async function saveRecordingToDisk(blob: Blob, meetingId: string) {
  const fileName = `meeting-${meetingId}.webm`
  // Prefer the native file system API (requires a user gesture)
    // Always use a download link (works without a user gesture) as the File System Access API requires a direct user interaction which we don't have here.
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
