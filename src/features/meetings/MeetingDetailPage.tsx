import { Link } from '@tanstack/react-router'
import { ArrowLeft, Clock, CalendarDays, MessageSquare } from 'lucide-react'
import { useState } from 'react'

import { ChatPanel } from '#/features/chat/ChatPanel'
import type { Meeting, Segment } from '#/types/transcripts'
import { formatTime } from '#/lib/utils'

// Component now receives `meeting` and `segments` as props supplied by the route wrapper

function MeetingDetail({
  meeting,
  segments,
}: {
  meeting: Meeting
  segments: Segment[]
}) {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <Link
            to="/meetings"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-4 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-md flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
                {meeting.title || 'Untitled Session'}
              </h1>
              <div className="flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  <span>
                    {new Date(meeting.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>
                    {new Date(meeting.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors text-sm font-medium w-full sm:w-auto flex-shrink-0 mt-4 sm:mt-0"
            >
              <MessageSquare className="w-4 h-4" />
              Chat with Meeting
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-widest text-zinc-500 font-semibold">
              Session Transcript
            </h2>

            <div className="h-[60vh] bg-zinc-950 border border-zinc-900 rounded-md overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 p-4 space-y-3">
              {segments.length > 0 ? (
                segments.map((segment) => (
                  <div
                    key={segment.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3"
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-500">
                      {formatTime(segment.start)} → {formatTime(segment.end)}
                    </div>
                    <div className="text-sm leading-relaxed text-zinc-100 whitespace-pre-wrap">
                      {segment.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-zinc-500 text-sm">
                    No transcript data was recorded for this meeting.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-sm uppercase tracking-widest text-blue-500 font-semibold mb-4 border-b border-zinc-900 pb-2">
                Chat
              </h2>

              <p className="text-zinc-500 text-sm mb-4">
                Use the chat to ask questions about the meeting transcript.
              </p>

              <button
                onClick={() => setIsChatOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium"
              >
                Open Chat
              </button>
            </div>
          </div>
        </div>
      </div>

      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        meetingId={meeting.id}
      />
    </div>
  )
}

export default MeetingDetail
