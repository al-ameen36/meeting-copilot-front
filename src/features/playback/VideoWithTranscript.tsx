import { useEffect, useRef, useState } from 'react'
import { parseSrt, parseVtt } from '#/lib/subtitles'
import { cn, formatTime } from '#/lib/utils'
import { Header } from '#/features/_internal/aliases'

interface Segment {
  start: number
  end: number
  text: string
}

export function VideoWithTranscript() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Video file selector – creates a blob URL for playback
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (videoSrc) URL.revokeObjectURL(videoSrc) // avoid leaking the previous blob
    const url = URL.createObjectURL(file)
    setVideoSrc(url)
  }

  // Subtitle (SRT or VTT) selector – reads text and parses accordingly
  const handleSubtitleChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    const text = await file.text()
    const parsed = ext === 'vtt' ? parseVtt(text) : parseSrt(text)
    setSegments(parsed)
  }

  // sync active segment with video time
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => {
      const t = video.currentTime
      const idx = segments.findIndex((seg) => t >= seg.start && t <= seg.end)
      setActiveIdx(idx >= 0 ? idx : null)
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    return () => video.removeEventListener('timeupdate', onTimeUpdate)
  }, [segments])

  // keep active transcript segment in view
  useEffect(() => {
    if (activeIdx == null) return
    const el = document.getElementById(`segment-${activeIdx}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeIdx])

  // clicking a transcript line jumps the video to that timestamp
  const handleSegmentClick = (start: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = start
    video.play()
  }

  // release the blob URL when the component unmounts
  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc)
    }
  }, [])

  return (
    <>
      <Header>
        <h1 className="text-2xl font-bold text-zinc-100">Video Playback</h1>
      </Header>
      <div className="flex gap-6 p-6 min-h-[calc(100vh-80px)] pt-24">
        {/* Left column – video & upload controls */}
        <div className="w-2/3 border border-zinc-700 rounded-md bg-zinc-800/60 p-3">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Video file
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoChange}
                className="w-full border border-zinc-600 rounded p-1 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Subtitle file (SRT or VTT)
              </label>
              <input
                type="file"
                accept=".srt,.vtt"
                onChange={handleSubtitleChange}
                className="w-full border border-zinc-600 rounded p-1 bg-zinc-900 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
          <div className="w-full grid place-items-center h-[calc(100%-100px)] mt-10">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="bg-zinc-900 w-full max-h-[calc(100vh-300px)] rounded-md shadow-lg object-contain"
              />
            ) : (
              <p className="text-center text-zinc-500 ">
                Upload a video and a subtitle file to view the synchronized
                video.
              </p>
            )}
          </div>
        </div>
        {/* Right column – transcript list */}
        <div className="w-1/3 overflow-y-auto max-h-[calc(100vh-160px)] border border-zinc-700 rounded-md bg-zinc-800/60 p-3">
          {segments.map((seg, idx) => (
            <button
              type="button"
              id={`segment-${idx}`}
              key={idx}
              onClick={() => handleSegmentClick(seg.start)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md mb-2 transition-colors duration-200',
                idx === activeIdx
                  ? 'bg-cyan-900/60 ring-1 ring-cyan-500/50'
                  : 'hover:bg-zinc-700/40',
              )}
            >
              <div className="text-xs text-gray-400 mb-1">
                {formatTime(seg.start)}
              </div>
              <div className="text-sm text-gray-100 whitespace-pre-wrap">
                {seg.text}
              </div>
            </button>
          ))}
          {segments.length === 0 && (
            <p className="text-center text-zinc-500 mt-8">
              Upload a video and a subtitle file to view the synchronized
              transcript.
            </p>
          )}
        </div>
      </div>
    </>
  )
}
