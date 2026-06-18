/**
 * Save a recording Blob to the user's disk.
 * Uses the File System Access API when available (Chromium browsers);
 * otherwise falls back to creating a temporary download link.
 */
export async function saveRecordingToDisk(blob: Blob, meetingId: string) {
  const fileName = `meeting-${meetingId}.webm`
  // Prefer the native file system API (requires a user gesture)
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const opts = {
        suggestedName: fileName,
        types: [
          {
            description: 'WebM video',
            accept: { 'video/webm': ['.webm'] },
          },
        ],
      }
      // @ts-ignore – the API is still experimental
      const handle = await (window as any).showSaveFilePicker(opts)
      // @ts-ignore – createWritable exists on the handle
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return
    } catch (e) {
      console.warn('File System Access API failed, falling back to download', e)
    }
  }

  // Fallback: create a temporary anchor and trigger download
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
