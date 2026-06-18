import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { formatTime } from '#/lib/utils'

interface TranscriptDisplayProps {
  segments: { start: number; end: number; text: string }[]
  liveText: string
  isListening: boolean
}

export function TranscriptDisplay({
  segments,
  liveText,
  isListening,
}: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments, liveText])

  return (
    <div className="relative">
      {isListening && (
        <motion.div className="absolute -top-1 -left-1 -right-1 -bottom-1 rounded-3xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-xl" />
      )}

      <div
        ref={scrollRef}
        className="relative w-full space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto"
      >
        {!isListening && segments.length === 0 && !liveText ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm">Waiting for audio...</p>
          </div>
        ) : (
          <div className="space-y-3 px-2">
            {segments.map((segment, idx) => (
              <div
                key={`${segment.start}-${segment.end}-${idx}`}
                className="flex items-start gap-3 py-1"
              >
                <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-400 min-w-[50px]">
                  {formatTime(segment.start)}
                </div>
                <div className="text-sm leading-relaxed text-zinc-50">
                  {segment.text}
                </div>
              </div>
            ))}

            {liveText && (
              <div className="flex items-start gap-3 py-1">
                <div className="mt-1 text-[11px] uppercase tracking-wider text-cyan-300 min-w-[50px]">
                  Live
                </div>
                <div className="text-sm leading-relaxed text-zinc-100">
                  {liveText}
                  {isListening && (
                    <motion.span
                      className="inline-block w-1 h-4 bg-cyan-400 ml-1 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
